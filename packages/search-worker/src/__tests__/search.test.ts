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
  {
    id: "2",
    title: "Configuration",
    body: "Configure your project settings and options",
    url: "/docs/configuration",
    description: "Project configuration reference",
  },
  {
    id: "3",
    title: "Deployment",
    body: "Deploy your site to production environments",
    url: "/docs/deployment",
    description: "Deployment guide",
  },
];

describe("search", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns matching results for a query", async () => {
    const { search } = await import("../search");
    const env = createMockEnv();
    const { results, total } = await search("getting started", undefined, env);

    expect(total).toBeGreaterThan(0);
    expect(results.length).toBeGreaterThan(0);
    const firstResult = results[0];
    if (firstResult === undefined) throw new Error("Expected at least one result");
    expect(firstResult.title).toBe("Getting Started");
    expect(firstResult.url).toBe("/docs/getting-started");
  });

  it("returns empty results for non-matching query", async () => {
    const { search } = await import("../search");
    const env = createMockEnv();
    const { results, total } = await search(
      "xyznonexistent999",
      undefined,
      env,
    );

    expect(total).toBe(0);
    expect(results).toEqual([]);
  });

  it("returns results with expected shape", async () => {
    const { search } = await import("../search");
    const env = createMockEnv();
    const { results } = await search("configuration", undefined, env);

    expect(results.length).toBeGreaterThan(0);
    const result = results[0];
    if (result === undefined) throw new Error("Expected at least one result");
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("description");
    expect(result).toHaveProperty("score");
    expect(typeof result.score).toBe("number");
  });

  it("uses cached index within TTL", async () => {
    const { search } = await import("../search");
    const env = createMockEnv();

    await search("getting started", undefined, env);
    await search("getting started", undefined, env);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refetches index after cache TTL expires", async () => {
    const { search } = await import("../search");
    const env = createMockEnv();

    await search("getting started", undefined, env);
    expect(fetch).toHaveBeenCalledTimes(1);

    // Advance past 5-minute TTL
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    await search("getting started", undefined, env);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent failure onto the same rejected promise (negative cache)", async () => {
    const { search } = await import("../search");
    const env = createMockEnv();

    // Advance past positive-cache TTL to ensure the next call fetches.
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    // Make fetch fail persistently.
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    await expect(search("getting started", undefined, env)).rejects.toThrow(
      "Network error",
    );

    // Second call within the 30-second negative-cache window must NOT
    // launch a new fetch — it coalesces onto the still-rejected promise.
    vi.advanceTimersByTime(10_000); // 10s into 30s window
    await expect(search("getting started", undefined, env)).rejects.toThrow(
      "Network error",
    );

    // Only one fetch attempt should have been made despite two search calls.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries after the negative-cache window expires", async () => {
    const { search } = await import("../search");
    const env = createMockEnv();

    // First call succeeds.
    await search("getting started", undefined, env);
    expect(fetch).toHaveBeenCalledTimes(1);

    // Advance past positive-cache TTL to force a refetch.
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    // Make fetch fail.
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));
    await expect(search("getting started", undefined, env)).rejects.toThrow(
      "Network error",
    );

    // Still within 30-second negative-cache window — no new fetch.
    vi.advanceTimersByTime(15_000);
    await expect(search("getting started", undefined, env)).rejects.toThrow(
      "Network error",
    );
    expect(fetch).toHaveBeenCalledTimes(2); // initial + 1 failed attempt

    // Advance past the 30-second negative-cache window.
    vi.advanceTimersByTime(30_000 + 1);

    // Fetch succeeds again — the retry should go through.
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(FAKE_ENTRIES), { status: 200 }),
    );
    const { results } = await search("getting started", undefined, env);
    expect(results).toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(3); // initial + failed + retry
  });

  it("fetches the correct URL from env", async () => {
    const { search } = await import("../search");
    const env = createMockEnv();
    env.DOCS_SITE_URL = "https://my-docs.example.com/";

    await search("getting started", undefined, env);

    expect(fetch).toHaveBeenCalledWith(
      "https://my-docs.example.com/search-index.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("throws when search index contains a malformed entry", async () => {
    const malformedEntries = [
      { id: "1", title: "Good Entry", body: "ok", url: "/ok", description: "ok" },
      { id: 2, title: "Bad id (number)", body: "x", url: "/x", description: "x" }, // id is number, not string
    ];
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(malformedEntries), { status: 200 }),
    );

    const { search } = await import("../search");
    const env = createMockEnv();

    await expect(search("test", undefined, env)).rejects.toThrow(
      "Search index entry at index 1 has unexpected shape",
    );
  });

  it("throws when search index response is not an array", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ entries: [] }), { status: 200 }),
    );

    const { search } = await import("../search");
    const env = createMockEnv();

    await expect(search("test", undefined, env)).rejects.toThrow(
      "Search index is not an array",
    );
  });
});

describe("clampLimit", () => {
  it("returns default (20) for undefined", async () => {
    const { clampLimit } = await import("../search");
    expect(clampLimit(undefined)).toBe(20);
  });

  it("returns default (20) for negative values", async () => {
    const { clampLimit } = await import("../search");
    expect(clampLimit(-5)).toBe(20);
  });

  it("returns default (20) for zero", async () => {
    const { clampLimit } = await import("../search");
    expect(clampLimit(0)).toBe(20);
  });

  it("caps at max (100) for values above 100", async () => {
    const { clampLimit } = await import("../search");
    expect(clampLimit(200)).toBe(100);
  });

  it("returns the value when within valid range", async () => {
    const { clampLimit } = await import("../search");
    expect(clampLimit(50)).toBe(50);
  });

  it("floors decimal values", async () => {
    const { clampLimit } = await import("../search");
    expect(clampLimit(25.7)).toBe(25);
  });

  it("returns default for NaN", async () => {
    const { clampLimit } = await import("../search");
    expect(clampLimit(NaN)).toBe(20);
  });
});
