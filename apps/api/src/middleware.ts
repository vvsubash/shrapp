import { createMiddleware } from "hono/factory";
import { SessionResponseSchema } from "./types";
import type { AuthEnv } from "./types";

const AUTH_URL = process.env.AUTH_URL ?? "http://localhost:8787";

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const cookie = c.req.header("cookie");
  if (!cookie) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const res = await fetch(`${AUTH_URL}/api/auth/get-session`, {
    headers: { cookie },
  });

  if (!res.ok) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const parsed = SessionResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", parsed.data.user);
  await next();
});
