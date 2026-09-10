/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import type { ChromeContext } from "../../factory-context/index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import { createDocMetainfoArea, type DocHistoryMetaEntry } from "../index.js";

const DEFAULT_META: Record<string, DocHistoryMetaEntry> = {
  guide: {
    author: "Takazudo",
    createdDate: "2026-08-12",
    updatedDate: "2026-08-15",
    ext: ".mdx",
  },
  "ja/guide": {
    author: "Takazudo",
    createdDate: "2026-08-12",
    updatedDate: "2026-08-15",
    ext: ".mdx",
  },
};

function renderArea(
  settings: Record<string, unknown> = {},
  locale = "en",
  docHistoryMeta: Record<string, DocHistoryMetaEntry> = DEFAULT_META,
): string {
  const ctx = makeFakeChromeContext({
    settings: { docMetainfo: true, ...settings },
    overrides: {
      hostBindings: { docHistoryMeta },
      t: (key) =>
        ({ "doc.created": "Created", "doc.updated": "Updated" }[key] ?? key),
    } as Partial<ChromeContext>,
  });
  const DocMetainfoArea = createDocMetainfoArea(ctx);

  return render(<DocMetainfoArea slug="guide" locale={locale} />);
}

describe("createDocMetainfoArea — date formatting", () => {
  it("keeps the omitted field setting identical to the all-fields setting", () => {
    expect(renderArea()).toBe(
      renderArea({ docMetainfoFields: ["created", "updated", "author"] }),
    );
  });

  it("renders nothing when every field is deselected", () => {
    expect(renderArea({ docMetainfoFields: [] })).toBe("");
  });

  it("renders only Updated when it is selected and Created is equal", () => {
    const equalDates: Record<string, DocHistoryMetaEntry> = {
      guide: {
        author: "Takazudo",
        createdDate: "2026-08-12",
        updatedDate: "2026-08-12",
        ext: ".mdx",
      },
    };
    const html = renderArea({ docMetainfoFields: ["updated"] }, "en", equalDates);

    expect(html).toContain("Updated Aug 12, 2026");
    expect(html).not.toContain("Created");
    expect(html).not.toContain("Takazudo");
  });

  it("renders only the selected Created and author fields", () => {
    const html = renderArea({ docMetainfoFields: ["created", "author"] });

    expect(html).toContain("Created Aug 12, 2026");
    expect(html).toContain("Takazudo");
    expect(html).not.toContain("Updated Aug 15, 2026");
  });

  it("renders nothing when the page has no history metadata", () => {
    expect(renderArea({}, "en", {})).toBe("");
  });

  it("renders the default locale-aware created/updated dates", () => {
    const html = renderArea();

    expect(html).toContain("Aug 12, 2026");
    expect(html).toContain("Aug 15, 2026");
  });

  it("applies a configured non-default full pattern to created/updated dates", () => {
    const html = renderArea({ dateFormat: "YYYY/MM/DD" });

    expect(html).toContain("2026/08/12");
    expect(html).toContain("2026/08/15");
    expect(html).not.toContain("Aug 12, 2026");
  });

  it("applies a per-locale full override only for that locale", () => {
    const settings = { dateFormat: { locales: { ja: { full: "YYYY年MM月DD日" } } } };

    const ja = renderArea(settings, "ja");
    expect(ja).toContain("2026年08月12日");

    const en = renderArea(settings, "en");
    expect(en).toContain("Aug 12, 2026");
  });
});
