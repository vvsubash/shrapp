import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import type { Env, SecondaryStorage } from "./types";

function createKVStorage(kv: KVNamespace): SecondaryStorage {
  return {
    get: async (key: string): Promise<string | null> => {
      return (await kv.get(key)) ?? null;
    },
    set: async (key: string, value: string, ttl?: number): Promise<void> => {
      // Cloudflare KV enforces a 60-second minimum TTL
      const effectiveTtl = ttl ? Math.max(ttl, 60) : undefined;
      await kv.put(
        key,
        value,
        effectiveTtl ? { expirationTtl: effectiveTtl } : undefined
      );
    },
    delete: async (key: string): Promise<void> => {
      await kv.delete(key);
    },
  };
}

export function createAuth(env: Env) {
  const db = new Kysely({
    dialect: new D1Dialect({ database: env.AUTH_DB }),
  });

  return betterAuth({
    database: {
      db,
      type: "sqlite",
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: env.TRUSTED_ORIGINS.split(","),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 30,
      }),
    ],
    secondaryStorage: createKVStorage(env.AUTH_KV),
  });
}
