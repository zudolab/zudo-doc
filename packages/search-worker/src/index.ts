import type { Env, SearchRequest } from "./types";
import { corsHeaders, handleOptions } from "./cors";
import { checkRateLimit } from "./rate-limit";
import { hashIp } from "./hash-ip";
import { search } from "./search";

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return handleOptions();
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const url = new URL(request.url);
    if (url.pathname !== "/") {
      return jsonResponse({ error: "Not found" }, 404);
    }

    // Content-Type guard: reject non-JSON bodies with 415. Forces a CORS preflight
    // on cross-origin callers (same rationale as the ai-chat endpoint), even though
    // this worker uses wildcard CORS — it still prevents form-submission CSRF attacks.
    const contentType = request.headers.get("Content-Type") ?? "";
    if (!contentType.startsWith("application/json")) {
      return jsonResponse({ error: "Content-Type must be application/json" }, 415);
    }

    try {
      // Reject oversized bodies BEFORE buffering. A legitimate search request
      // (query ≤ 500 chars + limit field) is well under 1 KB; 4 KB is a
      // generous cap that stops memory exhaustion from large payloads without
      // affecting real callers.
      const contentLength = request.headers.get("Content-Length");
      if (contentLength !== null) {
        const bodySize = parseInt(contentLength, 10);
        if (!Number.isNaN(bodySize) && bodySize > 4096) {
          return jsonResponse({ error: "Request body too large" }, 413);
        }
      }

      let body: { query?: unknown; limit?: unknown };
      try {
        body = (await request.json()) as { query?: unknown; limit?: unknown };
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }

      if (!body.query || typeof body.query !== "string") {
        return jsonResponse({ error: "query is required" }, 400);
      }

      if (body.query.length > 500) {
        return jsonResponse({ error: "query exceeds 500 character limit" }, 400);
      }

      // Validate body.limit explicitly before passing to search(). clampLimit handles
      // the numeric clamping, but a non-numeric string value would silently become
      // NaN and fall back to the default — validate the type here instead.
      let limitArg: number | undefined;
      if (body.limit !== undefined && body.limit !== null) {
        if (typeof body.limit !== "number") {
          return jsonResponse({ error: "limit must be a number" }, 400);
        }
        limitArg = body.limit;
      }

      // cf-connecting-ip is only set by the Cloudflare edge; absent on other platforms,
      // collapsing all callers into a shared "unknown" rate-limit bucket.
      const clientIp = request.headers.get("cf-connecting-ip") || "unknown";
      // HMAC-SHA-256 keyed by the optional IP_HASH_SECRET when provisioned;
      // falls back to unsalted SHA-256 when it is absent (#2038).
      const ipHash = await hashIp(clientIp, env.IP_HASH_SECRET);

      const rateLimit = await checkRateLimit(ipHash, env);
      if (!rateLimit.allowed) {
        return jsonResponse(
          { error: "Too many requests" },
          429,
          { "Retry-After": String(rateLimit.retryAfter ?? 60) },
        );
      }

      const { results, total } = await search(body.query, limitArg, env);
      return jsonResponse({ results, query: body.query, total }, 200);
    } catch (err) {
      console.error(
        "Search endpoint error:",
        err instanceof Error ? err.message : err,
      );
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
