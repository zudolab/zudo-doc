/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { NoteTrayIndex } from "../note-tray-index.js";
import { serialize } from "./helpers.js";
import { base, item } from "./note-tray-test-helpers.js";

describe("NoteTrayIndex index style", () => {
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
    expect(html).toMatch(/<li[^>]*><a [^>]*href="\/docs\/one"/);
    expect(html).toMatch(/<ol[^>]*\[&_li\]:mb-0[^>]*>/);
    expect(html).not.toMatch(/<ol[^>]*border-t/);
    expect(html).toMatch(/<li[^>]*border-y border-muted[^>]*>/);
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

  it("applies the full role pattern from dateFormats, keeping <time datetime> raw", () => {
    const html = serialize(
      NoteTrayIndex({
        ...base,
        showDate: true,
        items: [item("one", { rank: 1, date: "2026-08-22" })],
        dateFormats: {
          full: "YYYY-MM-DD",
          monthDay: "locale",
          year: "locale",
          yearMonth: "locale",
          numericMonthDay: "locale",
        },
      }),
    );
    expect(html).toContain("2026-08-22");
    expect(html).not.toContain("Aug 22, 2026");
    expect(html).toContain('datetime="2026-08-22"');
  });

  it("resolves distinct full-role dateFormats patterns per locale", () => {
    const en = serialize(
      NoteTrayIndex({
        ...base,
        locale: "en",
        showDate: true,
        items: [item("one", { rank: 1, date: "2026-08-22" })],
        dateFormats: {
          full: "MM/DD/YYYY",
          monthDay: "locale",
          year: "locale",
          yearMonth: "locale",
          numericMonthDay: "locale",
        },
      }),
    );
    const ja = serialize(
      NoteTrayIndex({
        ...base,
        locale: "ja",
        showDate: true,
        items: [item("one", { rank: 1, date: "2026-08-22" })],
        dateFormats: {
          full: "YYYY.MM.DD",
          monthDay: "locale",
          year: "locale",
          yearMonth: "locale",
          numericMonthDay: "locale",
        },
      }),
    );
    expect(en).toContain("08/22/2026");
    expect(ja).toContain("2026.08.22");
    expect(ja).not.toContain("2026年8月22日");
  });
});
