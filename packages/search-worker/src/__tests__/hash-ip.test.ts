import { describe, it, expect } from "vitest";
import { hashIp } from "../hash-ip";

// Known SHA-256 vector — proves the fallback path is plain unsalted SHA-256.
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
