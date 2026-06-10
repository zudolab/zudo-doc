// pages/api/_ai-chat-rate-limit.ts
//
// Per-IP rate limiting via KV for the ai-chat route.
// Fails CLOSED on KV error when not in demo mode (#1918): a KV outage must not
// unlock unbounded API spend. This deliberately diverges from
// search-worker/src/rate-limit.ts, which fails OPEN because search has no
// metered per-call cost.

import { settings } from "@/config/settings";
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
  const parsed = parseInt(value ?? String(fallback), 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

export async function checkRateLimit(ipHash: string, env: AiChatEnv): Promise<RateLimitResult> {
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
