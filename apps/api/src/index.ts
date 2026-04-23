import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env.js";
import { employeeRoutes } from "./routes/employees.js";
import { locationRoutes } from "./routes/locations.js";
import { extractRoutes } from "./routes/extract.js";
import { commitRoutes } from "./routes/commit.js";

export { ExtractionProcessor } from "./do/extraction-processor.js";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", async (c, next) => {
  const origins = c.env.ALLOWED_ORIGIN.split(",").map((o) => o.trim());
  const handler = cors({
    origin: origins,
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  });
  return handler(c, next);
});

app.get("/api/health", (c) => c.json({ status: "ok" }));


app.route("/api", employeeRoutes);
app.route("/api", locationRoutes);
app.route("/api", extractRoutes);
app.route("/api", commitRoutes);

export default app;
