import type { Env, ChatRequest, ChatMessage } from "./types";
import { corsHeaders, handleOptions } from "./cors";
import { callClaude } from "./claude";
import { checkRateLimit } from "./rate-limit";
import { hashIp, logChat } from "./audit-log";

const MAX_HISTORY_LENGTH = 50;

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

function isValidMessage(msg: unknown): msg is ChatMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string"
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

    const clientIp = request.headers.get("cf-connecting-ip") || "unknown";
    const ipHash = await hashIp(clientIp);

    try {
      let body: ChatRequest;
      try {
        body = (await request.json()) as ChatRequest;
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }

      if (!body.message || typeof body.message !== "string") {
        ctx.waitUntil(
          logChat(
            {
              timestamp: new Date().toISOString(),
              ipHash,
              message: "",
              responsePreview: "",
              blocked: true,
              blockReason: "invalid_input",
            },
            env,
          ),
        );
        return jsonResponse({ error: "message is required" }, 400);
      }

      // Rate limit after validation so bad requests don't consume quota
      const rateLimit = await checkRateLimit(clientIp, env);
      if (!rateLimit.allowed) {
        const rateLimitResponse = jsonResponse(
          { error: "Too many requests" },
          429,
          { "Retry-After": String(rateLimit.retryAfter ?? 60) },
        );
        ctx.waitUntil(
          logChat(
            {
              timestamp: new Date().toISOString(),
              ipHash,
              message: body.message.slice(0, 500),
              responsePreview: "",
              blocked: true,
              blockReason: "rate_limit",
            },
            env,
          ),
        );
        return rateLimitResponse;
      }

      const history = Array.isArray(body.history)
        ? body.history.filter(isValidMessage).slice(-MAX_HISTORY_LENGTH)
        : [];

      const response = await callClaude(body.message, history, env);
      ctx.waitUntil(
        logChat(
          {
            timestamp: new Date().toISOString(),
            ipHash,
            message: body.message.slice(0, 500),
            responsePreview: response.slice(0, 200),
            blocked: false,
          },
          env,
        ),
      );
      return jsonResponse({ response }, 200);
    } catch (err) {
      console.error(
        "Chat endpoint error:",
        err instanceof Error ? err.message : err,
      );
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
