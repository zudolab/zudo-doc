import { vi } from "vitest";
import type { Env } from "../types";

export function createMockKV() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(
      async (
        key: string,
        value: string,
        _opts?: { expirationTtl?: number },
      ) => {
        store.set(key, value);
      },
    ),
    _store: store,
  };
}

export type MockKV = ReturnType<typeof createMockKV>;

export function createMockEnv(kv = createMockKV()): Env & { _kv: MockKV } {
  return {
    DOCS_SITE_URL: "https://example.com",
    RATE_LIMIT_PER_MINUTE: "60",
    RATE_LIMIT_PER_DAY: "1000",
    RATE_LIMIT: kv as unknown as KVNamespace,
    _kv: kv,
  };
}
