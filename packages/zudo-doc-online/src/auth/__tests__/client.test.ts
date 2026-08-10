import { describe, expect, it, vi } from "vitest";
import { AuthClientError, createAuthClient } from "../client";
import { createAuthStore } from "../store";

const BASE_URL = "http://localhost:8787";
const USER = { id: "u1", email: "a@example.com", name: "A" };
const TOKEN = "token-abc";

class FakeStorage {
  private data = new Map<string, string>();
  constructor(private throwOnAccess = false) {}

  getItem(key: string): string | null {
    if (this.throwOnAccess) throw new Error("storage unavailable");
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.throwOnAccess) throw new Error("storage unavailable");
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    if (this.throwOnAccess) throw new Error("storage unavailable");
    this.data.delete(key);
  }
  seed(key: string, value: string): void {
    this.data.set(key, value);
  }
  raw(key: string): string | undefined {
    return this.data.get(key);
  }
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Routes fetch calls by "METHOD path" so each test can override just the parts it needs. */
function fakeFetch(
  handlers: Record<string, (init?: RequestInit) => Response | Promise<Response>>,
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const path = url.replace(BASE_URL, "");
    const method = init?.method ?? "GET";
    const key = `${method} ${path}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unhandled fetch: ${key}`);
    return handler(init);
  });
}

function meHandler(status: number, body: unknown = { user: USER }) {
  return () => jsonResponse(status, body);
}

describe("createAuthClient — signUp / signIn", () => {
  it("signUp stores the issued token, resolves the user via /api/me, and marks signed-in", async () => {
    const storage = new FakeStorage();
    const store = createAuthStore();
    const fetchImpl = fakeFetch({
      "POST /api/auth/sign-up/email": () =>
        jsonResponse(200, {}, { "set-auth-token": TOKEN }),
      "GET /api/me": meHandler(200),
    });
    const client = createAuthClient({ baseUrl: BASE_URL, fetchImpl, storage, store });

    const user = await client.signUp("a@example.com", "pw", "A");

    expect(user).toEqual(USER);
    expect(storage.raw("zdo:auth:token")).toBe(TOKEN);
    expect(store.getState()).toEqual({ status: "signed-in", user: USER });
  });

  it("signIn attaches the token as an Authorization: Bearer header on the follow-up /api/me call", async () => {
    const storage = new FakeStorage();
    const store = createAuthStore();
    let seenAuth: string | null = null;
    const fetchImpl = fakeFetch({
      "POST /api/auth/sign-in/email": () =>
        jsonResponse(200, {}, { "set-auth-token": TOKEN }),
      "GET /api/me": (init) => {
        seenAuth = new Headers(init?.headers).get("Authorization");
        return jsonResponse(200, { user: USER });
      },
    });
    const client = createAuthClient({ baseUrl: BASE_URL, fetchImpl, storage, store });

    await client.signIn("a@example.com", "pw");

    expect(seenAuth).toBe(`Bearer ${TOKEN}`);
  });

  it("a failed sign-in never touches an existing token or store state", async () => {
    const storage = new FakeStorage();
    storage.seed("zdo:auth:token", "existing-token");
    const store = createAuthStore();
    store.setSignedIn(USER);
    const fetchImpl = fakeFetch({
      "POST /api/auth/sign-in/email": () =>
        jsonResponse(400, { error: { message: "wrong password" } }),
    });
    const client = createAuthClient({ baseUrl: BASE_URL, fetchImpl, storage, store });

    await expect(client.signIn("a@example.com", "wrong")).rejects.toThrow(AuthClientError);

    expect(storage.raw("zdo:auth:token")).toBe("existing-token");
    expect(store.getState()).toEqual({ status: "signed-in", user: USER });
  });

  it("a failed sign-up never touches an existing token or store state", async () => {
    const storage = new FakeStorage();
    storage.seed("zdo:auth:token", "existing-token");
    const store = createAuthStore();
    const fetchImpl = fakeFetch({
      "POST /api/auth/sign-up/email": () =>
        jsonResponse(422, { error: { message: "email already in use" } }),
    });
    const client = createAuthClient({ baseUrl: BASE_URL, fetchImpl, storage, store });

    await expect(client.signUp("a@example.com", "pw", "A")).rejects.toThrow(AuthClientError);

    expect(storage.raw("zdo:auth:token")).toBe("existing-token");
    expect(store.getState()).toEqual({ status: "unknown" });
  });
});

describe("createAuthClient — signOut", () => {
  it("clears the local token unconditionally even when the server revoke fails", async () => {
    const storage = new FakeStorage();
    storage.seed("zdo:auth:token", TOKEN);
    const store = createAuthStore();
    store.setSignedIn(USER);
    const fetchImpl = fakeFetch({
      "POST /api/auth/sign-out": () => {
        throw new Error("network down");
      },
    });
    const client = createAuthClient({ baseUrl: BASE_URL, fetchImpl, storage, store });

    await client.signOut();

    expect(storage.raw("zdo:auth:token")).toBeUndefined();
    expect(store.getState()).toEqual({ status: "signed-out" });
  });

  it("is a no-op network call when there was no token to begin with", async () => {
    const storage = new FakeStorage();
    const store = createAuthStore();
    const fetchImpl = vi.fn();
    const client = createAuthClient({ baseUrl: BASE_URL, fetchImpl, storage, store });

    await client.signOut();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(store.getState()).toEqual({ status: "signed-out" });
  });
});

describe("createAuthClient — resumeSession invalidation semantics", () => {
  it("resolves signed-out with no network call when there is no stored token", async () => {
    const storage = new FakeStorage();
    const store = createAuthStore();
    const fetchImpl = vi.fn();
    const client = createAuthClient({ baseUrl: BASE_URL, fetchImpl, storage, store });

    const user = await client.resumeSession();

    expect(user).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(store.getState()).toEqual({ status: "signed-out" });
  });

  it("resolves signed-in for a valid token", async () => {
    const storage = new FakeStorage();
    storage.seed("zdo:auth:token", TOKEN);
    const store = createAuthStore();
    const fetchImpl = fakeFetch({ "GET /api/me": meHandler(200) });
    const client = createAuthClient({ baseUrl: BASE_URL, fetchImpl, storage, store });

    const user = await client.resumeSession();

    expect(user).toEqual(USER);
    expect(store.getState()).toEqual({ status: "signed-in", user: USER });
  });

  it("a 401 from /api/me clears the token and marks signed-out", async () => {
    const storage = new FakeStorage();
    storage.seed("zdo:auth:token", TOKEN);
    const store = createAuthStore();
    const fetchImpl = fakeFetch({
      "GET /api/me": meHandler(401, { error: { code: "unauthorized", message: "no" } }),
    });
    const client = createAuthClient({ baseUrl: BASE_URL, fetchImpl, storage, store });

    const user = await client.resumeSession();

    expect(user).toBeNull();
    expect(storage.raw("zdo:auth:token")).toBeUndefined();
    expect(store.getState()).toEqual({ status: "signed-out" });
  });

  it("a 403 from /api/me does NOT clear the token and does not change store state", async () => {
    const storage = new FakeStorage();
    storage.seed("zdo:auth:token", TOKEN);
    const store = createAuthStore();
    const fetchImpl = fakeFetch({
      "GET /api/me": meHandler(403, { error: { code: "forbidden", message: "no" } }),
    });
    const client = createAuthClient({ baseUrl: BASE_URL, fetchImpl, storage, store });

    const user = await client.resumeSession();

    expect(user).toBeNull();
    expect(storage.raw("zdo:auth:token")).toBe(TOKEN);
    expect(store.getState()).toEqual({ status: "unknown" });
  });

  it("a transient network failure keeps the optimistic session — the store is left untouched", async () => {
    const storage = new FakeStorage();
    storage.seed("zdo:auth:token", TOKEN);
    const store = createAuthStore();
    store.setSignedIn(USER); // simulate a prior successful resume this session
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });
    const client = createAuthClient({ baseUrl: BASE_URL, fetchImpl, storage, store });

    const user = await client.resumeSession();

    expect(user).toBeNull();
    expect(storage.raw("zdo:auth:token")).toBe(TOKEN);
    expect(store.getState()).toEqual({ status: "signed-in", user: USER });
  });
});

describe("createAuthClient — storage-throw safety", () => {
  it("signIn still resolves and updates the store when storage access throws", async () => {
    const storage = new FakeStorage(true);
    const store = createAuthStore();
    const fetchImpl = fakeFetch({
      "POST /api/auth/sign-in/email": () =>
        jsonResponse(200, {}, { "set-auth-token": TOKEN }),
      "GET /api/me": meHandler(200),
    });
    const client = createAuthClient({ baseUrl: BASE_URL, fetchImpl, storage, store });

    const user = await client.signIn("a@example.com", "pw");

    expect(user).toEqual(USER);
    expect(store.getState()).toEqual({ status: "signed-in", user: USER });
  });

  it("resumeSession degrades to signed-out (no token readable) when storage access throws", async () => {
    const storage = new FakeStorage(true);
    const store = createAuthStore();
    const fetchImpl = vi.fn();
    const client = createAuthClient({ baseUrl: BASE_URL, fetchImpl, storage, store });

    const user = await client.resumeSession();

    expect(user).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(store.getState()).toEqual({ status: "signed-out" });
  });

  it("signOut never throws even when storage access throws", async () => {
    const storage = new FakeStorage(true);
    const store = createAuthStore();
    store.setSignedIn(USER);
    const fetchImpl = vi.fn();
    const client = createAuthClient({ baseUrl: BASE_URL, fetchImpl, storage, store });

    await expect(client.signOut()).resolves.toBeUndefined();
    expect(store.getState()).toEqual({ status: "signed-out" });
  });
});
