// pages/api/_ai-chat-rate-limit.ts
//
// Approximate per-IP rate limiting via KV for the ai-chat route.
// Fails CLOSED on KV error when not in demo mode (#1918): a KV outage must not
// unlock unbounded API spend. This deliberately diverges from
// search-worker/src/rate-limit.ts, which fails OPEN because search has no
// metered per-call cost.

import type { AiChatEnv } from "./_ai-chat-types";

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const SECONDS_PER_MINUTE = MS_PER_MINUTE / 1000;
const SECONDS_PER_DAY = MS_PER_DAY / 1000;
const MINUTE_KEY_TTL = 2 * SECONDS_PER_MINUTE;
const DAY_KEY_TTL = 2 * SECONDS_PER_DAY;
const DEFAULT_PER_MINUTE = 10;
const DEFAULT_PER_DAY = 100;

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export function parseLimit(value: string | undefined, fallback: number): number {
  if (value !== undefined) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      console.warn(
        `parseLimit: env value ${JSON.stringify(value)} is not a positive integer; using default ${fallback}`,
      );
      return fallback;
    }
    return parsed;
  }
  return fallback;
}

export async function checkRateLimit(ipHash: string, env: AiChatEnv): Promise<RateLimitResult> {
  const now = Date.now();
  const perMinute = parseLimit(env.RATE_LIMIT_PER_MINUTE, DEFAULT_PER_MINUTE);
  const perDay = parseLimit(env.RATE_LIMIT_PER_DAY, DEFAULT_PER_DAY);
  const minBucket = Math.floor(now / MS_PER_MINUTE);
  const dayBucket = Math.floor(now / MS_PER_DAY);
  const minKey = `rate:min:${ipHash}:${minBucket}`;
  const dayKey = `rate:day:${ipHash}:${dayBucket}`;

  let minCount: number;
  let dayCount: number;
  try {
    const parseCount = (v: string | null): number => {
      const n = parseInt(v ?? "0", 10);
      return Number.isNaN(n) ? 0 : n;
    };
    const reads: Promise<number>[] = [
      env.RATE_LIMIT.get(minKey).then(parseCount),
      env.RATE_LIMIT.get(dayKey).then(parseCount),
    ];
    const results = await Promise.all(reads);
    minCount = results[0]!;
    dayCount = results[1]!;
  } catch (err) {
    // Fail-CLOSED on KV error (#1918): a KV outage must not unlock unbounded API spend.
    // This deliberately diverges from search-worker/src/rate-limit.ts, which fails OPEN
    // because search has no metered per-call cost — callers get degraded rate-guard,
    // not blocked results. Here the cost is real (Anthropic API tokens), so we block.
    // Demo mode short-circuits before this helper, so every call here is a
    // non-demo request and must fail closed.
    console.error("Rate limit KV read failed, blocking request:", err);
    return { allowed: false };
  }

  if (minCount >= perMinute) {
    const secondsIntoMinute = Math.floor((now % MS_PER_MINUTE) / 1000);
    return { allowed: false, retryAfter: Math.max(1, SECONDS_PER_MINUTE - secondsIntoMinute) };
  }

  if (dayCount >= perDay) {
    const secondsIntoDay = Math.floor((now % MS_PER_DAY) / 1000);
    return { allowed: false, retryAfter: Math.max(1, SECONDS_PER_DAY - secondsIntoDay) };
  }

  // Increment counters (non-atomic read-modify-write: KV has no CAS primitive).
  // Worst-case overshoot ≈ the number of concurrent in-flight requests from the
  // same IP within the same window — typically 1-2 for a chat UI.
  // These counters are therefore SOFT guards against casual per-IP over-use.
  // The exact global paid-call admission cap is enforced separately by the
  // AI_CHAT_DAILY_SPEND_CAP Durable Object immediately before provider fetch.
  const writes: Promise<void>[] = [
    env.RATE_LIMIT.put(minKey, String(minCount + 1), { expirationTtl: MINUTE_KEY_TTL }),
    env.RATE_LIMIT.put(dayKey, String(dayCount + 1), { expirationTtl: DAY_KEY_TTL }),
  ];
  const writeResults = await Promise.allSettled(writes);
  for (const r of writeResults) {
    if (r.status === "rejected") {
      console.error("Rate limit KV write failed:", r.reason);
    }
  }

  return { allowed: true };
}
