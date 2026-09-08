/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * DocHistory — displayLocale contract (#4073).
 *
 * The panel content (revision dates) is fetched on interaction and the
 * hosting `<Island ssrFallback>` wrapper skips SSR for it entirely, so an
 * SSR snapshot can never exercise `formatDate`'s output. These tests mount
 * the real component into a DOM (happy-dom), mock `fetch` with history data,
 * open the panel, and read the rendered revision-date text.
 *
 * Ambient-locale trap: this sandbox's Node process resolves
 * `Intl.DateTimeFormat().resolvedOptions().locale` to "ja-JP" — i.e. the
 * ambient default locale IS Japanese here, which is exactly the condition
 * the issue warns about ("otherwise they pass for the wrong reason"): a
 * naive "JA page renders JA-shaped dates" assertion would pass even under
 * the OLD buggy `toLocaleDateString(undefined, …)` implementation, since
 * `undefined` resolves to this ambient JA locale by coincidence. Two
 * independent guards close that hole regardless of which way the ambient
 * locale happens to point in any given environment:
 *   1. An EN-locale assertion (`displayLocale="en"`) — the old ambient-based
 *      code would render JA-shaped dates here (wrong), so this only passes
 *      under the fix.
 *   2. A `Date.prototype.toLocaleDateString` spy proving the component never
 *      calls it at all (ambient-independent by construction).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import type { DocHistoryData } from "../../island-types/index.js";
import { DocHistory } from "../index.js";

let mounted: HTMLDivElement | null = null;

const HISTORY_DATA: DocHistoryData = {
  slug: "getting-started/intro",
  filePath: "src/content/docs/getting-started/intro.mdx",
  entries: [
    {
      hash: "abcdef1234567890",
      date: "2026-08-22",
      author: "Alice",
      message: "Update intro",
      content: "content",
    },
  ],
};

function mockFetchOnce(data: DocHistoryData): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => data,
    }),
  );
}

async function mountAndOpen(
  props: Parameters<typeof DocHistory>[0],
): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted = container;

  act(() => {
    render(<DocHistory {...props} />, container);
  });

  const trigger = container.querySelector<HTMLButtonElement>(
    ".doc-history-trigger",
  );
  expect(trigger).not.toBeNull();

  // Opening triggers fetchHistory(), an async function awaiting fetch() then
  // res.json() — flush both microtask hops inside act() so Preact commits
  // the resulting state updates before we inspect the DOM.
  await act(async () => {
    trigger!.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  return container;
}

afterEach(() => {
  if (mounted) {
    act(() => render(null, mounted!));
    mounted.remove();
    mounted = null;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DocHistory — displayLocale renders localized revision dates (#4073)", () => {
  it("never falls back to Date.prototype.toLocaleDateString (ambient-locale-independent)", async () => {
    const spy = vi.spyOn(Date.prototype, "toLocaleDateString");
    mockFetchOnce(HISTORY_DATA);

    await mountAndOpen({ slug: "getting-started/intro", displayLocale: "ja" });

    expect(spy).not.toHaveBeenCalled();
  });

  it("renders English-shaped dates when displayLocale is 'en'", async () => {
    mockFetchOnce(HISTORY_DATA);

    const container = await mountAndOpen({
      slug: "getting-started/intro",
      displayLocale: "en",
    });

    expect(container.textContent).toContain("Aug 22, 2026");
  });

  it("renders JA-shaped dates ('2026年8月22日') on a JA page", async () => {
    mockFetchOnce(HISTORY_DATA);

    const container = await mountAndOpen({
      slug: "getting-started/intro",
      locale: "ja",
      displayLocale: "ja",
    });

    expect(container.textContent).toContain("2026年8月22日");
  });

  it("JA-default site (locale prop omitted) still renders JA dates", async () => {
    mockFetchOnce(HISTORY_DATA);

    // Mirrors a JA-default site: doc-history-area omits `locale` (the
    // storage-path prop) for the default locale, but `displayLocale` still
    // carries the page's actual locale.
    const container = await mountAndOpen({
      slug: "getting-started/intro",
      displayLocale: "ja",
    });

    expect(container.textContent).toContain("2026年8月22日");
  });

  it("EN-fallback JA page renders JA dates while fetching the bare (locale-omitted) path", async () => {
    mockFetchOnce(HISTORY_DATA);

    // Mirrors an EN-fallback JA page: `locale` is omitted so the fetch hits
    // the bare path, but the visitor is still reading JA — `displayLocale`
    // must stay "ja".
    await mountAndOpen({
      slug: "getting-started/intro",
      displayLocale: "ja",
    });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      "/doc-history/getting-started/intro.json",
    );
  });
});
