export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  AI: Ai;
  ALLOWED_ORIGIN: string;
  EXTRACTION_DO: DurableObjectNamespace;
}
