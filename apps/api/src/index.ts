import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { authMiddleware } from "./middleware";
import type { AuthEnv } from "./types";

const app = new Hono();

app.use("/*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

// Protected routes
const protectedApp = new Hono<AuthEnv>();

protectedApp.get("/me", (c) => {
  const user = c.get("user");
  return c.json({ user });
});

protectedApp.get("/api/hello", (c) => {
  const user = c.get("user");
  return c.json({ message: `Hello, ${user.name}!` });
});

app.use("/me", authMiddleware);
app.use("/api/*", authMiddleware);
app.route("/", protectedApp);

const port = Number(process.env.PORT) || 8080;

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`API server running on port ${port}`);
});

function shutdown() {
  console.log("Shutting down…");
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default app;
