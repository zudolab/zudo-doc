import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit } from "../rate-limit";
import { createMockKV, createMockEnv } from "./test-utils";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request", async () => {
    const env = createMockEnv();
    const result = await checkRateLimit("testhash", env);

    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it("allows requests within the per-minute limit", async () => {
    const env = createMockEnv();

    // Simulate 59 previous requests in the current minute bucket
    const now = Date.now();
    const minBucket = Math.floor(now / 60_000);
    env._kv._store.set(`rate:min:testhash:${minBucket}`, "59");
    env._kv._store.set(
      `rate:day:testhash:${Math.floor(now / 86_400_000)}`,
      "59",
    );

    const result = await checkRateLimit("testhash", env);
    expect(result.allowed).toBe(true);
  });

  it("blocks requests exceeding per-minute limit with retryAfter", async () => {
    const env = createMockEnv();

    const now = Date.now();
    const minBucket = Math.floor(now / 60_000);
    const dayBucket = Math.floor(now / 86_400_000);
    env._kv._store.set(`rate:min:testhash:${minBucket}`, "60");
    env._kv._store.set(`rate:day:testhash:${dayBucket}`, "60");

    const result = await checkRateLimit("testhash", env);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeDefined();
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(60);
  });

  it("blocks requests exceeding per-day limit", async () => {
    const env = createMockEnv();
    env.RATE_LIMIT_PER_DAY = "1000";

    const now = Date.now();
    const minBucket = Math.floor(now / 60_000);
    const dayBucket = Math.floor(now / 86_400_000);
    // Under minute limit but over day limit
    env._kv._store.set(`rate:min:testhash:${minBucket}`, "10");
    env._kv._store.set(`rate:day:testhash:${dayBucket}`, "1000");

    const result = await checkRateLimit("testhash", env);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeDefined();
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("is fail-open when KV read throws", async () => {
    const kv = createMockKV();
    kv.get = vi.fn().mockRejectedValue(new Error("KV unavailable"));
    const env = createMockEnv(kv);

    const result = await checkRateLimit("testhash", env);
    expect(result.allowed).toBe(true);
  });

  it("increments counters on allowed requests", async () => {
    const env = createMockEnv();

    await checkRateLimit("testhash", env);

    // put should be called twice (minute + day)
    expect(env._kv.put).toHaveBeenCalledTimes(2);
    expect(env._kv.put).toHaveBeenCalledWith(
      expect.stringContaining("rate:min:testhash:"),
      "1",
      expect.objectContaining({ expirationTtl: expect.any(Number) }),
    );
    expect(env._kv.put).toHaveBeenCalledWith(
      expect.stringContaining("rate:day:testhash:"),
      "1",
      expect.objectContaining({ expirationTtl: expect.any(Number) }),
    );
  });

  it("uses custom limits from env", async () => {
    const env = createMockEnv();
    env.RATE_LIMIT_PER_MINUTE = "5";

    const now = Date.now();
    const minBucket = Math.floor(now / 60_000);
    const dayBucket = Math.floor(now / 86_400_000);
    env._kv._store.set(`rate:min:testhash:${minBucket}`, "5");
    env._kv._store.set(`rate:day:testhash:${dayBucket}`, "5");

    const result = await checkRateLimit("testhash", env);
    expect(result.allowed).toBe(false);
  });
});
