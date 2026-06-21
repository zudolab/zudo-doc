/**
 * ai-chat-client.test.ts
 *
 * Unit tests for pages/api/_ai-chat-client.ts — specifically the
 * fetchDocsContext function and its negative-cache / backoff behaviour.
 *
 * No real network calls are made: global fetch is stubbed in each suite.
 * Fake timers are used to control the negative-cache TTL window.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const DOCS_URL = "https://docs.example.com";
const FULL_TXT_URL = `${DOCS_URL}/llms-full.txt`;
const SAMPLE_CONTENT = "# zudo-doc\n\nSample documentation.";

// ---------------------------------------------------------------------------
// We import the module under test dynamically within each describe block so
// that vi.resetModules() gives us a clean module-level state (cachedDocsContext,
// cachedAt, failedAt, inflightPromise all reset to initial values) for each
// isolation group.
// ---------------------------------------------------------------------------

describe("fetchDocsContext — positive cache", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  it("fetches llms-full.txt and returns its text on success", async () => {
    mockFetch.mockResolvedValueOnce(new Response(SAMPLE_CONTENT, { status: 200 }));
    const { fetchDocsContext } = await import("../../../pages/api/_ai-chat-client");

    const result = await fetchDocsContext(DOCS_URL);
    expect(result).toBe(SAMPLE_CONTENT);
    expect(mockFetch).toHaveBeenCalledWith(FULL_TXT_URL);
  });

  it("throws when response status is not ok", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
    const { fetchDocsContext } = await import("../../../pages/api/_ai-chat-client");

    await expect(fetchDocsContext(DOCS_URL)).rejects.toThrow("404");
  });

  it("strips trailing slash from docsUrl before constructing the path", async () => {
    mockFetch.mockResolvedValueOnce(new Response(SAMPLE_CONTENT, { status: 200 }));
    const { fetchDocsContext } = await import("../../../pages/api/_ai-chat-client");

    await fetchDocsContext("https://docs.example.com/");
    expect(mockFetch).toHaveBeenCalledWith(FULL_TXT_URL);
  });

  it("serves cached content on the second call within TTL", async () => {
    mockFetch.mockResolvedValueOnce(new Response(SAMPLE_CONTENT, { status: 200 }));
    const { fetchDocsContext } = await import("../../../pages/api/_ai-chat-client");

    const first = await fetchDocsContext(DOCS_URL);
    const second = await fetchDocsContext(DOCS_URL);

    expect(first).toBe(SAMPLE_CONTENT);
    expect(second).toBe(SAMPLE_CONTENT);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("refetches after positive-cache TTL (1 hour) expires", async () => {
    // Use a factory so each fetch call gets a fresh Response (bodies are single-use).
    mockFetch.mockImplementation(() =>
      Promise.resolve(new Response(SAMPLE_CONTENT, { status: 200 })),
    );
    const { fetchDocsContext } = await import("../../../pages/api/_ai-chat-client");

    await fetchDocsContext(DOCS_URL);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance past the 1-hour positive-cache TTL.
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);

    await fetchDocsContext(DOCS_URL);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("fetchDocsContext — negative cache and backoff", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  it("coalesces concurrent failures onto the same rejected promise", async () => {
    // Reject immediately without resolution — both calls should coalesce.
    mockFetch.mockRejectedValue(new Error("Network failure"));
    const { fetchDocsContext } = await import("../../../pages/api/_ai-chat-client");

    await expect(fetchDocsContext(DOCS_URL)).rejects.toThrow("Network failure");

    // Second call within the negative-cache window (no time advanced).
    await expect(fetchDocsContext(DOCS_URL)).rejects.toThrow("Network failure");

    // Only one outbound fetch despite two calls.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not launch a new fetch within the 30-second negative-cache window", async () => {
    mockFetch.mockRejectedValue(new Error("Service unavailable"));
    const { fetchDocsContext } = await import("../../../pages/api/_ai-chat-client");

    await expect(fetchDocsContext(DOCS_URL)).rejects.toThrow("Service unavailable");

    // Advance to 25 seconds — still inside the 30-second window.
    vi.advanceTimersByTime(25_000);
    await expect(fetchDocsContext(DOCS_URL)).rejects.toThrow("Service unavailable");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries after the 30-second negative-cache window expires", async () => {
    // First call fails.
    mockFetch.mockRejectedValueOnce(new Error("Transient error"));
    const { fetchDocsContext } = await import("../../../pages/api/_ai-chat-client");

    await expect(fetchDocsContext(DOCS_URL)).rejects.toThrow("Transient error");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Still inside the window — no retry.
    vi.advanceTimersByTime(15_000);
    await expect(fetchDocsContext(DOCS_URL)).rejects.toThrow("Transient error");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance past the 30-second window.
    vi.advanceTimersByTime(30_000 + 1);

    // Retry succeeds.
    mockFetch.mockResolvedValueOnce(new Response(SAMPLE_CONTENT, { status: 200 }));
    const result = await fetchDocsContext(DOCS_URL);
    expect(result).toBe(SAMPLE_CONTENT);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("clears failure state after a successful retry", async () => {
    // Fail once, wait past the window, then succeed.
    mockFetch.mockRejectedValueOnce(new Error("Temporary failure"));
    const { fetchDocsContext } = await import("../../../pages/api/_ai-chat-client");

    await expect(fetchDocsContext(DOCS_URL)).rejects.toThrow("Temporary failure");

    vi.advanceTimersByTime(30_000 + 1);
    mockFetch.mockResolvedValueOnce(new Response(SAMPLE_CONTENT, { status: 200 }));
    const result = await fetchDocsContext(DOCS_URL);
    expect(result).toBe(SAMPLE_CONTENT);

    // Third call should use the positive cache (no additional fetch).
    const cached = await fetchDocsContext(DOCS_URL);
    expect(cached).toBe(SAMPLE_CONTENT);
    expect(mockFetch).toHaveBeenCalledTimes(2); // fail + retry
  });
});

describe("fetchDocsContext — in-flight coalescing", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  it("coalesces concurrent cold-start calls onto the same in-flight promise", async () => {
    // Use a deferred promise so we can control when fetch resolves and verify
    // that both calls are coalesced before the first resolves.
    let resolveDeferred!: (r: Response) => void;
    const deferred = new Promise<Response>((res) => {
      resolveDeferred = res;
    });
    mockFetch.mockReturnValue(deferred);

    const { fetchDocsContext } = await import("../../../pages/api/_ai-chat-client");

    // Start both calls — they should coalesce onto the single in-flight promise.
    const callA = fetchDocsContext(DOCS_URL);
    const callB = fetchDocsContext(DOCS_URL);

    // Resolve the deferred fetch now.
    resolveDeferred(new Response(SAMPLE_CONTENT, { status: 200 }));

    const [a, b] = await Promise.all([callA, callB]);

    expect(a).toBe(SAMPLE_CONTENT);
    expect(b).toBe(SAMPLE_CONTENT);
    // Both calls should share the single in-flight fetch.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("isClaudeApiResponse", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns true for a valid Claude API response", async () => {
    const { isClaudeApiResponse } = await import("../../../pages/api/_ai-chat-client");
    expect(
      isClaudeApiResponse({
        content: [{ type: "text", text: "hello" }],
        stop_reason: "end_turn",
      }),
    ).toBe(true);
  });

  it("returns false when content is missing", async () => {
    const { isClaudeApiResponse } = await import("../../../pages/api/_ai-chat-client");
    expect(isClaudeApiResponse({ stop_reason: "end_turn" })).toBe(false);
  });

  it("returns false when stop_reason is missing", async () => {
    const { isClaudeApiResponse } = await import("../../../pages/api/_ai-chat-client");
    expect(isClaudeApiResponse({ content: [] })).toBe(false);
  });

  it("returns false for null", async () => {
    const { isClaudeApiResponse } = await import("../../../pages/api/_ai-chat-client");
    expect(isClaudeApiResponse(null)).toBe(false);
  });

  it("returns false for a non-object", async () => {
    const { isClaudeApiResponse } = await import("../../../pages/api/_ai-chat-client");
    expect(isClaudeApiResponse("string")).toBe(false);
  });
});
