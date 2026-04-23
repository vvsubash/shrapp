import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env } from "../env.js";
import { createDb, schema } from "../db/index.js";
import { createShiftSchema } from "@shrapp/shared";

const app = new Hono<{ Bindings: Env }>();

// GET /points/:pointId/shifts — list shifts for a nodal point
app.get("/points/:pointId/shifts", async (c) => {
  const { pointId } = c.req.param();
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(schema.shifts)
    .where(eq(schema.shifts.pointId, pointId))
    .orderBy(schema.shifts.name);
  return c.json({ shifts: rows });
});

// POST /shifts — create a named shift under a nodal point
app.post("/shifts", async (c) => {
  const body = await c.req.json();
  const parsed = createShiftSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env.DB);
  const { point_id, name: rawName } = parsed.data;

  // Verify the point exists and is a nodal point
  const [point] = await db
    .select({ id: schema.points.id, parentPointId: schema.points.parentPointId })
    .from(schema.points)
    .where(eq(schema.points.id, point_id))
    .limit(1);
  if (!point) {
    return c.json({ error: "Point not found" }, 404);
  }
  if (point.parentPointId !== null) {
    return c.json({ error: "Shifts can only be created on nodal points" }, 400);
  }

  const id = crypto.randomUUID();
  const name = rawName.trim();

  const [shift] = await db
    .insert(schema.shifts)
    .values({ id, pointId: point_id, name })
    .returning();

  return c.json({ shift }, 201);
});

// DELETE /shifts/:id
app.delete("/shifts/:id", async (c) => {
  const db = createDb(c.env.DB);
  const { id } = c.req.param();

  await db.delete(schema.shifts).where(eq(schema.shifts.id, id));

  return c.body(null, 204);
});

export { app as shiftRoutes };
