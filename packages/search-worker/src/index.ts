import type { Env, SearchRequest } from "./types";
import { corsHeaders, handleOptions } from "./cors";
import { checkRateLimit } from "./rate-limit";
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

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

    try {
      let body: SearchRequest;
      try {
        body = (await request.json()) as SearchRequest;
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }

      if (!body.query || typeof body.query !== "string") {
        return jsonResponse({ error: "query is required" }, 400);
      }

      if (body.query.length > 500) {
        return jsonResponse({ error: "query exceeds 500 character limit" }, 400);
      }

      const clientIp = request.headers.get("cf-connecting-ip") || "unknown";
      const ipHash = await hashIp(clientIp);

      const rateLimit = await checkRateLimit(ipHash, env);
      if (!rateLimit.allowed) {
        return jsonResponse(
          { error: "Too many requests" },
          429,
          { "Retry-After": String(rateLimit.retryAfter ?? 60) },
        );
      }

      const { results, total } = await search(body.query, body.limit, env);
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
