import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { SearchIndexEntry } from "../types";
import { createMockEnv } from "./test-utils";

const FAKE_ENTRIES: SearchIndexEntry[] = [
  {
    id: "1",
    title: "Getting Started",
    body: "Learn how to get started with the framework",
    url: "/docs/getting-started",
    description: "Quick start guide",
  },
];

function makeRequest(
  method: string,
  body?: unknown,
  headers?: Record<string, string>,
): Request {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request("https://worker.example.com/", init);
}

describe("worker handler", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(FAKE_ENTRIES), { status: 200 }),
        ),
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function getHandler() {
    const mod = await import("../index");
    return mod.default;
  }

  it("responds 204 with CORS headers for OPTIONS", async () => {
    const handler = await getHandler();
    const env = createMockEnv();
    const req = new Request("https://worker.example.com/", {
      method: "OPTIONS",
    });

    const res = await handler.fetch(req, env);

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("responds 405 for GET requests", async () => {
    const handler = await getHandler();
    const env = createMockEnv();
    const req = new Request("https://worker.example.com/", { method: "GET" });

    const res = await handler.fetch(req, env);
    const body = await res.json();

    expect(res.status).toBe(405);
    expect(body).toHaveProperty("error", "Method not allowed");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("responds 400 for invalid JSON body", async () => {
    const handler = await getHandler();
    const env = createMockEnv();
    const req = new Request("https://worker.example.com/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json{{{",
    });

    const res = await handler.fetch(req, env);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error", "Invalid JSON body");
  });

  it("responds 400 when query is missing", async () => {
    const handler = await getHandler();
    const env = createMockEnv();
    const req = makeRequest("POST", { limit: 10 });

    const res = await handler.fetch(req, env);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error", "query is required");
  });

  it("responds 400 when query exceeds 500 characters", async () => {
    const handler = await getHandler();
    const env = createMockEnv();
    const req = makeRequest("POST", { query: "a".repeat(501) });

    const res = await handler.fetch(req, env);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error", "query exceeds 500 character limit");
  });

  it("responds 200 with search results for valid query", async () => {
    const handler = await getHandler();
    const env = createMockEnv();
    const req = makeRequest("POST", { query: "getting started" });

    const res = await handler.fetch(req, env);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("results");
    expect(body).toHaveProperty("query", "getting started");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.results)).toBe(true);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("responds 429 with Retry-After when rate limited", async () => {
    const handler = await getHandler();
    const env = createMockEnv();

    // Set limit to 1 and make KV always return "1" for any key,
    // so the rate limiter sees the limit as already reached
    env.RATE_LIMIT_PER_MINUTE = "1";
    env._kv.get = vi.fn().mockResolvedValue("1");

    const req = makeRequest("POST", { query: "test" });
    const res = await handler.fetch(req, env);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body).toHaveProperty("error", "Too many requests");
    expect(res.headers.get("Retry-After")).toBeDefined();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("responds 404 for non-root paths", async () => {
    const handler = await getHandler();
    const env = createMockEnv();
    const req = new Request("https://worker.example.com/other", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "test" }),
    });

    const res = await handler.fetch(req, env);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toHaveProperty("error", "Not found");
  });

  it("includes CORS headers on error responses", async () => {
    const handler = await getHandler();
    const env = createMockEnv();
    const req = makeRequest("POST", { limit: 10 }); // missing query

    const res = await handler.fetch(req, env);

    expect(res.status).toBe(400);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain(
      "Retry-After",
    );
  });
});
