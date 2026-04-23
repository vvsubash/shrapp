import { Hono } from "hono";
import { eq, isNull } from "drizzle-orm";
import type { Env } from "../env.js";
import { createDb, schema } from "../db/index.js";
import { findTopMatches, autoMatch } from "../lib/trigram.js";
import { buildExtractionPrompt } from "../lib/ai-prompt.js";
import { aiResponseSchema, MATCH_THRESHOLD, MATCH_GAP } from "@shrapp/shared";
import type { ExtractionResponse, ExtractionRow } from "@shrapp/shared";

const app = new Hono<{ Bindings: Env }>();

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// POST /extract — upload image, run AI extraction
app.post("/extract", async (c) => {
  const formData = await c.req.formData();
  const imageFile = formData.get("image");
  if (!imageFile || !(imageFile instanceof File)) {
    return c.json({ error: "Missing image file" }, 400);
  }

  const bytes = await imageFile.arrayBuffer();
  if (bytes.byteLength > 10 * 1024 * 1024) {
    return c.json({ error: "Image exceeds 10MB limit" }, 400);
  }

  const r2Key = await sha256Hex(bytes);
  const db = createDb(c.env.DB);

  // Idempotency: check if this image was already extracted
  const [existing] = await db
    .select()
    .from(schema.extractions)
    .where(eq(schema.extractions.r2Key, r2Key))
    .limit(1);

  if (existing) {
    // If the extraction has rows, return it (true idempotent hit)
    const rows = await buildExtractionRows(db, existing.id);
    if (rows.length > 0) {
      return c.json({
        extraction_id: existing.id,
        work_date: existing.workDate,
        status: existing.status,
        rows,
      } satisfies ExtractionResponse);
    }
    // Otherwise it was a failed parse — delete and re-process
    await db.delete(schema.extractionRows).where(eq(schema.extractionRows.extractionId, existing.id));
    await db.delete(schema.extractions).where(eq(schema.extractions.id, existing.id));
  }

  // Upload to R2
  await c.env.R2.put(r2Key, bytes, {
    httpMetadata: { contentType: imageFile.type || "image/jpeg" },
  });

  // Load roster and locations for context
  const employeeList = await db
    .select()
    .from(schema.employees)
    .where(isNull(schema.employees.archivedAt));
  const locationList = await db.select().from(schema.workLocations);

  // Call Workers AI
  const prompt = buildExtractionPrompt(
    employeeList.map((e) => e.name),
    locationList.map((l) => l.name),
  );

  let rawResponseText: string;
  try {
    rawResponseText = await callVisionAI(c.env.AI, prompt, bytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: "AI extraction failed", details: msg }, 502);
  }

  // Parse AI response, retry once on failure
  let parsed = aiResponseSchema.safeParse(tryParseJson(rawResponseText));
  if (!parsed.success) {
    try {
      const retryText = await callVisionAI(
        c.env.AI,
        prompt + "\n\nYour previous response was not valid JSON. Return only the JSON object, no prose, no code fences.",
        bytes,
      );
      parsed = aiResponseSchema.safeParse(tryParseJson(retryText));
      rawResponseText = retryText;
    } catch {
      // keep original failure
    }
  }

  if (!parsed.success) {
    // Store raw response for debugging but return 422
    const extractionId = crypto.randomUUID();
    await db.insert(schema.extractions).values({
      id: extractionId,
      r2Key,
      workDate: new Date().toISOString().slice(0, 10),
      aiModel: "@cf/meta/llama-3.2-11b-vision-instruct",
      rawResponse: rawResponseText,
      status: "pending",
    });
    return c.json(
      { error: "AI response could not be parsed", extraction_id: extractionId },
      422,
    );
  }

  const aiData = parsed.data;
  const extractionId = crypto.randomUUID();

  // Build extraction rows with trigram matching
  const empCandidates = employeeList.map((e) => ({
    id: e.id,
    name: e.name,
    nameNormalized: e.nameNormalized,
  }));
  const locCandidates = locationList.map((l) => ({
    id: l.id,
    name: l.name,
    nameNormalized: l.nameNormalized,
  }));

  const extractionRows: ExtractionRow[] = [];
  const dbRows: (typeof schema.extractionRows.$inferInsert)[] = [];

  for (const row of aiData.rows) {
    const rowId = crypto.randomUUID();
    const nameQuery = row.matched_name || row.name_raw;
    const suggestedMatches = findTopMatches(nameQuery, empCandidates);
    const autoMatchedId = autoMatch(suggestedMatches, MATCH_THRESHOLD, MATCH_GAP);

    // Location matching
    const locQuery = row.matched_location || row.location_raw;
    const locMatches = findTopMatches(locQuery, locCandidates);
    const autoLocId = locMatches.length > 0 && locMatches[0].score > 0.5
      ? locMatches[0].id
      : null;
    const isNewLocation = !autoLocId && row.location_raw.length > 0;

    dbRows.push({
      id: rowId,
      extractionId,
      rowNum: row.row_num,
      nameRaw: row.name_raw,
      locationRaw: row.location_raw,
      matchedEmployeeId: autoMatchedId,
      matchedLocationId: autoLocId,
      matchConfidence: suggestedMatches[0]?.score ?? null,
      userAction: null,
    });

    extractionRows.push({
      row_id: rowId,
      row_num: row.row_num,
      name_raw: row.name_raw,
      location_raw: row.location_raw,
      suggested_matches: suggestedMatches.map((m) => ({
        employee_id: m.id,
        name: m.name,
        score: m.score,
      })),
      auto_matched_employee_id: autoMatchedId,
      suggested_location_id: autoLocId,
      is_new_location: isNewLocation,
    });
  }

  // Batch insert extraction + rows
  await db.batch([
    db.insert(schema.extractions).values({
      id: extractionId,
      r2Key,
      workDate: aiData.work_date,
      aiModel: "@cf/meta/llama-3.2-11b-vision-instruct",
      rawResponse: rawResponseText,
      status: "pending",
    }),
    ...dbRows.map((row) => db.insert(schema.extractionRows).values(row)),
  ]);

  return c.json({
    extraction_id: extractionId,
    work_date: aiData.work_date,
    status: "pending",
    rows: extractionRows,
  } satisfies ExtractionResponse);
});

// GET /extractions/:id — fetch existing extraction with rows
app.get("/extractions/:id", async (c) => {
  const { id } = c.req.param();
  const db = createDb(c.env.DB);

  const [extraction] = await db
    .select()
    .from(schema.extractions)
    .where(eq(schema.extractions.id, id))
    .limit(1);

  if (!extraction) {
    return c.json({ error: "Extraction not found" }, 404);
  }

  const rows = await buildExtractionRows(db, id);

  return c.json({
    extraction_id: extraction.id,
    work_date: extraction.workDate,
    status: extraction.status,
    rows,
  } satisfies ExtractionResponse);
});

async function buildExtractionRows(
  db: ReturnType<typeof createDb>,
  extractionId: string,
): Promise<ExtractionRow[]> {
  const dbRows = await db
    .select()
    .from(schema.extractionRows)
    .where(eq(schema.extractionRows.extractionId, extractionId))
    .orderBy(schema.extractionRows.rowNum);

  // Load roster for re-computing suggestions
  const employeeList = await db
    .select()
    .from(schema.employees)
    .where(isNull(schema.employees.archivedAt));
  const locationList = await db.select().from(schema.workLocations);

  const empCandidates = employeeList.map((e) => ({
    id: e.id,
    name: e.name,
    nameNormalized: e.nameNormalized,
  }));
  const locCandidates = locationList.map((l) => ({
    id: l.id,
    name: l.name,
    nameNormalized: l.nameNormalized,
  }));

  return dbRows.map((row) => {
    const suggestedMatches = findTopMatches(row.nameRaw ?? "", empCandidates);
    const locMatches = findTopMatches(row.locationRaw ?? "", locCandidates);
    const suggestedLocId = row.matchedLocationId
      ?? (locMatches.length > 0 && locMatches[0].score > 0.5 ? locMatches[0].id : null);

    return {
      row_id: row.id,
      row_num: row.rowNum ?? 0,
      name_raw: row.nameRaw ?? "",
      location_raw: row.locationRaw ?? "",
      suggested_matches: suggestedMatches.map((m) => ({
        employee_id: m.id,
        name: m.name,
        score: m.score,
      })),
      auto_matched_employee_id: row.matchedEmployeeId,
      suggested_location_id: suggestedLocId,
      is_new_location: !suggestedLocId && (row.locationRaw ?? "").length > 0,
    };
  });
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return btoa(chunks.join(""));
}

async function callVisionAI(ai: Ai, prompt: string, imageBytes: ArrayBuffer): Promise<string> {
  const base64 = toBase64(imageBytes);
  const response = await ai.run("@cf/meta/llama-3.2-11b-vision-instruct" as Parameters<Ai["run"]>[0], {
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
        ],
      },
    ],
  });
  // Workers AI returns { response: string } for text generation models
  if (typeof response === "object" && response !== null && "response" in response) {
    return (response as { response: string }).response;
  }
  return JSON.stringify(response);
}

function tryParseJson(text: string): unknown {
  // Strip code fences and any prose before/after the JSON
  let cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
  // Extract the JSON object — find the first { and last }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt to recover truncated JSON: find the last complete row object
    const lastComplete = cleaned.lastIndexOf("}");
    if (lastComplete === -1) return null;
    for (const suffix of ["]}", "]}]}"]) {
      try {
        return JSON.parse(cleaned.slice(0, lastComplete + 1) + suffix);
      } catch {
        // try next suffix
      }
    }
    return null;
  }
}

export { app as extractRoutes };
