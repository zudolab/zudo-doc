/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { NoteTrayIndex } from "../note-tray-index.js";
import { serialize } from "./helpers.js";
import { base, item } from "./note-tray-test-helpers.js";

describe("NoteTrayIndex card style", () => {
  it("renders cards with h2 links, excerpts, tags, and showDate-gated dates", () => {
    const tagged = item("card", {
      date: "2026-08-22",
      tagLinks: [{ tag: "preact", href: "/docs/tags/preact" }],
    });
    const shown = serialize(
      NoteTrayIndex({ ...base, style: "cards", showDate: true, items: [tagged] }),
    );
    const hidden = serialize(NoteTrayIndex({ ...base, style: "cards", items: [tagged] }));
    expect(shown).toContain("<h2");
    expect(shown).toContain("About card");
    expect(shown).toContain("#preact");
    expect(shown).toContain("Aug 22, 2026");
    expect(shown).toContain(">Aug 22</span>");
    expect(hidden).not.toContain("Aug 22, 2026");
    expect(shown).toContain(
      '<a href="/docs/card" class="group col-span-full row-start-1 row-span-2',
    );
    expect(shown).toContain("border border-muted");
    expect(shown).toContain("grid-rows-subgrid");
    expect(shown.indexOf('<a href="/docs/tags/preact"')).toBeGreaterThan(
      shown.indexOf("</a>"),
    );
  });

  it("does not create subgrid rows when the item has no tags", () => {
    const shown = serialize(
      NoteTrayIndex({
        ...base,
        style: "cards",
        showDate: true,
        items: [item("plain", { date: "2026-08-22" })],
      }),
    );
    expect(shown).not.toContain("grid-rows-subgrid");
    expect(shown).toContain("Aug 22, 2026");
  });

  it("renders updated dates in narrow and wide representations", () => {
    const shown = serialize(
      NoteTrayIndex({
        ...base,
        style: "cards",
        showDate: true,
        items: [item("updated", { date: "2026-08-22", updated: "2026-08-23" })],
      }),
    );
    expect(shown).toContain("Updated <time");
    expect(shown).toContain("Updated Aug 23");
  });

  it("shows an updated-only DateLine at all widths without a date stamp", () => {
    const shown = serialize(
      NoteTrayIndex({
        ...base,
        style: "cards",
        showDate: true,
        items: [item("updated-only", { updated: "2026-08-23" })],
      }),
    );
    expect(shown).toContain("Updated <time");
    expect(shown).not.toContain("sm:hidden");
    expect(shown).not.toContain('class="hidden sm:flex');
  });

  it("renders a non-link frame without link interaction styles", () => {
    const shown = serialize(
      NoteTrayIndex({
        ...base,
        style: "cards",
        items: [
          item("heading", {
            href: undefined,
            tagLinks: [{ tag: "preact", href: "/docs/tags/preact" }],
          }),
        ],
      }),
    );
    expect(shown).toContain("<h2");
    expect(shown).toContain('<a href="/docs/tags/preact"');
    expect(shown).not.toContain('href="/docs/heading"');
    expect(shown).not.toContain("hover:border-accent");
    expect(shown).not.toContain("group-hover:text-accent");
  });

  it("applies the monthDay, year, and full role patterns from dateFormats", () => {
    const shown = serialize(
      NoteTrayIndex({
        ...base,
        style: "cards",
        showDate: true,
        items: [item("card", { date: "2026-08-22", updated: "2026-08-23" })],
        dateFormats: {
          full: "YYYY/MM/DD",
          monthDay: "MM-DD",
          year: "[FY]YYYY",
          yearMonth: "locale",
          numericMonthDay: "locale",
        },
      }),
    );
    // DateStamp (wide stamp): monthDay + year roles.
    expect(shown).toContain(">08-22</span>");
    expect(shown).toContain(">FY2026<");
    expect(shown).toContain("Updated 08-23");
    expect(shown).not.toContain("Aug 22");
    expect(shown).not.toContain(">2026<");
    // DateLine (narrow line): full role.
    expect(shown).toContain("2026/08/22");
    expect(shown).not.toContain("Aug 22, 2026");
    // <time datetime> stays raw ISO regardless of the pattern.
    expect(shown).toContain('datetime="2026-08-22"');
    expect(shown).toContain('datetime="2026-08-23"');
  });

  it("resolves distinct dateFormats patterns per locale", () => {
    const tagged = item("card", { date: "2026-08-22" });
    const en = serialize(
      NoteTrayIndex({
        ...base,
        locale: "en",
        style: "cards",
        showDate: true,
        items: [tagged],
        dateFormats: {
          full: "locale",
          monthDay: "MM/DD",
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
        style: "cards",
        showDate: true,
        items: [tagged],
        dateFormats: {
          full: "locale",
          monthDay: "M-D",
          year: "locale",
          yearMonth: "locale",
          numericMonthDay: "locale",
        },
      }),
    );
    expect(en).toContain(">08/22</span>");
    expect(ja).toContain(">8-22</span>");
    expect(ja).not.toContain(">08/22</span>");
  });
});
