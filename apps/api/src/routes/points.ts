import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env } from "../env.js";
import { createDb, schema } from "../db/index.js";
import { normalizeName } from "../lib/normalize.js";
import { createPointSchema } from "@shrapp/shared";

const app = new Hono<{ Bindings: Env }>();

// GET /firms/:firmId/points — list points for a firm (nodal + normal)
app.get("/firms/:firmId/points", async (c) => {
  const { firmId } = c.req.param();
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(schema.points)
    .where(eq(schema.points.firmId, firmId))
    .orderBy(schema.points.name);
  return c.json({ points: rows });
});

// POST /points — create a point (nodal or normal)
app.post("/points", async (c) => {
  const body = await c.req.json();
  const parsed = createPointSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env.DB);
  const { firm_id, parent_point_id, name: rawName, shift_duration_hours } = parsed.data;

  // Verify firm exists
  const [firm] = await db
    .select({ id: schema.firms.id })
    .from(schema.firms)
    .where(eq(schema.firms.id, firm_id))
    .limit(1);
  if (!firm) {
    return c.json({ error: "Firm not found" }, 404);
  }

  // If creating a normal point, verify parent is a nodal point
  if (parent_point_id) {
    const [parent] = await db
      .select({ id: schema.points.id, parentPointId: schema.points.parentPointId })
      .from(schema.points)
      .where(eq(schema.points.id, parent_point_id))
      .limit(1);
    if (!parent) {
      return c.json({ error: "Parent point not found" }, 404);
    }
    if (parent.parentPointId !== null) {
      return c.json({ error: "Parent must be a nodal point (cannot nest deeper than one level)" }, 400);
    }
  }

  // shift_duration_hours only allowed on nodal points
  if (parent_point_id && shift_duration_hours) {
    return c.json({ error: "shift_duration_hours can only be set on nodal points" }, 400);
  }

  const id = crypto.randomUUID();
  const name = rawName.trim();
  const nameNormalized = normalizeName(name);

  const [point] = await db
    .insert(schema.points)
    .values({
      id,
      firmId: firm_id,
      parentPointId: parent_point_id ?? null,
      name,
      nameNormalized,
      shiftDurationHours: parent_point_id ? null : (shift_duration_hours ?? null),
    })
    .returning();

  return c.json({ point }, 201);
});

// DELETE /points/:id
app.delete("/points/:id", async (c) => {
  const db = createDb(c.env.DB);
  const { id } = c.req.param();

  await db.delete(schema.points).where(eq(schema.points.id, id));

  return c.body(null, 204);
});

export { app as pointRoutes };
