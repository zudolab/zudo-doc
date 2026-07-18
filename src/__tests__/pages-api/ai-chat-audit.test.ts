/**
 * ai-chat-audit.test.ts
 *
 * Unit tests for hashIp() in pages/api/_ai-chat-audit.ts.
 *
 * Covers the two IP-hashing paths (#2038):
 *   - fallback: no IP_HASH_SECRET → unsalted SHA-256 (must stay byte-for-byte
 *     identical to pre-#2038 behaviour so existing deployments are unaffected)
 *   - HMAC: IP_HASH_SECRET present → HMAC-SHA-256 keyed by the secret
 */

import { describe, it, expect, vi } from "vitest";
import { fireAuditLog, hashIp } from "../../../pages/api/_ai-chat-audit";

// Known SHA-256 vectors — proves the fallback path is plain unsalted SHA-256.
const SHA256_EMPTY =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("hashIp — fallback (no secret)", () => {
  it("produces unsalted SHA-256 (known empty-string vector)", async () => {
    expect(await hashIp("")).toBe(SHA256_EMPTY);
  });

  it("treats an empty-string secret as 'not provisioned' (fallback path)", async () => {
    expect(await hashIp("1.2.3.4", "")).toBe(await hashIp("1.2.3.4"));
  });

  it("is deterministic and emits a 64-char hex digest", async () => {
    const a = await hashIp("203.0.113.7");
    const b = await hashIp("203.0.113.7");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("hashIp — HMAC (secret present)", () => {
  it("differs from the unsalted fallback for the same IP", async () => {
    const fallback = await hashIp("203.0.113.7");
    const hmac = await hashIp("203.0.113.7", "s3cr3t");
    expect(hmac).not.toBe(fallback);
    expect(hmac).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same IP + secret", async () => {
    const a = await hashIp("203.0.113.7", "s3cr3t");
    const b = await hashIp("203.0.113.7", "s3cr3t");
    expect(a).toBe(b);
  });

  it("changes when the secret rotates (old KV keys are invalidated)", async () => {
    const a = await hashIp("203.0.113.7", "secret-v1");
    const b = await hashIp("203.0.113.7", "secret-v2");
    expect(a).not.toBe(b);
  });
});

describe("fireAuditLog — privacy-safe persistence", () => {
  it("persists only timestamp, outcome, and a bounded reason enum", async () => {
    const writes: Array<{ key: string; value: string; ttl?: number }> = [];
    let pending: Promise<unknown> | undefined;
    const kv = {
      get: vi.fn(async () => null),
      put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number }) => {
        writes.push({ key, value, ttl: options?.expirationTtl });
      }),
    };

    fireAuditLog(
      (promise) => {
        pending = promise;
      },
      kv,
      {
        timestamp: "2026-07-16T12:34:56.000Z",
        outcome: "blocked",
        blockReason: "prompt_injection",
      },
    );
    await pending;

    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0]!.value)).toEqual({
      timestamp: "2026-07-16T12:34:56.000Z",
      outcome: "blocked",
      blockReason: "prompt_injection",
    });
    expect(writes[0]!.ttl).toBe(7 * 24 * 60 * 60);
    const persisted = writes[0]!.value;
    for (const sentinel of [
      "private prompt",
      "private response",
      "203.0.113.42",
      SHA256_EMPTY,
      "sk-ant-secret",
    ]) {
      expect(persisted).not.toContain(sentinel);
    }
  });

  it("does not expose a rejected KV error in console output", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let pending: Promise<unknown> | undefined;
    const kv = {
      get: vi.fn(async () => null),
      put: vi.fn(async () => {
        throw new Error("private provider response sk-ant-secret");
      }),
    };

    fireAuditLog(
      (promise) => {
        pending = promise;
      },
      kv,
      { timestamp: "2026-07-16T12:34:56.000Z", outcome: "completed" },
    );
    await pending;

    expect(error).toHaveBeenCalledWith({
      event: "ai_chat_audit_write",
      outcome: "failed",
      utc_day: "2026-07-16",
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain("private provider response");
    expect(JSON.stringify(error.mock.calls)).not.toContain("sk-ant-secret");
  });
});
