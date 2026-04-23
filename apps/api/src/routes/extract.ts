import { Hono } from "hono";
import { eq, isNull } from "drizzle-orm";
import type { Env } from "../env.js";
import { createDb, schema } from "../db/index.js";
import { findTopMatches } from "../lib/trigram.js";
import type { ExtractionResponse, ExtractionRow } from "@shrapp/shared";

const app = new Hono<{ Bindings: Env }>();

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// POST /extract — upload image, kick off async AI extraction
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
    // If the extraction is still processing or has rows, return it
    if (existing.status === "processing") {
      return c.json({
        extraction_id: existing.id,
        work_date: existing.workDate,
        status: existing.status,
        rows: [],
      } satisfies ExtractionResponse, 202);
    }

    const rows = await buildExtractionRows(db, existing.id);
    if (rows.length > 0) {
      return c.json({
        extraction_id: existing.id,
        work_date: existing.workDate,
        status: existing.status,
        rows,
      } satisfies ExtractionResponse);
    }
    // Otherwise it was a failed extraction — delete and re-process
    await db.delete(schema.extractionRows).where(eq(schema.extractionRows.extractionId, existing.id));
    await db.delete(schema.extractions).where(eq(schema.extractions.id, existing.id));
  }

  // Upload to R2
  await c.env.R2.put(r2Key, bytes, {
    httpMetadata: { contentType: imageFile.type || "image/jpeg" },
  });

  // Insert extraction with "processing" status
  const extractionId = crypto.randomUUID();
  await db.insert(schema.extractions).values({
    id: extractionId,
    r2Key,
    workDate: new Date().toISOString().slice(0, 10),
    aiModel: "@cf/meta/llama-3.2-11b-vision-instruct",
    rawResponse: "",
    status: "processing",
  });

  // Kick off Durable Object for async processing
  const doId = c.env.EXTRACTION_DO.idFromName(extractionId);
  const stub = c.env.EXTRACTION_DO.get(doId);
  c.executionCtx.waitUntil(
    stub.fetch(new Request("https://do/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extractionId, r2Key }),
    })),
  );

  return c.json({
    extraction_id: extractionId,
    work_date: new Date().toISOString().slice(0, 10),
    status: "processing",
    rows: [],
  } satisfies ExtractionResponse, 202);
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

  const rows = extraction.status === "processing"
    ? []
    : await buildExtractionRows(db, id);

  return c.json({
    extraction_id: extraction.id,
    work_date: extraction.workDate,
    status: extraction.status,
    rows,
    error_message: extraction.errorMessage ?? undefined,
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

export { app as extractRoutes };
