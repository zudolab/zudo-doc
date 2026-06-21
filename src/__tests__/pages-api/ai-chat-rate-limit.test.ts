/**
 * ai-chat-rate-limit.test.ts
 *
 * Unit tests for pages/api/_ai-chat-rate-limit.ts.
 *
 * Covered:
 *   - parseLimit — valid values, NaN/negative fallback, undefined fallback
 *   - checkRateLimit — allow when below limits; deny (per-minute, per-day, global)
 *     with retryAfter; KV fail-CLOSED behaviour; global daily limit path
 *
 * No real KV, no real Cloudflare globals. Settings are mocked so the
 * globalDailyLimit path can be exercised.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — declared before module import so vi.mock hoisting works
// ---------------------------------------------------------------------------

const mockSettingsValues = {
  aiChatDemoMode: false,
  aiChatGlobalDailyLimit: false as number | false,
};

vi.mock("@/config/settings", () => ({
  get settings() {
    return mockSettingsValues;
  },
}));

// ---------------------------------------------------------------------------
// Import module under test (after mocks)
// ---------------------------------------------------------------------------

import { parseLimit, checkRateLimit } from "../../../pages/api/_ai-chat-rate-limit";
import type { AiChatEnv } from "../../../pages/api/_ai-chat-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockKV {
  data: Map<string, string>;
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
}

function makeMockKV(): MockKV {
  const data = new Map<string, string>();
  return {
    data,
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
  };
}

function makeEnv(kv: MockKV, perMinute?: string, perDay?: string): AiChatEnv {
  return {
    ANTHROPIC_API_KEY: "test-key",
    DOCS_SITE_URL: "https://example.com",
    RATE_LIMIT: kv,
    RATE_LIMIT_PER_MINUTE: perMinute,
    RATE_LIMIT_PER_DAY: perDay,
  };
}

// ---------------------------------------------------------------------------
// beforeEach
// ---------------------------------------------------------------------------

let mockKV: MockKV;

beforeEach(() => {
  vi.clearAllMocks();
  mockKV = makeMockKV();
  mockSettingsValues.aiChatDemoMode = false;
  mockSettingsValues.aiChatGlobalDailyLimit = false;
});

// ---------------------------------------------------------------------------
// parseLimit
// ---------------------------------------------------------------------------

describe("parseLimit", () => {
  it("returns the parsed integer when value is a valid positive string", () => {
    expect(parseLimit("5", 10)).toBe(5);
    expect(parseLimit("100", 10)).toBe(100);
    expect(parseLimit("1", 10)).toBe(1);
  });

  it("returns fallback when value is undefined", () => {
    expect(parseLimit(undefined, 10)).toBe(10);
    expect(parseLimit(undefined, 42)).toBe(42);
  });

  it("returns fallback when value parses to NaN", () => {
    expect(parseLimit("abc", 10)).toBe(10);
    expect(parseLimit("", 10)).toBe(10);
  });

  it("returns fallback when value is zero or negative", () => {
    expect(parseLimit("0", 10)).toBe(10);
    expect(parseLimit("-1", 10)).toBe(10);
    expect(parseLimit("-100", 10)).toBe(10);
  });

  it("truncates floats (parseInt semantics)", () => {
    // parseInt("3.9") === 3 which is > 0, so it is accepted
    expect(parseLimit("3.9", 10)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// checkRateLimit — allow path
// ---------------------------------------------------------------------------

describe("checkRateLimit — allow path", () => {
  it("returns { allowed: true } when KV has no prior counts", async () => {
    const env = makeEnv(mockKV);
    const result = await checkRateLimit("hash123", env);
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it("increments both min and day KV keys after an allowed request", async () => {
    const env = makeEnv(mockKV, "10", "100");
    await checkRateLimit("hash123", env);
    expect(mockKV.put).toHaveBeenCalledTimes(2);
    // Verify key naming: rate:min:... and rate:day:...
    const keys = (mockKV.put as ReturnType<typeof vi.fn>).mock.calls.map(
      ([key]: [string]) => key,
    );
    expect(keys.some((k: string) => k.startsWith("rate:min:"))).toBe(true);
    expect(keys.some((k: string) => k.startsWith("rate:day:"))).toBe(true);
  });

  it("uses bucket = floor(now / 60000) for per-minute key", async () => {
    const env = makeEnv(mockKV, "10", "100");
    const before = Math.floor(Date.now() / 60_000);
    await checkRateLimit("hashABC", env);
    const after = Math.floor(Date.now() / 60_000);
    const keys: string[] = (mockKV.put as ReturnType<typeof vi.fn>).mock.calls.map(
      ([k]: [string]) => k,
    );
    const minKey = keys.find((k) => k.startsWith("rate:min:"))!;
    // Key format: rate:min:{ipHash}:{bucket}
    const bucket = parseInt(minKey.split(":")[3]!, 10);
    expect(bucket).toBeGreaterThanOrEqual(before);
    expect(bucket).toBeLessThanOrEqual(after);
  });

  it("uses bucket = floor(now / 86400000) for per-day key", async () => {
    const env = makeEnv(mockKV, "10", "100");
    const before = Math.floor(Date.now() / 86_400_000);
    await checkRateLimit("hashABC", env);
    const after = Math.floor(Date.now() / 86_400_000);
    const keys: string[] = (mockKV.put as ReturnType<typeof vi.fn>).mock.calls.map(
      ([k]: [string]) => k,
    );
    const dayKey = keys.find((k) => k.startsWith("rate:day:"))!;
    const bucket = parseInt(dayKey.split(":")[3]!, 10);
    expect(bucket).toBeGreaterThanOrEqual(before);
    expect(bucket).toBeLessThanOrEqual(after);
  });

  it("allows when count is exactly one below the per-minute limit", async () => {
    // limit = 3; pre-populate count = 2 → still allowed
    mockKV.get.mockImplementation(async (key: string) => {
      if (key.startsWith("rate:min:")) return "2";
      return null;
    });
    const env = makeEnv(mockKV, "3", "100");
    const result = await checkRateLimit("hash123", env);
    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkRateLimit — deny paths
// ---------------------------------------------------------------------------

describe("checkRateLimit — deny (per-minute exceeded)", () => {
  it("returns allowed=false with retryAfter when per-minute count >= limit", async () => {
    mockKV.get.mockImplementation(async (key: string) => {
      if (key.startsWith("rate:min:")) return "10"; // at limit (default 10)
      return null;
    });
    const env = makeEnv(mockKV); // uses defaults: perMin=10, perDay=100
    const result = await checkRateLimit("hash123", env);
    expect(result.allowed).toBe(false);
    expect(typeof result.retryAfter).toBe("number");
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
    expect(result.retryAfter).toBeLessThanOrEqual(60);
  });

  it("does NOT increment KV when denied", async () => {
    mockKV.get.mockImplementation(async (key: string) => {
      if (key.startsWith("rate:min:")) return "10";
      return null;
    });
    const env = makeEnv(mockKV);
    await checkRateLimit("hash123", env);
    expect(mockKV.put).not.toHaveBeenCalled();
  });

  it("returns allowed=false when per-minute count exceeds limit (not just equals)", async () => {
    mockKV.get.mockImplementation(async (key: string) => {
      if (key.startsWith("rate:min:")) return "99";
      return null;
    });
    const env = makeEnv(mockKV, "5", "100");
    const result = await checkRateLimit("hash123", env);
    expect(result.allowed).toBe(false);
  });
});

describe("checkRateLimit — deny (per-day exceeded)", () => {
  it("returns allowed=false with retryAfter when per-day count >= limit", async () => {
    mockKV.get.mockImplementation(async (key: string) => {
      if (key.startsWith("rate:min:")) return "0"; // minute ok
      if (key.startsWith("rate:day:")) return "100"; // day at limit (default 100)
      return null;
    });
    const env = makeEnv(mockKV);
    const result = await checkRateLimit("hash123", env);
    expect(result.allowed).toBe(false);
    expect(typeof result.retryAfter).toBe("number");
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("retryAfter for day limit is in [1, 86400] range", async () => {
    mockKV.get.mockImplementation(async (key: string) => {
      if (key.startsWith("rate:day:")) return "100";
      return null;
    });
    const env = makeEnv(mockKV, "999", "100");
    const result = await checkRateLimit("hash123", env);
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
    expect(result.retryAfter).toBeLessThanOrEqual(86400);
  });
});

describe("checkRateLimit — global daily limit", () => {
  it("returns allowed=false when global daily count >= globalDailyLimit", async () => {
    mockSettingsValues.aiChatGlobalDailyLimit = 50;
    mockKV.get.mockImplementation(async (key: string) => {
      if (key.startsWith("rate:global:")) return "50"; // at global limit
      return null;
    });
    const env = makeEnv(mockKV, "999", "999");
    const result = await checkRateLimit("hash123", env);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("writes global counter key when globalDailyLimit is set and allowed", async () => {
    mockSettingsValues.aiChatGlobalDailyLimit = 50;
    const env = makeEnv(mockKV, "999", "999");
    await checkRateLimit("hash123", env);
    const keys: string[] = (mockKV.put as ReturnType<typeof vi.fn>).mock.calls.map(
      ([k]: [string]) => k,
    );
    expect(keys.some((k) => k.startsWith("rate:global:"))).toBe(true);
  });

  it("does NOT write global counter key when globalDailyLimit is false", async () => {
    mockSettingsValues.aiChatGlobalDailyLimit = false;
    const env = makeEnv(mockKV, "999", "999");
    await checkRateLimit("hash123", env);
    const keys: string[] = (mockKV.put as ReturnType<typeof vi.fn>).mock.calls.map(
      ([k]: [string]) => k,
    );
    expect(keys.some((k) => k.startsWith("rate:global:"))).toBe(false);
  });

  it("reads global counter key when globalDailyLimit is set", async () => {
    mockSettingsValues.aiChatGlobalDailyLimit = 50;
    const env = makeEnv(mockKV, "999", "999");
    await checkRateLimit("hash123", env);
    const readKeys: string[] = (mockKV.get as ReturnType<typeof vi.fn>).mock.calls.map(
      ([k]: [string]) => k,
    );
    expect(readKeys.some((k) => k.startsWith("rate:global:"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkRateLimit — KV error / fail-CLOSED
// ---------------------------------------------------------------------------

describe("checkRateLimit — KV failure (fail-CLOSED)", () => {
  it("returns allowed=false when KV.get throws (non-demo mode)", async () => {
    mockKV.get.mockRejectedValue(new Error("KV unavailable"));
    const env = makeEnv(mockKV);
    const result = await checkRateLimit("hash123", env);
    expect(result.allowed).toBe(false);
  });

  it("returns allowed=true when KV.get throws in demo mode", async () => {
    mockSettingsValues.aiChatDemoMode = true;
    mockKV.get.mockRejectedValue(new Error("KV unavailable"));
    const env = makeEnv(mockKV);
    const result = await checkRateLimit("hash123", env);
    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkRateLimit — key-naming contract
// ---------------------------------------------------------------------------

describe("checkRateLimit — KV key format", () => {
  it("per-minute key matches rate:min:{ipHash}:{bucket}", async () => {
    const env = makeEnv(mockKV, "999", "999");
    await checkRateLimit("myIpHash", env);
    const readKeys: string[] = (mockKV.get as ReturnType<typeof vi.fn>).mock.calls.map(
      ([k]: [string]) => k,
    );
    const minKey = readKeys.find((k) => k.startsWith("rate:min:"))!;
    expect(minKey).toMatch(/^rate:min:myIpHash:\d+$/);
  });

  it("per-day key matches rate:day:{ipHash}:{bucket}", async () => {
    const env = makeEnv(mockKV, "999", "999");
    await checkRateLimit("myIpHash", env);
    const readKeys: string[] = (mockKV.get as ReturnType<typeof vi.fn>).mock.calls.map(
      ([k]: [string]) => k,
    );
    const dayKey = readKeys.find((k) => k.startsWith("rate:day:"))!;
    expect(dayKey).toMatch(/^rate:day:myIpHash:\d+$/);
  });
});
