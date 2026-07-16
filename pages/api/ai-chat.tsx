// pages/api/ai-chat.tsx
//
// AI chat API endpoint — zfb SSR page (prerender = false).
//
// Consolidates:
//   - src/pages/api/ai-chat.ts  (Astro APIRoute, deleted)
//   - packages/ai-chat-worker/  (standalone CF Worker, deleted)
//
// Worker-side protections from packages/ai-chat-worker/ are preserved:
// CORS, input screening, rate limiting, and audit logging.
// The Astro version's "local" mode (claude CLI via spawn) is not portable to
// CF Workers and is omitted; "remote" mode (Anthropic API via raw fetch) is
// the only execution path.
//
// ## CF env bindings required (wrangler.toml)
//
//   ANTHROPIC_API_KEY     — secret  (wrangler secret put ANTHROPIC_API_KEY)
//   DOCS_SITE_URL         — var     (your deployed docs URL, for llms-full.txt)
//   RATE_LIMIT            — KV namespace (wrangler kv namespace create RATE_LIMIT)
//   AI_CHAT_DAILY_SPEND_CAP — Durable Object namespace for exact paid-call admission
//   RATE_LIMIT_PER_MINUTE — optional var (default 10)
//   RATE_LIMIT_PER_DAY    — optional var (default 100)
//   IP_HASH_SECRET        — optional secret (wrangler secret put IP_HASH_SECRET);
//                           when set, client IPs are keyed with HMAC-SHA-256
//                           instead of unsalted SHA-256 (#2038)

import { getCloudflareContext } from "@takazudo/zfb-adapter-cloudflare";

import { settings } from "@/config/settings";
import { resolveAllowOrigin, corsHeaders, handleOptions } from "./_ai-chat-cors";
import { screenInput } from "./_ai-chat-screening";
import { hashIp, fireAuditLog } from "./_ai-chat-audit";
import { checkRateLimit } from "./_ai-chat-rate-limit";
import { callClaude, prepareClaudeRequest } from "./_ai-chat-client";
import {
  admitAiChatPaidCall,
  secondsUntilNextUtcDay,
} from "./_ai-chat-admission";
import type { AiChatEnv, ChatMessage, BlockReason } from "./_ai-chat-types";

// `frontmatter` is required by zfb's TSX page contract (see
// `crates/zfb-content/src/tsx_frontmatter.rs`). Without it, zfb defaults
// the route to SSG and `prerender = false` below is ignored. Title is
// cosmetic for an API route — only the export's presence matters.
export const frontmatter = { title: "AI Chat API" };

export const prerender = false;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Fixed reply returned when `settings.aiChatDemoMode === true`. The exact
 * wording is part of the showcase spec (#1700) — keep it stable so screenshots
 * and bilingual docs stay in sync.
 */
const DEMO_MODE_MESSAGE =
  "This feature is disabled on this demo. Need per project setup to enable this.";

const MAX_HISTORY_LENGTH = 50;
const MAX_MESSAGE_LENGTH = 4000;
// Per-history-entry character cap. Bounds request size and Claude
// context-window cost; exceeds the live `message` cap so callers can
// still replay a full prior turn without resubmitting it.
const MAX_HISTORY_CONTENT_LENGTH = 8192;

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  allowOrigin: string | null,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(allowOrigin),
      ...extraHeaders,
    },
  });
}

function isValidMessage(msg: unknown): msg is ChatMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );
}

interface ValidatedChatRequest {
  ok: true;
  message: string;
  history: ChatMessage[];
}

interface InvalidChatRequest {
  ok: false;
  message: string;
  error: string;
  status: number;
  blockReason: BlockReason;
}

type ChatRequestValidation = ValidatedChatRequest | InvalidChatRequest;

/**
 * Performs request parsing, input validation, and prompt-injection screening
 * before either rate limiter is touched. The caller deliberately defers audit
 * writes until after the per-IP guard so malformed floods cannot amplify KV
 * writes without bound.
 */
async function validateChatRequest(request: Request): Promise<ChatRequestValidation> {
  // A non-JSON cross-origin POST must preflight, where the CORS allowlist is
  // enforced before a browser can expose the response to the caller.
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.startsWith("application/json")) {
    return {
      ok: false,
      message: "",
      error: "Content-Type must be application/json",
      status: 415,
      blockReason: "invalid_input",
    };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      message: "",
      error: "Invalid JSON body",
      status: 400,
      blockReason: "invalid_input",
    };
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      ok: false,
      message: "",
      error: "message is required",
      status: 400,
      blockReason: "invalid_input",
    };
  }

  const candidate = body as Record<string, unknown>;
  if (!candidate.message || typeof candidate.message !== "string") {
    return {
      ok: false,
      message: "",
      error: "message is required",
      status: 400,
      blockReason: "invalid_input",
    };
  }

  const message = candidate.message;
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      message,
      error: `message exceeds ${MAX_MESSAGE_LENGTH} character limit`,
      status: 400,
      blockReason: "invalid_input",
    };
  }
  if (message.trim().length === 0) {
    return {
      ok: false,
      message,
      error: "message must not be empty",
      status: 400,
      blockReason: "invalid_input",
    };
  }
  if (!screenInput(message)) {
    return {
      ok: false,
      message,
      error: "I can only help with questions about the documentation.",
      status: 400,
      blockReason: "prompt_injection",
    };
  }

  let history: ChatMessage[] = [];
  if (candidate.history !== undefined && candidate.history !== null) {
    if (!Array.isArray(candidate.history)) {
      return {
        ok: false,
        message,
        error: "history must be an array",
        status: 400,
        blockReason: "invalid_input",
      };
    }
    if (candidate.history.length > MAX_HISTORY_LENGTH) {
      return {
        ok: false,
        message,
        error: `history exceeds ${MAX_HISTORY_LENGTH} entry limit`,
        status: 400,
        blockReason: "invalid_input",
      };
    }

    const sanitizedHistory: ChatMessage[] = [];
    for (const entry of candidate.history) {
      if (!isValidMessage(entry)) {
        return {
          ok: false,
          message,
          error: "history contains malformed entries",
          status: 400,
          blockReason: "invalid_input",
        };
      }
      if (entry.content.length > MAX_HISTORY_CONTENT_LENGTH) {
        return {
          ok: false,
          message,
          error: `history content exceeds ${MAX_HISTORY_CONTENT_LENGTH} character limit`,
          status: 400,
          blockReason: "invalid_input",
        };
      }
      // Only user-authored turns are screened. Assistant turns may quote
      // injection-shaped language in legitimate answers. The client can forge
      // assistant turns because history is stateless; the structural check
      // below and the system prompt constrain that accepted residual risk.
      if (entry.role === "user" && !screenInput(entry.content)) {
        return {
          ok: false,
          message,
          error: "I can only help with questions about the documentation.",
          status: 400,
          blockReason: "prompt_injection",
        };
      }
      sanitizedHistory.push({ role: entry.role, content: entry.content });
    }
    history = sanitizedHistory;

    // Defense in depth: reject transcripts with implausibly many assistant
    // turns while allowing one model-primed opener.
    const userTurns = history.filter((entry) => entry.role === "user").length;
    const assistantTurns = history.filter((entry) => entry.role === "assistant").length;
    if (assistantTurns > userTurns + 1) {
      return {
        ok: false,
        message,
        error: "history structure is invalid",
        status: 400,
        blockReason: "invalid_input",
      };
    }
  }

  return { ok: true, message, history };
}

// ---------------------------------------------------------------------------
// SSR handler — default export (called per-request by the zfb engine)
// ---------------------------------------------------------------------------

export default async function AiChatHandler(): Promise<Response> {
  const { env, ctx, request } = getCloudflareContext<AiChatEnv>();

  // Resolve CORS allow-origin once — used by every response in this handler.
  // Must happen before OPTIONS so preflight returns the correct header.
  const allowOrigin = resolveAllowOrigin(request.headers.get("Origin"));

  /** Convenience wrapper that bakes `allowOrigin` into every JSON response. */
  function reply(
    body: Record<string, unknown>,
    status: number,
    extraHeaders?: Record<string, string>,
  ): Response {
    return jsonResponse(body, status, allowOrigin, extraHeaders);
  }

  if (request.method === "OPTIONS") {
    return handleOptions(allowOrigin);
  }

  if (request.method !== "POST") {
    return reply({ error: "Method not allowed" }, 405);
  }

  // Demo-mode short-circuit: when enabled, reply with a fixed message before
  // touching the API key, KV/DO bindings, audit logger, or rate limiters. Lets
  // the showcase deploy run without any paid-call infrastructure.
  if (settings.aiChatDemoMode) {
    return reply({ response: DEMO_MODE_MESSAGE }, 200);
  }

  try {
    // Parse and screen first, but defer all audit KV writes until after the
    // per-IP guard. Malformed requests still consume approximate per-IP quota.
    const validation = await validateChatRequest(request);

    // cf-connecting-ip is only set by the Cloudflare edge. Elsewhere, callers
    // share the "unknown" per-IP bucket. The exact global cap is independent.
    const clientIp = request.headers.get("cf-connecting-ip") ?? "unknown";
    const ipHash = await hashIp(clientIp, env.IP_HASH_SECRET);
    const rateLimit = await checkRateLimit(ipHash, env);
    if (!rateLimit.allowed) {
      return reply(
        { error: "Too many requests" },
        429,
        { "Retry-After": String(rateLimit.retryAfter ?? 60) },
      );
    }

    /** Fire-and-forget audit entry via ctx.waitUntil. */
    function audit(
      message: string,
      opts: { blocked: boolean; blockReason?: BlockReason; responsePreview?: string },
    ): void {
      fireAuditLog(ctx.waitUntil.bind(ctx), env.RATE_LIMIT, {
        timestamp: new Date().toISOString(),
        ipHash,
        message: message.slice(0, 500),
        responsePreview: opts.responsePreview?.slice(0, 200) ?? "",
        blocked: opts.blocked,
        blockReason: opts.blockReason,
      });
    }

    if (!validation.ok) {
      audit(validation.message, {
        blocked: true,
        blockReason: validation.blockReason,
      });
      return reply({ error: validation.error }, validation.status);
    }

    // Resolve every non-paid prerequisite, including docs context and request
    // serialization, before claiming an exact global admission.
    const requestBody = await prepareClaudeRequest(
      validation.message,
      validation.history,
      env,
    );

    const globalDailyLimit = settings.aiChatGlobalDailyLimit;
    if (globalDailyLimit !== false) {
      const admissionTime = new Date();
      const admission = await admitAiChatPaidCall(globalDailyLimit, env, admissionTime);
      if (!admission.allowed) {
        const retryAfter = secondsUntilNextUtcDay(admissionTime);
        return reply(
          { error: "Too many requests", retryAfter },
          429,
          { "Retry-After": String(retryAfter) },
        );
      }
    }

    // An admission intentionally remains consumed if this single paid fetch
    // fails. There is no refund and no automatic provider retry.
    const response = await callClaude(requestBody, env);
    audit(validation.message, { blocked: false, responsePreview: response });
    return reply({ response }, 200);
  } catch (err) {
    console.error("Chat endpoint error:", err instanceof Error ? err.message : err);
    return reply({ error: "Internal server error" }, 500);
  }
}
