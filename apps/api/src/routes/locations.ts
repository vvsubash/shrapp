import { Hono } from "hono";
import type { Env } from "../env.js";
import { createDb, schema } from "../db/index.js";
import { normalizeName } from "../lib/normalize.js";
import { createLocationSchema } from "@shrapp/shared";

const app = new Hono<{ Bindings: Env }>();

// GET /locations
app.get("/locations", async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(schema.workLocations)
    .orderBy(schema.workLocations.name);
  return c.json({ locations: rows });
});

// POST /locations
app.post("/locations", async (c) => {
  const body = await c.req.json();
  const parsed = createLocationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env.DB);
  const id = crypto.randomUUID();
  const name = parsed.data.name.trim();
  const nameNormalized = normalizeName(name);

  const [location] = await db
    .insert(schema.workLocations)
    .values({ id, name, nameNormalized })
    .returning();

  return c.json({ location }, 201);
});

export { app as locationRoutes };
