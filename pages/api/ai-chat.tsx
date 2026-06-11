// pages/api/ai-chat.tsx
//
// AI chat API endpoint — zfb SSR page (prerender = false).
//
// Consolidates:
//   - src/pages/api/ai-chat.ts  (Astro APIRoute, deleted)
//   - packages/ai-chat-worker/  (standalone CF Worker, deleted)
//
// All worker-side protections from packages/ai-chat-worker/ are preserved
// verbatim: CORS, input screening, rate limiting, audit logging.
// The Astro version's "local" mode (claude CLI via spawn) is not portable to
// CF Workers and is omitted; "remote" mode (Anthropic API via raw fetch) is
// the only execution path.
//
// ## CF env bindings required (wrangler.toml)
//
//   ANTHROPIC_API_KEY     — secret  (wrangler secret put ANTHROPIC_API_KEY)
//   DOCS_SITE_URL         — var     (your deployed docs URL, for llms-full.txt)
//   RATE_LIMIT            — KV namespace (wrangler kv namespace create RATE_LIMIT)
//   RATE_LIMIT_PER_MINUTE — optional var (default 10)
//   RATE_LIMIT_PER_DAY    — optional var (default 100)

import { getCloudflareContext } from "@takazudo/zfb-adapter-cloudflare";

import { settings } from "@/config/settings";
import { resolveAllowOrigin, corsHeaders, handleOptions } from "./_ai-chat-cors";
import { screenInput } from "./_ai-chat-screening";
import { hashIp, fireAuditLog } from "./_ai-chat-audit";
import { checkRateLimit } from "./_ai-chat-rate-limit";
import { callClaude } from "./_ai-chat-client";
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
  // touching the API key, KV namespace, audit logger, or rate limiter. Lets
  // the showcase deploy run without ANTHROPIC_API_KEY / RATE_LIMIT bindings.
  if (settings.aiChatDemoMode) {
    return reply({ response: DEMO_MODE_MESSAGE }, 200);
  }

  // cf-connecting-ip is only set by the Cloudflare edge. On non-Cloudflare deployments
  // this header is absent, collapsing all callers into one shared "unknown" rate-limit
  // bucket — every caller competes against the same counters, effectively a global cap.
  const clientIp = request.headers.get("cf-connecting-ip") ?? "unknown";
  const ipHash = await hashIp(clientIp);

  // Rate limit FIRST — before parsing the body, running validation, or writing
  // any audit-log entry. Every audit write touches KV, so gating audits behind
  // the limiter is what stops an unauthenticated flood from amplifying into
  // unbounded KV writes (and from exploiting the fail-open limiter). The
  // tradeoff is deliberate: a malformed request from a legitimate caller also
  // consumes quota. The rate-limited path writes no audit entry, so a blocked
  // request performs no KV writes at all.
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

  // Content-Type guard: reject non-JSON bodies with 415 Unsupported Media Type.
  // A missing or non-JSON Content-Type on a cross-origin POST forces the browser to
  // send a CORS preflight (OPTIONS) first, which this handler allows-or-denies via
  // the allowlist, preventing credentialed cross-origin reads without a preflight.
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.startsWith("application/json")) {
    return reply({ error: "Content-Type must be application/json" }, 415);
  }

  try {
    let body: { message?: unknown; history?: unknown };
    try {
      body = (await request.json()) as { message?: unknown; history?: unknown };
    } catch {
      audit("", { blocked: true, blockReason: "invalid_input" });
      return reply({ error: "Invalid JSON body" }, 400);
    }

    if (!body.message || typeof body.message !== "string") {
      audit("", { blocked: true, blockReason: "invalid_input" });
      return reply({ error: "message is required" }, 400);
    }

    if (body.message.length > MAX_MESSAGE_LENGTH) {
      audit(body.message, { blocked: true, blockReason: "invalid_input" });
      return reply(
        { error: `message exceeds ${MAX_MESSAGE_LENGTH} character limit` },
        400,
      );
    }

    // Screen for prompt injection. Rate limiting already ran above, so a flood
    // of injection attempts cannot amplify audit-log KV writes.
    if (!screenInput(body.message)) {
      audit(body.message, { blocked: true, blockReason: "prompt_injection" });
      return reply(
        { error: "I can only help with questions about the documentation." },
        400,
      );
    }

    let history: ChatMessage[] = [];
    if (body.history !== undefined && body.history !== null) {
      if (!Array.isArray(body.history)) {
        audit(body.message, { blocked: true, blockReason: "invalid_input" });
        return reply({ error: "history must be an array" }, 400);
      }
      if (body.history.length > MAX_HISTORY_LENGTH) {
        audit(body.message, { blocked: true, blockReason: "invalid_input" });
        return reply(
          { error: `history exceeds ${MAX_HISTORY_LENGTH} entry limit` },
          400,
        );
      }
      const candidates = body.history as unknown[];
      const sanitizedHistory: ChatMessage[] = [];
      for (const entry of candidates) {
        if (!isValidMessage(entry)) {
          audit(body.message, { blocked: true, blockReason: "invalid_input" });
          return reply({ error: "history contains malformed entries" }, 400);
        }
        if (entry.content.length > MAX_HISTORY_CONTENT_LENGTH) {
          audit(body.message, { blocked: true, blockReason: "invalid_input" });
          return reply(
            {
              error: `history content exceeds ${MAX_HISTORY_CONTENT_LENGTH} character limit`,
            },
            400,
          );
        }
        // Apply prompt-injection screening only to user-authored turns;
        // assistant turns are model-emitted text already constrained by
        // the system prompt and may legitimately quote injection-shaped
        // language in normal answers.
        //
        // RESIDUAL RISK (accepted by design — see issue #2036, Option 1):
        // `history` is client-supplied and the server is stateless, so it
        // cannot verify that an `assistant`-role entry was actually emitted
        // by a prior model response. A caller can forge an `assistant` turn
        // carrying hostile instructions, which skips this screening. We accept
        // this rather than (a) screening assistant turns too — false positives
        // on legitimate quoted content — or (b) server-issued signed history,
        // which would add a secret and change the client/server payload
        // contract. The blast radius is low (docs-chat only) and the system
        // prompt instructs the model to treat all prior turns as untrusted.
        if (entry.role === "user" && !screenInput(entry.content)) {
          audit(body.message, { blocked: true, blockReason: "prompt_injection" });
          return reply(
            { error: "I can only help with questions about the documentation." },
            400,
          );
        }
        // Rebuild each entry from the validated fields only — a bare cast
        // would smuggle unknown extra fields (e.g. cache_control) verbatim
        // into the Anthropic API request body.
        sanitizedHistory.push({ role: entry.role, content: entry.content });
      }
      history = sanitizedHistory;
    }

    const response = await callClaude(body.message, history, env);
    audit(body.message, { blocked: false, responsePreview: response });
    return reply({ response }, 200);
  } catch (err) {
    console.error("Chat endpoint error:", err instanceof Error ? err.message : err);
    return reply({ error: "Internal server error" }, 500);
  }
}
