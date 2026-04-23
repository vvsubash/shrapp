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
