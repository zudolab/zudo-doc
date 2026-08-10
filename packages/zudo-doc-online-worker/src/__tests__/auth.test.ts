// Confirms createAuth() builds a real Better Auth instance from worker-pool
// bindings. No module-scope auth instance exists anywhere in src/ — D1
// bindings are request-scoped, so this factory must be called per request.
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuth } from "../auth";

describe("createAuth", () => {
  it("constructs successfully from worker-pool env bindings", () => {
    const auth = createAuth({
      DB: env.DB,
      BETTER_AUTH_SECRET: "test-secret",
      BETTER_AUTH_URL: "http://localhost:8787",
    });

    expect(auth.handler).toBeInstanceOf(Function);
    expect(auth.api).toBeTruthy();
  });

  it("builds a fresh instance on every call (no shared module-scope state)", () => {
    const first = createAuth({
      DB: env.DB,
      BETTER_AUTH_SECRET: "test-secret",
      BETTER_AUTH_URL: "http://localhost:8787",
    });
    const second = createAuth({
      DB: env.DB,
      BETTER_AUTH_SECRET: "test-secret",
      BETTER_AUTH_URL: "http://localhost:8787",
    });

    expect(first).not.toBe(second);
  });
});
