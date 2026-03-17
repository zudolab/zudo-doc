import type { Env } from "./types";

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_DAY = 86_400;

// TTL set to 2x the window so keys survive the full bucket period
const MINUTE_KEY_TTL = 120;
const DAY_KEY_TTL = 172_800;

const DEFAULT_PER_MINUTE = 10;
const DEFAULT_PER_DAY = 100;

function parseLimit(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value || String(fallback), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

// KV read-check-write is not atomic — concurrent requests from the same IP
// may both pass before either increments. This is acceptable for a
// best-effort limiter; use Durable Objects if exact counting is needed.
//
// On KV failure, the limiter fails open (allows the request) so that a KV
// outage doesn't take down the chat API entirely.

export async function checkRateLimit(
  ip: string,
  env: Env,
): Promise<RateLimitResult> {
  const now = Date.now();
  const perMinute = parseLimit(env.RATE_LIMIT_PER_MINUTE, DEFAULT_PER_MINUTE);
  const perDay = parseLimit(env.RATE_LIMIT_PER_DAY, DEFAULT_PER_DAY);

  const minBucket = Math.floor(now / MS_PER_MINUTE);
  const dayBucket = Math.floor(now / MS_PER_DAY);
  const minKey = `rate:min:${ip}:${minBucket}`;
  const dayKey = `rate:day:${ip}:${dayBucket}`;

  let minCount: number;
  let dayCount: number;
  try {
    [minCount, dayCount] = await Promise.all([
      env.RATE_LIMIT.get(minKey).then((v) => parseInt(v || "0", 10)),
      env.RATE_LIMIT.get(dayKey).then((v) => parseInt(v || "0", 10)),
    ]);
  } catch (err) {
    console.error("Rate limit KV read failed, allowing request:", err);
    return { allowed: true };
  }

  if (minCount >= perMinute) {
    const secondsIntoMinute = Math.floor((now % MS_PER_MINUTE) / 1000);
    return { allowed: false, retryAfter: SECONDS_PER_MINUTE - secondsIntoMinute };
  }

  if (dayCount >= perDay) {
    const secondsIntoDay = Math.floor((now % MS_PER_DAY) / 1000);
    return { allowed: false, retryAfter: SECONDS_PER_DAY - secondsIntoDay };
  }

  // Increment both counters (fire-and-forget — don't block the response)
  try {
    await Promise.all([
      env.RATE_LIMIT.put(minKey, String(minCount + 1), { expirationTtl: MINUTE_KEY_TTL }),
      env.RATE_LIMIT.put(dayKey, String(dayCount + 1), { expirationTtl: DAY_KEY_TTL }),
    ]);
  } catch (err) {
    console.error("Rate limit KV write failed:", err);
  }

  return { allowed: true };
}
