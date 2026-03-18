import type { Env } from "./types";

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const SECONDS_PER_MINUTE = MS_PER_MINUTE / 1000;
const SECONDS_PER_DAY = MS_PER_DAY / 1000;

const MINUTE_KEY_TTL = 2 * SECONDS_PER_MINUTE;
const DAY_KEY_TTL = 2 * SECONDS_PER_DAY;

const DEFAULT_PER_MINUTE = 60;
const DEFAULT_PER_DAY = 1000;

function parseLimit(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value || String(fallback), 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

export async function checkRateLimit(
  ipHash: string,
  env: Env,
): Promise<RateLimitResult> {
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
      const n = parseInt(v || "0", 10);
      return Number.isNaN(n) ? 0 : n;
    };
    [minCount, dayCount] = await Promise.all([
      env.RATE_LIMIT.get(minKey).then(parseCount),
      env.RATE_LIMIT.get(dayKey).then(parseCount),
    ]);
  } catch (err) {
    console.error("Rate limit KV read failed, allowing request:", err);
    return { allowed: true };
  }

  if (minCount >= perMinute) {
    const secondsIntoMinute = Math.floor((now % MS_PER_MINUTE) / 1000);
    return { allowed: false, retryAfter: Math.max(1, SECONDS_PER_MINUTE - secondsIntoMinute) };
  }

  if (dayCount >= perDay) {
    const secondsIntoDay = Math.floor((now % MS_PER_DAY) / 1000);
    return { allowed: false, retryAfter: Math.max(1, SECONDS_PER_DAY - secondsIntoDay) };
  }

  const results = await Promise.allSettled([
    env.RATE_LIMIT.put(minKey, String(minCount + 1), { expirationTtl: MINUTE_KEY_TTL }),
    env.RATE_LIMIT.put(dayKey, String(dayCount + 1), { expirationTtl: DAY_KEY_TTL }),
  ]);
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("Rate limit KV write failed:", r.reason);
    }
  }

  return { allowed: true };
}
