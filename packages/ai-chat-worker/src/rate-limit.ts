import type { Env } from "./types";

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

// KV read-check-write is not atomic — concurrent requests from the same IP
// may both pass before either increments. This is acceptable for a
// best-effort limiter; use Durable Objects if exact counting is needed.

export async function checkRateLimit(
  ip: string,
  env: Env,
): Promise<RateLimitResult> {
  const now = Date.now();
  const perMinute = parseInt(env.RATE_LIMIT_PER_MINUTE || "10", 10);
  const perDay = parseInt(env.RATE_LIMIT_PER_DAY || "100", 10);

  const minBucket = Math.floor(now / 60_000);
  const dayBucket = Math.floor(now / 86_400_000);
  const minKey = `rate:min:${ip}:${minBucket}`;
  const dayKey = `rate:day:${ip}:${dayBucket}`;

  const [minCount, dayCount] = await Promise.all([
    env.RATE_LIMIT.get(minKey).then((v) => parseInt(v || "0", 10)),
    env.RATE_LIMIT.get(dayKey).then((v) => parseInt(v || "0", 10)),
  ]);

  if (minCount >= perMinute) {
    const secondsIntoMinute = Math.floor((now % 60_000) / 1000);
    return { allowed: false, retryAfter: 60 - secondsIntoMinute };
  }

  if (dayCount >= perDay) {
    const secondsIntoDay = Math.floor((now % 86_400_000) / 1000);
    return { allowed: false, retryAfter: 86_400 - secondsIntoDay };
  }

  // Increment both counters
  await Promise.all([
    env.RATE_LIMIT.put(minKey, String(minCount + 1), { expirationTtl: 120 }),
    env.RATE_LIMIT.put(dayKey, String(dayCount + 1), {
      expirationTtl: 172_800,
    }),
  ]);

  return { allowed: true };
}
