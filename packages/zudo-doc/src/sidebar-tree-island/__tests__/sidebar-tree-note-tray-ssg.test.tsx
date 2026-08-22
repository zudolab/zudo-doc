/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { filterTree } from "../../sidebar-filter/index.js";
import type { SidebarNavNode, SidebarLocaleLink } from "../../sidebar/types.js";
import { SidebarToggle } from "../../sidebar-toggle-island/index.js";
import { SidebarTree } from "../index.js";

function item(
  slug: string,
  label: string,
  rank: number,
  date?: string,
): SidebarNavNode {
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

function tray(
  sidebar: "index" | "year" | "month",
  children: SidebarNavNode[],
  sortOrder: "asc" | "desc" = "asc",
): SidebarNavNode {
  return {
    slug: "notes",
    label: "Notes",
    position: 1,
    href: "/docs/notes",
    hasPage: true,
    shape: "note-tray",
    noteTrayDated: sidebar !== "index",
    noteTraySidebar: sidebar,
    sortOrder,
    children,
  };
}

const JA_LINKS: SidebarLocaleLink[] = [
  { code: "en", label: "English", href: "/docs/notes", active: false },
  { code: "ja", label: "日本語", href: "/ja/docs/notes", active: true },
];

describe("SidebarTree — note tray SSG", () => {
  it("renders an index tray as a root link and flat ranked rows with no collapse controls", () => {
    const nodes = [tray("index", [
      item("alpha", "Alpha title", 1, "2026-01-02"),
      item("beta", "Beta title", 2),
      item("gamma", "Gamma title", 3),
    ])];
    const html = render(<SidebarTree nodes={nodes} currentSlug="notes/beta" />);

    expect(html).toContain('href="/docs/notes"');
    expect(html).toMatch(/>01<\/span><span[^>]*>Alpha title<\/span>/);
    expect(html).toMatch(/>02<\/span><span[^>]*>Beta title<\/span>/);
    expect(html).toMatch(/>03<\/span><span[^>]*>Gamma title<\/span>/);
    expect(html).not.toMatch(/aria-label="(?:Collapse|Expand) /);
    expect(html).not.toContain("01-02");

    const activeLink = html.match(/<a href="\/docs\/notes\/beta"[^>]*>/)?.[0];
    expect(activeLink).toContain('aria-current="page"');
    expect(activeLink).toContain("data-nav-active");
  });

  it("marks the non-collapsible tray root active on the index page", () => {
    const html = render(
      <SidebarTree nodes={[tray("index", [item("alpha", "Alpha", 1)])]} currentSlug="notes" />,
    );
    const rootLink = html.match(/<a href="\/docs\/notes"[^>]*>/)?.[0];

    expect(rootLink).toContain('aria-current="page"');
    expect(html).not.toMatch(/aria-label="(?:Collapse|Expand) Notes"/);
  });

  it("renders descending year groups with only the active group open and MM-DD dates", () => {
    const nodes = [tray("year", [
      item("older", "Older", 1, "2025-12-09"),
      item("newest", "Newest", 3, "2026-08-22"),
      item("active", "Active article", 2, "2026-01-03"),
    ], "desc")];
    const html = render(<SidebarTree nodes={nodes} currentSlug="notes/active" />);

    expect(html.indexOf("Collapse 2026")).toBeLessThan(html.indexOf("Expand 2025"));
    expect(html).toContain('aria-label="Collapse 2026"');
    expect(html).toContain('aria-label="Expand 2025"');
    expect(html).toContain("08-22");
    expect(html).toContain("01-03");
    expect(html).not.toContain("12-09");
    expect(html.indexOf("Newest")).toBeLessThan(html.indexOf("Active article"));
  });

  it("localizes month labels for English and Japanese and keeps active groups open", () => {
    const nodes = [tray("month", [
      item("july", "July note", 1, "2026-07-02"),
      item("august", "August note", 2, "2026-08-05"),
    ], "desc")];

    const english = render(<SidebarTree nodes={nodes} currentSlug="notes/august" />);
    const japanese = render(
      <SidebarTree nodes={nodes} currentSlug="notes/august" localeLinks={JA_LINKS} />,
    );

    expect(english).toContain('aria-label="Collapse 2026 August"');
    expect(english).toContain('aria-label="Expand 2026 July"');
    expect(japanese).toContain('aria-label="Collapse 2026年8月"');
    expect(japanese).toContain('aria-label="Expand 2026年7月"');
    expect(english).toContain("08-05");
  });

  it("keeps a grouped tray and only its matching title when filtered", () => {
    const nodes = [tray("month", [
      item("alpha", "Alpha title", 1, "2026-08-01"),
      item("beta", "Beta target", 2, "2026-08-02"),
    ])];
    const filtered = filterTree(nodes, "target");
    const html = render(<SidebarTree nodes={filtered} currentSlug="notes/beta" />);

    expect(html).toContain("Beta target");
    expect(html).not.toContain("Alpha title");
    expect(html).toContain("2026 August");
  });

  it("names persisted group state by tray slug and group key", () => {
    const yearHtml = render(
      <SidebarTree nodes={[tray("year", [item("alpha", "Alpha", 1, "2026-01-02")])]} />,
    );
    const monthHtml = render(
      <SidebarTree nodes={[tray("month", [item("alpha", "Alpha", 1, "2026-01-02")])]} />,
    );
    const otherTray = tray("year", [item("alpha", "Alpha", 1, "2026-01-02")]);
    otherTray.slug = "releases";
    const otherHtml = render(<SidebarTree nodes={[otherTray]} />);

    expect(yearHtml).toContain('data-zd-sidebar-open-key="notes#2026"');
    expect(monthHtml).toContain('data-zd-sidebar-open-key="notes#2026-01"');
    expect(otherHtml).toContain('data-zd-sidebar-open-key="releases#2026"');
  });

  it("renders the same tray rows inside the mobile drawer", () => {
    const html = render(
      <SidebarToggle
        nodes={[tray("index", [item("alpha", "Mobile alpha", 1)])]}
        currentSlug="notes/alpha"
      />,
    );

    expect(html).toMatch(/>01<\/span><span[^>]*>Mobile alpha<\/span>/);
    expect(html).toContain('data-nav-active');
  });

  it("does not invent rank 00 when an optional rank is absent", () => {
    const unranked = item("unranked", "Unranked", 1);
    unranked.rank = undefined;
    const html = render(<SidebarTree nodes={[tray("index", [unranked])]} />);

    expect(html).not.toContain(">00</span>");
    expect(html).toContain(">Unranked</span>");
  });
});
