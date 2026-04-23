import { eq, isNull } from "drizzle-orm";
import type { Env } from "../env.js";
import { createDb, schema } from "../db/index.js";
import { findTopMatches, autoMatch } from "./trigram.js";
import { buildExtractionPrompt } from "./ai-prompt.js";
import { aiResponseSchema, MATCH_THRESHOLD, MATCH_GAP } from "@shrapp/shared";

/**
 * Run the full AI extraction pipeline: call Workers AI, parse response,
 * trigram-match rows, and write results to D1.
 *
 * On success: sets extraction status to "pending" and inserts extraction_rows.
 * On failure: sets extraction status to "failed" with error_message.
 */
export async function processExtraction(
  env: Env,
  extractionId: string,
  r2Key: string,
): Promise<void> {
  const db = createDb(env.DB);

  try {
    // Load image from R2
    const obj = await env.R2.get(r2Key);
    if (!obj) {
      throw new Error("Image not found in R2");
    }
    const bytes = await obj.arrayBuffer();

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

    let rawResponseText = await callVisionAI(env.AI, prompt, bytes);

    // Parse AI response, retry once on failure
    let parsed = aiResponseSchema.safeParse(tryParseJson(rawResponseText));
    if (!parsed.success) {
      try {
        const retryText = await callVisionAI(
          env.AI,
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
      // Store raw response for debugging, mark as failed
      await db
        .update(schema.extractions)
        .set({
          rawResponse: rawResponseText,
          status: "failed",
          errorMessage: "AI response could not be parsed",
        })
        .where(eq(schema.extractions.id, extractionId));
      return;
    }

    const aiData = parsed.data;

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
    }

    // Batch update extraction + insert rows
    await db.batch([
      db
        .update(schema.extractions)
        .set({
          workDate: aiData.work_date,
          rawResponse: rawResponseText,
          status: "pending",
        })
        .where(eq(schema.extractions.id, extractionId)),
      ...dbRows.map((row) => db.insert(schema.extractionRows).values(row)),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(schema.extractions)
      .set({
        status: "failed",
        errorMessage: `AI extraction failed: ${msg}`,
      })
      .where(eq(schema.extractions.id, extractionId));
  }
}

export function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return btoa(chunks.join(""));
}

export async function callVisionAI(ai: Ai, prompt: string, imageBytes: ArrayBuffer): Promise<string> {
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

export function tryParseJson(text: string): unknown {
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
