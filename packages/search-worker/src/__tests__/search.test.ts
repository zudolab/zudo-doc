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
    expect(results[0].title).toBe("Getting Started");
    expect(results[0].url).toBe("/docs/getting-started");
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

  it("resets cache on fetch failure so next request retries", async () => {
    const { search } = await import("../search");
    const env = createMockEnv();

    // First call succeeds
    await search("getting started", undefined, env);
    expect(fetch).toHaveBeenCalledTimes(1);

    // Advance past TTL to force refetch
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    // Make fetch fail
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    await expect(search("getting started", undefined, env)).rejects.toThrow(
      "Network error",
    );

    // Next call should retry (cache was reset by failure)
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(FAKE_ENTRIES), { status: 200 }),
    );

    const { results } = await search("getting started", undefined, env);
    expect(results).toBeDefined();
    // 1 (initial) + 1 (failed) + 1 (retry) = 3
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("fetches the correct URL from env", async () => {
    const { search } = await import("../search");
    const env = createMockEnv();
    env.DOCS_SITE_URL = "https://my-docs.example.com/";

    await search("getting started", undefined, env);

    expect(fetch).toHaveBeenCalledWith(
      "https://my-docs.example.com/search-index.json",
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
