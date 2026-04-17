import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth";
import type { Env } from "./types";

type AuthApp = { Bindings: Env };

const app = new Hono<AuthApp>();

app.use(
  "/*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:8080"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.on(["POST", "GET"], "/api/auth/**", async (c) => {
  try {
    const auth = createAuth(c.env);
    return await auth.handler(c.req.raw);
  } catch (e) {
    console.error("[auth]", e);
    return c.json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
