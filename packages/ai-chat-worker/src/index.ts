import type { Env, ChatRequest, ChatMessage } from "./types";
import type { BlockReason } from "./audit-log";
import { corsHeaders, handleOptions } from "./cors";
import { callClaude } from "./claude";
import { screenInput } from "./input-screen";
import { checkRateLimit } from "./rate-limit";
import { hashIp, logChat } from "./audit-log";

const MAX_HISTORY_LENGTH = 50;
const MAX_MESSAGE_LENGTH = 4000;

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

function auditLog(
  ctx: ExecutionContext,
  env: Env,
  ipHash: string,
  message: string,
  opts: { blocked: boolean; blockReason?: BlockReason; responsePreview?: string },
): void {
  ctx.waitUntil(
    logChat(
      {
        timestamp: new Date().toISOString(),
        ipHash,
        message: message.slice(0, 500),
        responsePreview: opts.responsePreview?.slice(0, 200) ?? "",
        blocked: opts.blocked,
        blockReason: opts.blockReason,
      },
      env,
    ),
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
        auditLog(ctx, env, ipHash, "", { blocked: true, blockReason: "invalid_input" });
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }

      if (!body.message || typeof body.message !== "string") {
        auditLog(ctx, env, ipHash, "", { blocked: true, blockReason: "invalid_input" });
        return jsonResponse({ error: "message is required" }, 400);
      }

      if (body.message.length > MAX_MESSAGE_LENGTH) {
        auditLog(ctx, env, ipHash, body.message, { blocked: true, blockReason: "invalid_input" });
        return jsonResponse({ error: `message exceeds ${MAX_MESSAGE_LENGTH} character limit` }, 400);
      }

      // Screen for prompt injection before rate limiting so attempts don't
      // consume the caller's rate limit quota
      const screen = screenInput(body.message);
      if (!screen.safe) {
        auditLog(ctx, env, ipHash, body.message, { blocked: true, blockReason: "prompt_injection" });
        return jsonResponse(
          { error: "I can only help with questions about the documentation." },
          400,
        );
      }

      // Rate limit after validation so bad requests don't consume quota
      const rateLimit = await checkRateLimit(ipHash, env);
      if (!rateLimit.allowed) {
        auditLog(ctx, env, ipHash, body.message, { blocked: true, blockReason: "rate_limit" });
        return jsonResponse(
          { error: "Too many requests" },
          429,
          { "Retry-After": String(rateLimit.retryAfter ?? 60) },
        );
      }

      const history = Array.isArray(body.history)
        ? body.history.filter(isValidMessage).slice(-MAX_HISTORY_LENGTH)
        : [];

      const response = await callClaude(body.message, history, env);
      auditLog(ctx, env, ipHash, body.message, { blocked: false, responsePreview: response });
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
