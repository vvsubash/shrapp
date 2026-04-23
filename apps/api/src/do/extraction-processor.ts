import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env.js";
import { processExtraction } from "../lib/process-extraction.js";

export class ExtractionProcessor extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { extractionId, r2Key } = await request.json<{
      extractionId: string;
      r2Key: string;
    }>();

    // Run processing in the background via waitUntil so we return immediately
    this.ctx.waitUntil(processExtraction(this.env, extractionId, r2Key));

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
