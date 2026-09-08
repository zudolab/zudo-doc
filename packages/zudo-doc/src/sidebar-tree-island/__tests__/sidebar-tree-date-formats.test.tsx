/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SidebarTree — per-role date patterns from the `dateFormats` prop (#4078).
 *
 * The island consumes patterns already resolved for the page locale at SSR
 * time; it never re-resolves the `dateFormat` setting client-side. Every role
 * here carries a DISTINCT pattern so a role wired to the wrong pattern shows
 * up as a mismatched literal rather than passing by coincidence.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import type { ResolvedDateFormats } from "../../settings.js";
import type { SidebarNavNode, SidebarLocaleLink } from "../../sidebar/types.js";
import { SidebarToggle } from "../../sidebar-toggle-island/index.js";
import { SidebarTree } from "../index.js";

const FORMATS: ResolvedDateFormats = {
  full: "YYYY/MM/DD",
  monthDay: "[md]MM-DD",
  year: "[FY]YYYY",
  yearMonth: "MMMM [of] YYYY",
  numericMonthDay: "D.M",
};

const JA_LINKS: SidebarLocaleLink[] = [
  { code: "en", label: "English", href: "/docs/notes", active: false },
  { code: "ja", label: "日本語", href: "/ja/docs/notes", active: true },
];

function item(slug: string, label: string, rank: number, date?: string): SidebarNavNode {
  return {
    slug: `notes/${slug}`,
    label,
    position: rank,
    rank,
    date,
    href: `/docs/notes/${slug}`,
    hasPage: true,
    children: [],
  };
}

function tray(sidebar: "index" | "year" | "month", children: SidebarNavNode[]): SidebarNavNode {
  return {
    slug: "notes",
    label: "Notes",
    position: 1,
    href: "/docs/notes",
    hasPage: true,
    shape: "note-tray",
    noteTrayDated: sidebar !== "index",
    noteTraySidebar: sidebar,
    sortOrder: "desc",
    children,
  };
}

const YEAR_TRAY = [tray("year", [item("august", "August note", 2, "2026-08-22")])];
const MONTH_TRAY = [tray("month", [item("august", "August note", 2, "2026-08-22")])];
// Grouped rows only render inside an expanded group, and a group auto-expands
// when it contains the current page.
const CURRENT = "notes/august";

describe("SidebarTree — dateFormats roles", () => {
  it("falls back to today's output when the prop is omitted entirely", () => {
    const yearHtml = render(<SidebarTree nodes={YEAR_TRAY} currentSlug={CURRENT} />);
    const monthHtml = render(<SidebarTree nodes={MONTH_TRAY} currentSlug={CURRENT} />);

    expect(yearHtml).toContain('aria-label="Collapse 2026"');
    expect(yearHtml).toContain("08-22");
    expect(monthHtml).toContain('aria-label="Collapse 2026 August"');
  });

  it("formats the year-group heading with the `year` role while the group key stays raw", () => {
    const html = render(<SidebarTree nodes={YEAR_TRAY} currentSlug={CURRENT} dateFormats={FORMATS} />);

    expect(html).toContain('aria-label="Collapse FY2026"');
    expect(html).toContain(">FY2026</span>");
    // Grouping/persistence identity must not follow the display pattern.
    expect(html).toContain('data-zd-sidebar-open-key="notes#2026"');
  });

  it("formats the month-group heading with the `yearMonth` role", () => {
    const html = render(<SidebarTree nodes={MONTH_TRAY} currentSlug={CURRENT} dateFormats={FORMATS} />);

    expect(html).toContain('aria-label="Collapse August of 2026"');
    expect(html).toContain('data-zd-sidebar-open-key="notes#2026-08"');
    expect(html).not.toContain("2026 August");
  });

  it("formats grouped row dates with the `numericMonthDay` role, not `full` or `monthDay`", () => {
    const html = render(<SidebarTree nodes={YEAR_TRAY} currentSlug={CURRENT} dateFormats={FORMATS} />);

    expect(html).toContain(">22.8</span>");
    expect(html).not.toContain("2026/08/22");
    expect(html).not.toContain("md08-22");
  });

  it("resolves MMM month names in `numericMonthDay` against the active locale", () => {
    const nodes = [tray("year", [item("august", "August note", 2, "2026-08-22")])];
    const html = render(
      <SidebarTree
        nodes={nodes}
        currentSlug={CURRENT}
        localeLinks={JA_LINKS}
        dateFormats={{ ...FORMATS, numericMonthDay: "MMM D" }}
      />,
    );

    expect(html).toContain(">8月 22</span>");
  });

  it("threads the roles through the mobile drawer wrapper", () => {
    const html = render(<SidebarToggle nodes={YEAR_TRAY} currentSlug={CURRENT} dateFormats={FORMATS} />);

    expect(html).toContain("FY2026");
    expect(html).toContain("22.8");
  });
});
