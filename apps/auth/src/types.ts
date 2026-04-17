export interface Env {
  AUTH_DB: D1Database;
  AUTH_KV: KVNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  TRUSTED_ORIGINS?: string;
}

export interface SecondaryStorage {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
}
