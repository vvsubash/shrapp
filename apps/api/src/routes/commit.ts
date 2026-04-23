import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env } from "../env.js";
import { createDb, schema } from "../db/index.js";
import { normalizeName } from "../lib/normalize.js";
import { commitRequestSchema } from "@shrapp/shared";

const app = new Hono<{ Bindings: Env }>();

app.post("/commit", async (c) => {
  const body = await c.req.json();
  const parsed = commitRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { extraction_id, rows } = parsed.data;
  const db = createDb(c.env.DB);

  // Verify extraction exists and is pending
  const [extraction] = await db
    .select()
    .from(schema.extractions)
    .where(eq(schema.extractions.id, extraction_id))
    .limit(1);

  if (!extraction) {
    return c.json({ error: "Extraction not found" }, 404);
  }
  if (extraction.status === "committed") {
    return c.json({ error: "Extraction already committed" }, 409);
  }

  // Gather extraction row data for work_date
  const workDate = extraction.workDate;

  const newEmployees: { id: string; name: string }[] = [];
  const newLocations: { id: string; name: string }[] = [];

  // Pre-process: create new employees/locations and resolve IDs
  const resolvedRows: {
    rowId: string;
    action: string;
    employeeId: string;
    locationId: string | null;
  }[] = [];

  for (const row of rows) {
    if (row.action === "delete") {
      resolvedRows.push({ rowId: row.row_id, action: "delete", employeeId: "", locationId: null });
      continue;
    }

    let employeeId = row.employee_id;
    if (row.action === "new" && row.new_employee_name) {
      const id = crypto.randomUUID();
      const name = row.new_employee_name.trim();
      newEmployees.push({ id, name });
      employeeId = id;
    }

    if (!employeeId) {
      return c.json({ error: `Row ${row.row_id} requires an employee_id or new_employee_name` }, 400);
    }

    let locationId = row.location_id ?? null;
    if (row.new_location_name) {
      const id = crypto.randomUUID();
      const name = row.new_location_name.trim();
      newLocations.push({ id, name });
      locationId = id;
    }

    resolvedRows.push({ rowId: row.row_id, action: row.action, employeeId, locationId });
  }

  // Build batch statements
  type BatchItem = Parameters<typeof db.batch>[0][number];
  const statements: BatchItem[] = [];

  // Insert new employees
  for (const emp of newEmployees) {
    statements.push(
      db.insert(schema.employees).values({
        id: emp.id,
        name: emp.name,
        nameNormalized: normalizeName(emp.name),
      }),
    );
  }

  // Insert new locations
  for (const loc of newLocations) {
    statements.push(
      db.insert(schema.workLocations).values({
        id: loc.id,
        name: loc.name,
        nameNormalized: normalizeName(loc.name),
      }),
    );
  }

  // Insert attendance rows and update extraction_rows
  let committedCount = 0;
  for (const row of resolvedRows) {
    // Update extraction_row user_action
    statements.push(
      db
        .update(schema.extractionRows)
        .set({ userAction: row.action === "delete" ? "deleted" : row.action })
        .where(eq(schema.extractionRows.id, row.rowId)),
    );

    if (row.action === "delete") continue;

    statements.push(
      db.insert(schema.attendance).values({
        id: crypto.randomUUID(),
        employeeId: row.employeeId,
        locationId: row.locationId,
        workDate,
        extractionId: extraction_id,
      }),
    );
    committedCount++;
  }

  // Mark extraction as committed
  statements.push(
    db
      .update(schema.extractions)
      .set({ status: "committed", committedAt: new Date().toISOString() })
      .where(eq(schema.extractions.id, extraction_id)),
  );

  try {
    await db.batch(statements as [BatchItem, ...BatchItem[]]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint failed")) {
      return c.json(
        { error: "Duplicate attendance record", details: msg },
        409,
      );
    }
    throw err;
  }

  return c.json({
    committed_count: committedCount,
    new_employees: newEmployees,
    new_locations: newLocations,
  });
});

export { app as commitRoutes };
