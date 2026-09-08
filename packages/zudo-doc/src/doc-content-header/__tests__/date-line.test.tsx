/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { createDocContentHeader } from "../index.js";
import type { DocPageEntry } from "../../doc-page-props/index.js";
import type { ChromeContext } from "../../factory-context/index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";

function makeEntry(data: Record<string, unknown> = {}): DocPageEntry {
  return {
    slug: "test-page",
    data: { title: "Test Page", ...data },
    body: "",
    module_specifier: "test-page.mdx",
    Content: () => ({ type: "div", props: {}, key: null }),
  } as unknown as DocPageEntry;
}

function makeContext(settings: Record<string, unknown> = {}): ChromeContext {
  return makeFakeChromeContext({
    settings,
    overrides: {
      t: (key, locale) => {
        if (key !== "doc.updated") return key;
        return locale === "ja" ? "更新" : "Updated";
      },
    } as Partial<ChromeContext>,
  });
}

function renderHeader(
  data: Record<string, unknown>,
  locale = "en",
  settings: Record<string, unknown> = {},
): string {
  const DocContentHeader = createDocContentHeader(makeContext(settings));
  return render(
    <DocContentHeader entry={makeEntry(data)} slug="test-page" locale={locale} />,
  );
}

describe("createDocContentHeader — authored date line", () => {
  it("renders a date-only line", () => {
    const html = renderHeader({ date: "2026-08-12" });

    expect(html).toContain('data-doc-date');
    expect(html).toContain("Aug 12, 2026");
    expect(html).not.toContain("Updated");
  });

  it("renders an updated-only line with the translated label", () => {
    const html = renderHeader({ updated: "2026-08-15" });

    expect(html).toContain('data-doc-date');
    expect(html).toContain("Updated Aug 15, 2026");
  });

  it("renders both authored dates with a separator", () => {
    const html = renderHeader({ date: "2026-08-12", updated: "2026-08-15" });

    expect(html).toContain("Aug 12, 2026 · Updated Aug 15, 2026");
  });

  it("renders nothing when neither authored date is present", () => {
    const html = renderHeader({});

    expect(html).not.toContain("data-doc-date");
  });

  it("uses locale-aware formatting and the translated updated label", () => {
    const html = renderHeader(
      { date: "2026-08-12", updated: "2026-08-15" },
      "ja",
    );

    expect(html).toContain("2026年8月12日 · 更新 2026年8月15日");
  });

  it("applies a configured non-default full pattern to both authored dates", () => {
    const html = renderHeader(
      { date: "2026-08-12", updated: "2026-08-15" },
      "en",
      { dateFormat: "YYYY/MM/DD" },
    );

    expect(html).toContain("2026/08/12 · Updated 2026/08/15");
  });

  it("applies a per-locale full override only for that locale", () => {
    const settings = { dateFormat: { locales: { ja: { full: "YYYY年MM月DD日" } } } };

    const ja = renderHeader({ date: "2026-08-12" }, "ja", settings);
    expect(ja).toContain("2026年08月12日");

    const en = renderHeader({ date: "2026-08-12" }, "en", settings);
    expect(en).toContain("Aug 12, 2026");
  });
});
