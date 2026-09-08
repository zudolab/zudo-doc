/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * DocHistory — the `full` date-format role on revision dates (#4078).
 *
 * The panel content is fetched on interaction and its `<Island ssrFallback>`
 * wrapper skips SSR entirely, so an SSR snapshot can never exercise the
 * revision-date output. These tests mount the real component into happy-dom,
 * mock `fetch` with history data, open the panel and read the rendered date.
 *
 * Ambient-locale trap (see doc-history-display-locale.test.tsx): this sandbox
 * resolves the ambient Node locale to "ja-JP", so a naive "JA renders JA"
 * assertion can pass for the wrong reason. Every assertion here is on a
 * pattern-produced literal that no `Intl` path emits, plus a
 * `toLocaleDateString` spy — both ambient-independent by construction.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import type { DocHistoryData } from "../../island-types/index.js";
import type { ResolvedDateFormats } from "../../settings.js";
import { DocHistory } from "../index.js";

let mounted: HTMLDivElement | null = null;

// Distinct per role: only `full` may ever reach a revision date.
const FORMATS: ResolvedDateFormats = {
  full: "YYYY/MM/DD",
  monthDay: "[md]MM-DD",
  year: "[FY]YYYY",
  yearMonth: "MMMM [of] YYYY",
  numericMonthDay: "D.M",
};

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
    vi.fn().mockResolvedValue({ ok: true, json: async () => data }),
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

describe("DocHistory — dateFormats.full on revision dates (#4078)", () => {
  it("renders revision dates with the `full` pattern, not the Intl default", async () => {
    mockFetchOnce(HISTORY_DATA);

    const container = await mountAndOpen({
      slug: "getting-started/intro",
      displayLocale: "en",
      dateFormats: FORMATS,
    });

    expect(container.textContent).toContain("2026/08/22");
    expect(container.textContent).not.toContain("Aug 22, 2026");
  });

  it("never borrows another role's pattern for the revision date", async () => {
    mockFetchOnce(HISTORY_DATA);

    const container = await mountAndOpen({
      slug: "getting-started/intro",
      displayLocale: "en",
      dateFormats: FORMATS,
    });

    expect(container.textContent).not.toContain("FY2026");
    expect(container.textContent).not.toContain("August of 2026");
    expect(container.textContent).not.toContain("md08-22");
    expect(container.textContent).not.toContain("22.8");
  });

  it("resolves MMMM against displayLocale, never the ambient Node locale", async () => {
    const spy = vi.spyOn(Date.prototype, "toLocaleDateString");
    mockFetchOnce(HISTORY_DATA);

    const container = await mountAndOpen({
      slug: "getting-started/intro",
      displayLocale: "en",
      dateFormats: { ...FORMATS, full: "MMMM D, YYYY" },
    });

    expect(container.textContent).toContain("August 22, 2026");
    expect(spy).not.toHaveBeenCalled();
  });

  it("falls back to today's Intl output when the prop is omitted entirely", async () => {
    mockFetchOnce(HISTORY_DATA);

    const container = await mountAndOpen({
      slug: "getting-started/intro",
      displayLocale: "en",
    });

    expect(container.textContent).toContain("Aug 22, 2026");
  });
});
