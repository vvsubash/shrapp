import { Hono } from "hono";
import { eq, isNull } from "drizzle-orm";
import type { Env } from "../env.js";
import { createDb, schema } from "../db/index.js";
import { normalizeName } from "../lib/normalize.js";
import { createEmployeeSchema } from "@shrapp/shared";

const app = new Hono<{ Bindings: Env }>();

// GET /employees — active roster
app.get("/employees", async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(schema.employees)
    .where(isNull(schema.employees.archivedAt))
    .orderBy(schema.employees.name);
  return c.json({ employees: rows });
});

// POST /employees — create
app.post("/employees", async (c) => {
  const body = await c.req.json();
  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env.DB);
  const id = crypto.randomUUID();
  const name = parsed.data.name.trim();
  const nameNormalized = normalizeName(name);

  const [employee] = await db
    .insert(schema.employees)
    .values({ id, name, nameNormalized })
    .returning();

  return c.json({ employee }, 201);
});

// DELETE /employees/:id — soft delete
app.delete("/employees/:id", async (c) => {
  const db = createDb(c.env.DB);
  const { id } = c.req.param();

  await db
    .update(schema.employees)
    .set({ archivedAt: new Date().toISOString() })
    .where(eq(schema.employees.id, id));

  return c.body(null, 204);
});

export { app as employeeRoutes };
