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
import { buildClaudeRequestBody } from "./_ai-chat-payload";

// `frontmatter` is required by zfb's TSX page contract (see
// `crates/zfb-content/src/tsx_frontmatter.rs`). Without it, zfb defaults
// the route to SSG and `prerender = false` below is ignored. Title is
// cosmetic for an API route — only the export's presence matters.
export const frontmatter = { title: "AI Chat API" };

export const prerender = false;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal KV namespace shape — avoids a hard dep on @cloudflare/workers-types. */
interface MinimalKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface AiChatEnv {
  ANTHROPIC_API_KEY: string;
  DOCS_SITE_URL: string;
  RATE_LIMIT: MinimalKV;
  RATE_LIMIT_PER_MINUTE?: string;
  RATE_LIMIT_PER_DAY?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type BlockReason = "rate_limit" | "invalid_input" | "prompt_injection";

interface AuditLogEntry {
  timestamp: string;
  ipHash: string;
  message: string;
  responsePreview: string;
  blocked: boolean;
  blockReason?: BlockReason;
}

interface ClaudeTextBlock {
  type: "text";
  text: string;
}

interface ClaudeApiResponse {
  content: Array<ClaudeTextBlock | { type: string; [key: string]: unknown }>;
  stop_reason: string;
}

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

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const SECONDS_PER_MINUTE = MS_PER_MINUTE / 1000;
const SECONDS_PER_DAY = MS_PER_DAY / 1000;
const MINUTE_KEY_TTL = 2 * SECONDS_PER_MINUTE;
const DAY_KEY_TTL = 2 * SECONDS_PER_DAY;
const DEFAULT_PER_MINUTE = 10;
const DEFAULT_PER_DAY = 100;

// ---------------------------------------------------------------------------
// Docs context (in-memory cache, best-effort for CF Workers isolate lifespan)
// ---------------------------------------------------------------------------

let cachedDocsContext: string | null = null;
let cachedAt = 0;

async function fetchDocsContext(docsUrl: string): Promise<string> {
  const now = Date.now();
  if (cachedDocsContext !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedDocsContext;
  }
  const url = `${docsUrl.replace(/\/$/, "")}/llms-full.txt`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch docs context: ${response.status}`);
  }
  cachedDocsContext = await response.text();
  cachedAt = now;
  return cachedDocsContext;
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

// CORS shape note: search-worker/src/cors.ts always uses "*" for Allow-Origin (no origin
// whitelist — it is an opt-in, non-metered service). This module uses a per-origin allowlist
// via aiChatAllowedOrigins (or "*" in demo mode). The two CORS implementations intentionally
// diverge because they serve different threat models; a shared module is not extracted
// (different build targets: pages/api esbuild host vs standalone Wrangler worker package).
const CORS_STATIC_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "Retry-After",
  "Access-Control-Max-Age": "86400",
};

/**
 * Resolves the `Access-Control-Allow-Origin` value for a given request origin.
 *
 * - Demo mode: always returns `"*"` (back-compat — showcase runs without
 *   `aiChatAllowedOrigins` configured).
 * - Non-demo, origin matches `aiChatAllowedOrigins`: echoes the origin.
 * - Non-demo, origin absent or not in the allowlist: returns `null` (no
 *   origin header sent — browsers will block cross-origin requests).
 */
function resolveAllowOrigin(requestOrigin: string | null): string | null {
  if (settings.aiChatDemoMode) return "*";
  if (!requestOrigin) return null;
  const allowed = settings.aiChatAllowedOrigins as string[];
  return allowed.includes(requestOrigin) ? requestOrigin : null;
}

function corsHeaders(allowOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = { ...CORS_STATIC_HEADERS };
  if (allowOrigin !== null) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
    // Vary: Origin so caches don't serve the wrong allow-origin to other origins.
    if (allowOrigin !== "*") {
      headers["Vary"] = "Origin";
    }
  }
  return headers;
}

function handleOptions(allowOrigin: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(allowOrigin) });
}

// ---------------------------------------------------------------------------
// Input screening (prompt injection guard)
// ---------------------------------------------------------------------------

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /system\s*prompt/i,
  /reveal\s+(your|the)\s+(instructions?|prompt|config)/i,
  /what\s+(are|is)\s+your\s+(instructions?|rules?|system\s*prompt)/i,
  /api[_\s]?key/i,
  /anthropic[_\s]?key/i,
  /secret[_\s]?key/i,
  /\bDAN\s+mode\b/i,
  /act\s+as\s+(if\s+)?(you\s+)?(have\s+)?(no|without)\s+(restrictions?|rules?|limits?)/i,
  /pretend\s+(you\s+)?(are|were)\s+(not|no longer)\s+(bound|restricted)/i,
];

/**
 * Returns true if the message is safe, false if a pattern matched.
 *
 * NOTE: This is NOT a security boundary. The actual defenses are:
 *   1. The system prompt (buildSystemPrompt) instructs the model to refuse injection attempts.
 *   2. The escape-first renderer on the client — assistant output is rendered as escaped text,
 *      not raw HTML, so even a jailbroken reply cannot inject markup into the page.
 * This regex is a best-effort early-exit that reduces cost and audit noise from obvious
 * probes; it does not protect against crafted inputs that bypass string matching.
 */
function screenInput(message: string): boolean {
  return !INJECTION_PATTERNS.some((p) => p.test(message));
}

// ---------------------------------------------------------------------------
// Audit logging (fire-and-forget via ctx.waitUntil)
// ---------------------------------------------------------------------------

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fireAuditLog(
  waitUntil: (p: Promise<unknown>) => void,
  kv: MinimalKV,
  entry: AuditLogEntry,
): void {
  const key = `audit:${entry.timestamp.slice(0, 10)}:${Date.now()}:${crypto.randomUUID()}`;
  waitUntil(
    kv
      .put(key, JSON.stringify(entry), { expirationTtl: 7 * 24 * 60 * 60 })
      .catch((err) => console.error("Audit log write failed:", err)),
  );
}

// ---------------------------------------------------------------------------
// Rate limiting (per-IP via KV; fail-closed when not in demo mode)
// ---------------------------------------------------------------------------

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

function parseLimit(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value ?? String(fallback), 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

async function checkRateLimit(ipHash: string, env: AiChatEnv): Promise<RateLimitResult> {
  const now = Date.now();
  const perMinute = parseLimit(env.RATE_LIMIT_PER_MINUTE, DEFAULT_PER_MINUTE);
  const perDay = parseLimit(env.RATE_LIMIT_PER_DAY, DEFAULT_PER_DAY);
  // aiChatGlobalDailyLimit defaults to false (unbounded). Set it to a finite number
  // in settings.ts before going non-demo, or a single day of traffic may exhaust your
  // Anthropic API budget across all callers combined.
  const globalDailyLimit = settings.aiChatGlobalDailyLimit as number | false;

  const minBucket = Math.floor(now / MS_PER_MINUTE);
  const dayBucket = Math.floor(now / MS_PER_DAY);
  const minKey = `rate:min:${ipHash}:${minBucket}`;
  const dayKey = `rate:day:${ipHash}:${dayBucket}`;
  const globalDayKey = globalDailyLimit !== false ? `rate:global:${dayBucket}` : null;

  let minCount: number;
  let dayCount: number;
  let globalDayCount: number;
  try {
    const parseCount = (v: string | null): number => {
      const n = parseInt(v ?? "0", 10);
      return Number.isNaN(n) ? 0 : n;
    };
    const reads: Promise<number>[] = [
      env.RATE_LIMIT.get(minKey).then(parseCount),
      env.RATE_LIMIT.get(dayKey).then(parseCount),
    ];
    if (globalDayKey !== null) {
      reads.push(env.RATE_LIMIT.get(globalDayKey).then(parseCount));
    }
    const results = await Promise.all(reads);
    minCount = results[0]!;
    dayCount = results[1]!;
    globalDayCount = results[2] ?? 0;
  } catch (err) {
    // Fail-CLOSED on KV error (#1918): a KV outage must not unlock unbounded API spend.
    // This deliberately diverges from search-worker/src/rate-limit.ts, which fails OPEN
    // because search has no metered per-call cost — callers get degraded rate-guard,
    // not blocked results. Here the cost is real (Anthropic API tokens), so we block.
    // In demo mode the rate limiter is never reached (demo short-circuit is first),
    // so this branch is always non-demo in practice.
    console.error(
      `Rate limit KV read failed, ${settings.aiChatDemoMode ? "allowing" : "blocking"} request:`,
      err,
    );
    return { allowed: settings.aiChatDemoMode };
  }

  if (minCount >= perMinute) {
    const secondsIntoMinute = Math.floor((now % MS_PER_MINUTE) / 1000);
    return { allowed: false, retryAfter: Math.max(1, SECONDS_PER_MINUTE - secondsIntoMinute) };
  }

  if (dayCount >= perDay) {
    const secondsIntoDay = Math.floor((now % MS_PER_DAY) / 1000);
    return { allowed: false, retryAfter: Math.max(1, SECONDS_PER_DAY - secondsIntoDay) };
  }

  if (globalDailyLimit !== false && globalDayCount >= globalDailyLimit) {
    const secondsIntoDay = Math.floor((now % MS_PER_DAY) / 1000);
    return { allowed: false, retryAfter: Math.max(1, SECONDS_PER_DAY - secondsIntoDay) };
  }

  // Increment counters (not atomic, acceptable for best-effort limiting).
  const writes: Promise<void>[] = [
    env.RATE_LIMIT.put(minKey, String(minCount + 1), { expirationTtl: MINUTE_KEY_TTL }),
    env.RATE_LIMIT.put(dayKey, String(dayCount + 1), { expirationTtl: DAY_KEY_TTL }),
  ];
  if (globalDayKey !== null) {
    writes.push(
      env.RATE_LIMIT.put(globalDayKey, String(globalDayCount + 1), {
        expirationTtl: DAY_KEY_TTL,
      }),
    );
  }
  const writeResults = await Promise.allSettled(writes);
  for (const r of writeResults) {
    if (r.status === "rejected") {
      console.error("Rate limit KV write failed:", r.reason);
    }
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Claude API call (raw fetch — no SDK, keeps CF Workers bundle lean)
// ---------------------------------------------------------------------------

async function callClaude(
  message: string,
  history: ChatMessage[],
  env: AiChatEnv,
): Promise<string> {
  const docsContent = await fetchDocsContext(env.DOCS_SITE_URL);
  const requestBody = buildClaudeRequestBody(message, history, docsContent);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorText}`);
  }

  const data: unknown = await response.json();
  if (!isClaudeApiResponse(data)) {
    throw new Error("Unexpected Claude API response shape");
  }
  const textBlock = data.content.find((b): b is ClaudeTextBlock => b.type === "text");
  if (!textBlock) throw new Error("No text response from Claude");
  return textBlock.text;
}

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

/** Runtime type guard for the Claude API response shape. Prevents laundering an
 *  untrusted `response.json()` value into ClaudeApiResponse via a bare cast. */
function isClaudeApiResponse(data: unknown): data is ClaudeApiResponse {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.content) && typeof d.stop_reason === "string";
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
