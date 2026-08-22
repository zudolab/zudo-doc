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

function makeContext(): ChromeContext {
  return makeFakeChromeContext({
    overrides: {
      t: (key, locale) => {
        if (key !== "doc.updated") return key;
        return locale === "ja" ? "更新" : "Updated";
      },
    } as Partial<ChromeContext>,
  });
}

function renderHeader(data: Record<string, unknown>, locale = "en"): string {
  const DocContentHeader = createDocContentHeader(makeContext());
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
});
