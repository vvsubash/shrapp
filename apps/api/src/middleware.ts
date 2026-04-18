import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AuthEnv } from "./types.js";

if (!process.env.AUTH_URL) {
  throw new Error("AUTH_URL environment variable is required");
}
const AUTH_URL = process.env.AUTH_URL;

const JWKS = createRemoteJWKSet(
  new URL(`${AUTH_URL}/api/auth/jwks`)
);

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: AUTH_URL,
      audience: AUTH_URL,
    });

    c.set("user", {
      id: payload.sub!,
      name: payload.name as string,
      username: payload.username as string,
      email: payload.email as string,
    });

    await next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
});
