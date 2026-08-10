// End-to-end auth contract against a REAL migrated D1 database
// (vitest-pool-workers): sign-up / sign-in / bearer-gated route / sign-out.
// These run the actual Hono app, not a stub, so they also prove the route
// registration order in index.ts (Better Auth before the session gate).
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthEnv } from "../auth";
import app from "../index";

const BASE_URL = "http://localhost:8787";

const TEST_ENV: AuthEnv = {
  DB: env.DB,
  BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
  BETTER_AUTH_URL: BASE_URL,
};

function request(path: string, init?: RequestInit, bindings: AuthEnv = TEST_ENV) {
  return app.request(`${BASE_URL}${path}`, init, bindings);
}

function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const PASSWORD = "correct-horse-battery-staple";

let emailCounter = 0;
let email = "";

beforeEach(() => {
  emailCounter += 1;
  email = `user-${emailCounter}-${Date.now()}@example.com`;
});

function signUp(address = email, password = PASSWORD) {
  return postJson("/api/auth/sign-up/email", {
    name: "Test User",
    email: address,
    password,
  });
}

async function signUpAndGetToken(): Promise<string> {
  const res = await signUp();
  expect(res.status).toBe(200);
  const token = res.headers.get("set-auth-token");
  expect(token).toBeTruthy();
  return token as string;
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function sessionCookie(): Promise<string> {
  const res = await signUp();
  expect(res.status).toBe(200);
  const setCookie = res.headers.get("set-cookie");
  expect(setCookie).toBeTruthy();
  return (setCookie as string).split(";")[0] as string;
}

describe("sign-up", () => {
  it("returns 200 and issues a bearer token via the set-auth-token header", async () => {
    const res = await signUp();

    expect(res.status).toBe(200);
    expect(res.headers.get("set-auth-token")).toBeTruthy();
  });

  it("rejects a duplicate email with a 4xx", async () => {
    expect((await signUp()).status).toBe(200);

    const duplicate = await signUp();

    expect(duplicate.status).toBeGreaterThanOrEqual(400);
    expect(duplicate.status).toBeLessThan(500);
  });
});

describe("sign-in", () => {
  it("rejects a wrong password with 4xx and leaves an existing session usable", async () => {
    const token = await signUpAndGetToken();

    const failed = await postJson("/api/auth/sign-in/email", {
      email,
      password: "totally-the-wrong-password",
    });

    expect(failed.status).toBeGreaterThanOrEqual(400);
    expect(failed.status).toBeLessThan(500);

    // A failed sign-in must not revoke sessions issued earlier.
    const me = await request("/api/me", { headers: bearer(token) });
    expect(me.status).toBe(200);
  });
});

describe("GET /api/me (bearer-gated)", () => {
  it("returns the authenticated user for a valid token", async () => {
    const token = await signUpAndGetToken();

    const res = await request("/api/me", { headers: bearer(token) });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { id: expect.any(String), email, name: "Test User" },
    });
  });

  it("returns 401 when the Authorization header is absent", async () => {
    const res = await request("/api/me");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "unauthorized", message: expect.any(String) },
    });
  });

  it("returns 401 for a garbage bearer token", async () => {
    const res = await request("/api/me", { headers: bearer("not-a-real-token") });

    expect(res.status).toBe(401);
  });

  it("returns 401 for a malformed Authorization header", async () => {
    const token = await signUpAndGetToken();

    const res = await request("/api/me", { headers: { Authorization: token } });

    expect(res.status).toBe(401);
  });

  it("returns 401 for a Bearer scheme with an empty token", async () => {
    const res = await request("/api/me", { headers: { Authorization: "Bearer " } });

    expect(res.status).toBe(401);
  });

  it("accepts a lowercase bearer scheme (HTTP auth schemes are case-insensitive)", async () => {
    const token = await signUpAndGetToken();

    const res = await request("/api/me", {
      headers: { Authorization: `bearer ${token}` },
    });

    expect(res.status).toBe(200);
  });

  // A session cookie resolves a session perfectly well through
  // auth.api.getSession — these two lock in that /api/me nonetheless accepts
  // the bearer token and nothing else, whether the cookie arrives alone or
  // alongside a bad token.
  it("rejects a valid session cookie with no bearer token", async () => {
    const res = await request("/api/me", { headers: { Cookie: await sessionCookie() } });

    expect(res.status).toBe(401);
  });

  it("does not let a session cookie substitute for an invalid bearer token", async () => {
    const res = await request("/api/me", {
      headers: {
        Cookie: await sessionCookie(),
        Authorization: "Bearer not-a-real-token",
      },
    });

    expect(res.status).toBe(401);
  });

  it("fails closed with 401 (not 500) when session resolution throws", async () => {
    const token = await signUpAndGetToken();
    const brokenDb = {
      prepare() {
        throw new Error("D1 unavailable");
      },
    } as unknown as D1Database;

    const res = await request("/api/me", { headers: bearer(token) }, {
      ...TEST_ENV,
      DB: brokenDb,
    });

    expect(res.status).toBe(401);
  });
});

describe("Better Auth endpoints stay ungated", () => {
  it("resolves the session via /api/auth/get-session with the bearer token", async () => {
    const token = await signUpAndGetToken();

    const res = await request("/api/auth/get-session", { headers: bearer(token) });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { user?: { email?: string } } | null;
    expect(body?.user?.email).toBe(email);
  });

  it("keeps /api/health reachable without a token", async () => {
    const res = await request("/api/health");

    expect(res.status).toBe(200);
  });
});

describe("sign-out", () => {
  it("revokes the token so it no longer opens /api/me", async () => {
    const token = await signUpAndGetToken();
    expect((await request("/api/me", { headers: bearer(token) })).status).toBe(200);

    const out = await postJson("/api/auth/sign-out", {}, bearer(token));
    expect(out.status).toBe(200);

    const after = await request("/api/me", { headers: bearer(token) });
    expect(after.status).toBe(401);
  });
});
