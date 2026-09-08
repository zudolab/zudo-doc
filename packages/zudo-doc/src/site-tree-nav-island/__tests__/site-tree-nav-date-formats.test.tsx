/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SiteTreeNav — per-role date patterns from the `dateFormats` prop (#4078).
 *
 * Patterns arrive already resolved for the page locale (the island never
 * re-resolves the setting client-side). Each role carries a DISTINCT pattern
 * so a mis-wired role fails on a mismatched literal instead of passing by
 * coincidence.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import type { ResolvedDateFormats } from "../../settings.js";
import type { SidebarNavNode } from "../../sidebar/types.js";
import { SiteTreeNav } from "../index.js";

const FORMATS: ResolvedDateFormats = {
  full: "YYYY/MM/DD",
  monthDay: "[md]MM-DD",
  year: "[FY]YYYY",
  yearMonth: "MMMM [of] YYYY",
  numericMonthDay: "D.M",
};

function noteTray(
  sidebar: "index" | "year" | "month",
  children: SidebarNavNode[],
): SidebarNavNode[] {
  return [
    {
      slug: "notes",
      label: "Notes",
      position: 0,
      href: "/docs/notes",
      hasPage: true,
      shape: "note-tray",
      noteTrayDated: true,
      noteTraySidebar: sidebar,
      children,
    },
  ];
}

const ROW: SidebarNavNode = {
  slug: "notes/one",
  label: "One",
  position: 0,
  href: "/docs/notes/one",
  hasPage: true,
  rank: 1,
  date: "2026-08-19",
  children: [],
};

describe("SiteTreeNav — dateFormats roles", () => {
  it("falls back to today's output when the prop is omitted entirely", () => {
    expect(render(<SiteTreeNav locale="en" tree={noteTray("index", [ROW])} />)).toContain(
      "Aug 19, 2026",
    );
    expect(render(<SiteTreeNav locale="en" tree={noteTray("month", [ROW])} />)).toContain(
      "2026 August",
    );
    const yearHtml = render(<SiteTreeNav locale="en" tree={noteTray("year", [ROW])} />);
    expect(yearHtml).toContain(">2026</div>");
    expect(yearHtml).toContain(">08-19</time>");
  });

  it("formats the year-group heading with the `year` role while data-note-tray-group stays raw", () => {
    const html = render(
      <SiteTreeNav locale="en" tree={noteTray("year", [ROW])} dateFormats={FORMATS} />,
    );

    expect(html).toContain('data-note-tray-group="2026"');
    expect(html).toContain(">FY2026</div>");
  });

  it("formats the month-group heading with the `yearMonth` role", () => {
    const html = render(
      <SiteTreeNav locale="en" tree={noteTray("month", [ROW])} dateFormats={FORMATS} />,
    );

    expect(html).toContain('data-note-tray-group="2026-08"');
    expect(html).toContain(">August of 2026</div>");
    expect(html).not.toContain("2026 August");
  });

  it("uses `numericMonthDay` for grouped rows and `full` for ungrouped rows", () => {
    const grouped = render(
      <SiteTreeNav locale="en" tree={noteTray("year", [ROW])} dateFormats={FORMATS} />,
    );
    const flat = render(
      <SiteTreeNav locale="en" tree={noteTray("index", [ROW])} dateFormats={FORMATS} />,
    );

    expect(grouped).toContain(">19.8</time>");
    expect(grouped).not.toContain("2026/08/19");
    expect(flat).toContain(">2026/08/19</time>");
    expect(flat).not.toContain(">19.8</time>");
  });

  it("keeps <time datetime> as raw ISO under every role", () => {
    const grouped = render(
      <SiteTreeNav locale="en" tree={noteTray("year", [ROW])} dateFormats={FORMATS} />,
    );
    const flat = render(
      <SiteTreeNav locale="en" tree={noteTray("index", [ROW])} dateFormats={FORMATS} />,
    );

    expect(grouped).toContain('<time datetime="2026-08-19"');
    expect(flat).toContain('<time datetime="2026-08-19"');
  });

  it("resolves MMM month names in `numericMonthDay` against the page locale", () => {
    const html = render(
      <SiteTreeNav
        locale="ja"
        tree={noteTray("year", [ROW])}
        dateFormats={{ ...FORMATS, numericMonthDay: "MMM D" }}
      />,
    );

    expect(html).toContain(">8月 19</time>");
  });
});
