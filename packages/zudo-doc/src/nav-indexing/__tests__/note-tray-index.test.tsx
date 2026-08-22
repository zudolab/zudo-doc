/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { NoteTrayIndex, type NoteTrayIndexItem } from "../note-tray-index.js";
import { serialize } from "./helpers.js";

const item = (slug: string, overrides: Partial<NoteTrayIndexItem> = {}): NoteTrayIndexItem => ({
  slug,
  label: slug,
  description: `About ${slug}`,
  href: `/docs/${slug}`,
  hasPage: true,
  children: [],
  rank: 1,
  ...overrides,
});

const base = {
  locale: "en",
  updatedLabel: "Updated",
  dated: true,
  tagLabels: { tags: "Tags", taggedWith: "Pages tagged with" },
};

describe("NoteTrayIndex", () => {
  it("renders nothing for an empty tray", () => {
    expect(NoteTrayIndex({ ...base, items: [] })).toBeNull();
  });

  it("renders zero-padded index rows, descriptions, and optional date/updated", () => {
    const html = serialize(
      NoteTrayIndex({
        ...base,
        showDate: true,
        items: [item("one", { rank: 1, date: "2026-08-22", updated: "2026-08-23" })],
      }),
    );
    expect(html).toContain(">01</span>");
    expect(html).toContain('href="/docs/one"');
    expect(html).toContain("About one");
    expect(html).toContain("Aug 22, 2026");
    expect(html).toContain("Updated <time");
  });

  it("keeps the visible stable rank accessible and never invents rank 00", () => {
    const ranked = serialize(
      NoteTrayIndex({ ...base, items: [item("sixth", { rank: 6 })] }),
    );
    const missing = serialize(
      NoteTrayIndex({ ...base, items: [item("missing", { rank: undefined })] }),
    );

    const rankSpan = ranked.match(/<span[^>]*>06<\/span>/)?.[0];
    expect(rankSpan).toBeDefined();
    expect(rankSpan).not.toContain("aria-hidden");
    expect(missing).not.toContain(">00</span>");
    expect(missing).toMatch(/<span[^>]*text-heading[^>]*><\/span>/);
  });

  it("renders cards with h2 links, excerpts, tags, and showDate-gated dates", () => {
    const tagged = item("card", {
      date: "2026-08-22",
      tagLinks: [{ tag: "preact", href: "/docs/tags/preact" }],
    });
    const shown = serialize(NoteTrayIndex({ ...base, style: "cards", showDate: true, items: [tagged] }));
    const hidden = serialize(NoteTrayIndex({ ...base, style: "cards", items: [tagged] }));
    expect(shown).toContain("<h2");
    expect(shown).toContain("About card");
    expect(shown).toContain("#preact");
    expect(shown).toContain("Aug 22, 2026");
    expect(hidden).not.toContain("Aug 22, 2026");
  });

  it.each([
    ["en", "2026 August"],
    ["ja", "2026年8月"],
  ])("renders localized timeline month headers in %s", (locale, label) => {
    const html = serialize(
      NoteTrayIndex({
        ...base,
        locale,
        style: "timeline",
        items: [item("dated", { date: "2026-08-22" })],
      }),
    );
    expect(html).toContain(label);
    expect(html).toContain(locale === "ja" ? "2026年8月22日" : "Aug 22, 2026");
    expect(html.indexOf("dated")).toBeLessThan(html.indexOf("About dated"));
  });

  it("honors descending group and rank order", () => {
    const html = serialize(
      NoteTrayIndex({
        ...base,
        style: "timeline",
        order: "desc",
        items: [
          item("older-low", { date: "2026-07-01", rank: 1 }),
          item("new-low", { date: "2026-08-01", rank: 2 }),
          item("new-high", { date: "2026-08-02", rank: 3 }),
        ],
      }),
    );
    expect(html.indexOf("2026 August")).toBeLessThan(html.indexOf("2026 July"));
    expect(html.indexOf("new-high")).toBeLessThan(html.indexOf("new-low"));
  });

  it("throws clearly when timeline is used on a non-dated tray", () => {
    expect(() =>
      NoteTrayIndex({ ...base, dated: false, style: "timeline", items: [item("one")] }),
    ).toThrow(/requires a dated note tray/);
  });
});
