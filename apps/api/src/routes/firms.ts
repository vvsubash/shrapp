import { Hono } from "hono";
import { eq, isNull } from "drizzle-orm";
import type { Env } from "../env.js";
import { createDb, schema } from "../db/index.js";
import { normalizeName } from "../lib/normalize.js";
import { createFirmSchema } from "@shrapp/shared";

const app = new Hono<{ Bindings: Env }>();

// GET /firms — list active firms
app.get("/firms", async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(schema.firms)
    .where(isNull(schema.firms.archivedAt))
    .orderBy(schema.firms.name);
  return c.json({ firms: rows });
});

// POST /firms — create firm
app.post("/firms", async (c) => {
  const body = await c.req.json();
  const parsed = createFirmSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env.DB);
  const id = crypto.randomUUID();
  const name = parsed.data.name.trim();
  const nameNormalized = normalizeName(name);

  const [firm] = await db
    .insert(schema.firms)
    .values({ id, name, nameNormalized })
    .returning();

  return c.json({ firm }, 201);
});

// POST /firms/bulk — bulk import from CSV
app.post("/firms/bulk", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return c.json({ error: "Missing CSV file" }, 400);
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return c.json({ error: "CSV must have a header row and at least one data row" }, 400);
  }

  // Parse header
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const firmCol = col("firm_name");
  const pointCol = col("point_name");
  const typeCol = col("point_type");
  const parentCol = col("parent_point_name");
  const durationCol = col("shift_duration_hours");
  const shiftsCol = col("shift_names");

  if (firmCol === -1 || pointCol === -1) {
    return c.json({ error: "CSV must have firm_name and point_name columns" }, 400);
  }

  // Parse rows
  const rows = lines.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    return {
      firmName: cols[firmCol]?.trim() ?? "",
      pointName: cols[pointCol]?.trim() ?? "",
      pointType: (cols[typeCol]?.trim().toLowerCase() ?? "nodal") as "nodal" | "normal",
      parentPointName: cols[parentCol]?.trim() ?? "",
      shiftDurationHours: parseInt(cols[durationCol] ?? "") || null,
      shiftNames: (cols[shiftsCol]?.trim() ?? "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }).filter((r) => r.firmName && r.pointName);

  const db = createDb(c.env.DB);
  type BatchItem = Parameters<typeof db.batch>[0][number];
  const statements: BatchItem[] = [];

  // Dedupe and create firms
  const firmNames = [...new Set(rows.map((r) => r.firmName))];
  const firmMap = new Map<string, string>(); // name -> id
  for (const name of firmNames) {
    const id = crypto.randomUUID();
    firmMap.set(name, id);
    statements.push(
      db.insert(schema.firms).values({
        id,
        name,
        nameNormalized: normalizeName(name),
      }),
    );
  }

  // Create nodal points first
  const nodalRows = rows.filter((r) => r.pointType === "nodal");
  const pointMap = new Map<string, string>(); // "firmName::pointName" -> id
  for (const row of nodalRows) {
    const id = crypto.randomUUID();
    const key = `${row.firmName}::${row.pointName}`;
    pointMap.set(key, id);
    statements.push(
      db.insert(schema.points).values({
        id,
        firmId: firmMap.get(row.firmName)!,
        parentPointId: null,
        name: row.pointName,
        nameNormalized: normalizeName(row.pointName),
        shiftDurationHours: row.shiftDurationHours,
      }),
    );
    // Create shifts for this nodal point
    for (const shiftName of row.shiftNames) {
      statements.push(
        db.insert(schema.shifts).values({
          id: crypto.randomUUID(),
          pointId: id,
          name: shiftName,
        }),
      );
    }
  }

  // Create normal points
  const normalRows = rows.filter((r) => r.pointType === "normal");
  for (const row of normalRows) {
    const parentKey = `${row.firmName}::${row.parentPointName}`;
    const parentId = pointMap.get(parentKey);
    if (!parentId) continue; // skip if parent not found
    const id = crypto.randomUUID();
    statements.push(
      db.insert(schema.points).values({
        id,
        firmId: firmMap.get(row.firmName)!,
        parentPointId: parentId,
        name: row.pointName,
        nameNormalized: normalizeName(row.pointName),
        shiftDurationHours: null,
      }),
    );
  }

  if (statements.length === 0) {
    return c.json({ error: "No valid rows found in CSV" }, 400);
  }

  await db.batch(statements as [BatchItem, ...BatchItem[]]);

  return c.json({
    firms_created: firmNames.length,
    points_created: nodalRows.length + normalRows.length,
    shifts_created: nodalRows.reduce((sum, r) => sum + r.shiftNames.length, 0),
  }, 201);
});

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// DELETE /firms/:id — soft delete (archive)
app.delete("/firms/:id", async (c) => {
  const db = createDb(c.env.DB);
  const { id } = c.req.param();

  await db
    .update(schema.firms)
    .set({ archivedAt: new Date().toISOString() })
    .where(eq(schema.firms.id, id));

  return c.body(null, 204);
});

export { app as firmRoutes };
