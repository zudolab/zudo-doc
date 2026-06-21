// pages/api/_ai-chat-client.ts
//
// Claude API client for the ai-chat route.
// Uses raw fetch (no SDK) to keep the CF Workers bundle lean.

import { buildClaudeRequestBody } from "./_ai-chat-payload";
import type { AiChatEnv, ChatMessage, ClaudeTextBlock, ClaudeApiResponse } from "./_ai-chat-types";

// ---------------------------------------------------------------------------
// Docs context (in-memory cache, best-effort for CF Workers isolate lifespan)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Negative-cache backoff after a fetch failure (in ms).
 *
 * KV vs in-memory decision: we deliberately do NOT store the failure state in
 * the RATE_LIMIT KV namespace (or a new binding). Reasons:
 *   1. A KV put/get per chat request adds latency and cost for a signal that
 *      is already captured more cheaply in module memory.
 *   2. The RATE_LIMIT KV namespace is semantically rate-limiting, not a
 *      general-purpose cache; reusing it for failure state couples unrelated
 *      concerns and complicates the key space.
 *   3. CF Workers isolates are single-threaded; module-level state is
 *      sufficient to coalesce failures within the same isolate, which is the
 *      primary thundering-herd scenario we are defending against. Cross-isolate
 *      coalescing would require KV but is not needed here — each isolate caps
 *      at one in-flight fetch anyway, and isolate recycling is infrequent.
 * A 30-second window is short enough to recover quickly from transient blips
 * while preventing a flood of outbound fetches during a longer outage.
 */
const NEGATIVE_CACHE_TTL_MS = 30 * 1000;

let cachedDocsContext: string | null = null;
let cachedAt = 0;
/** Timestamp of the most recent docs-fetch failure; 0 when no failure is recorded. */
let failedAt = 0;
/** In-flight promise for the current fetch; null when no fetch is running. */
let inflightPromise: Promise<string> | null = null;

export async function fetchDocsContext(docsUrl: string): Promise<string> {
  const now = Date.now();

  // Positive-cache hit: context loaded successfully and TTL has not expired.
  if (cachedDocsContext !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedDocsContext;
  }

  // Negative-cache hit: the previous fetch failed within the backoff window.
  // Propagate the same error so concurrent callers do not each launch an
  // independent fetch against a URL that is known to be unreachable.
  if (inflightPromise !== null && failedAt > 0 && now - failedAt < NEGATIVE_CACHE_TTL_MS) {
    return inflightPromise;
  }

  // If there is already an in-flight fetch (not yet resolved) coalesce onto it.
  // This prevents concurrent cold-isolate requests each launching their own fetch.
  if (inflightPromise !== null && failedAt === 0) {
    return inflightPromise;
  }

  // No valid cache or in-flight request — start a new fetch.
  failedAt = 0;
  const url = `${docsUrl.replace(/\/$/, "")}/llms-full.txt`;
  inflightPromise = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch docs context: ${response.status}`);
      }
      const text = await response.text();
      cachedDocsContext = text;
      cachedAt = Date.now();
      failedAt = 0;
      inflightPromise = null;
      return text;
    })
    .catch((err: unknown) => {
      // Record failure timestamp for the negative-cache window.
      // Keep inflightPromise set so the negative-cache branch above can
      // return the same rejected promise to subsequent callers within the
      // backoff window, instead of each launching a new fetch.
      failedAt = Date.now();
      throw err;
    });

  return inflightPromise;
}

// ---------------------------------------------------------------------------
// Runtime type guard
// ---------------------------------------------------------------------------

/** Runtime type guard for the Claude API response shape. Prevents laundering an
 *  untrusted `response.json()` value into ClaudeApiResponse via a bare cast. */
export function isClaudeApiResponse(data: unknown): data is ClaudeApiResponse {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.content) && typeof d.stop_reason === "string";
}

// ---------------------------------------------------------------------------
// Claude API call
// ---------------------------------------------------------------------------

export async function callClaude(
  message: string,
  history: ChatMessage[],
  env: AiChatEnv,
): Promise<string> {
  // DOCS_SITE_URL must be a non-empty absolute http(s) URL set via wrangler.toml
  // (see Workers Cutover Runbook step 3). An absent/malformed value would silently
  // fetch `undefined/llms-full.txt` or a relative path, making the failure very
  // hard to diagnose.
  if (
    !env.DOCS_SITE_URL ||
    !/^https?:\/\/.+/.test(env.DOCS_SITE_URL)
  ) {
    throw new Error(
      `DOCS_SITE_URL is not set or not a valid http(s) URL (got: ${JSON.stringify(env.DOCS_SITE_URL)}). ` +
        "Set it in wrangler.toml or via --var DOCS_SITE_URL=<url>.",
    );
  }
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
    throw new Error(`Claude API error ${response.status}: ${errorText.slice(0, 500)}`);
  }

  const data: unknown = await response.json();
  if (!isClaudeApiResponse(data)) {
    throw new Error("Unexpected Claude API response shape");
  }
  const textBlock = data.content.find((b): b is ClaudeTextBlock => b.type === "text");
  if (!textBlock) throw new Error("No text response from Claude");
  return textBlock.text;
}
