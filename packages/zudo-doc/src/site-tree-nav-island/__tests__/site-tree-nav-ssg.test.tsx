/** @jsxRuntime automatic */
/**
 * SSG HTML-presence test for the SiteTreeNav island component.
 *
 * Verifies that the site navigation grid appears in the serialized HTML
 * produced by zudo-react. The static markup must contain
 * the nav structure so crawlers and JS-off users can discover all sections.
 */

import { describe, expect, it } from "vitest";
import { h } from "@takazudo/zfb/zudo-react";
import { islandRoot } from "@takazudo/zfb/zudo-react/server";
import { renderSsr as render } from "../../__tests__/helpers/zudo-react.js";
import { SiteTreeNav } from "../index.js";
import type { SidebarNavNode } from "../../sidebar/types.js";

const SAMPLE_TREE: SidebarNavNode[] = [
  {
    slug: "guides",
    label: "Guides",
    position: 0,
    hasPage: false,
    children: [
      {
        slug: "guides/getting-started",
        label: "Getting Started",
        position: 0,
        href: "/docs/guides/getting-started",
        hasPage: true,
        children: [],
      },
    ],
  },
  {
    slug: "changelog",
    label: "Release notes",
    position: 1,
    href: "/docs/changelog",
    hasPage: true,
    children: [
      {
        slug: "changelog/1.0.0",
        label: "1.0.0",
        position: 0,
        href: "/docs/changelog/1.0.0",
        hasPage: true,
        children: [],
      },
    ],
  },
  {
    slug: "reference",
    label: "Reference",
    position: 2,
    href: "/docs/reference",
    hasPage: true,
    children: [],
  },
];

const TREE_BLOCK_HTML = '<nav aria-label="Site index" data-site-nav="true" class="grid gap-vsp-md" style="grid-template-columns:repeat(auto-fill, minmax(min(18rem, 100%), 1fr));"><div class="min-w-0 border border-muted pl-hsp-sm py-vsp-2xs"><div class=""><div class="relative"><div class="flex w-full items-center justify-between text-small font-semibold pt-[0.15rem] text-fg" style="padding-left:clamp(0.5rem, 0.8vw, 1rem);"><button type="button" class="flex-1 min-w-0 break-words py-vsp-xs text-left hover:text-accent hover:underline focus:underline">Guides</button><button type="button" class="aspect-square flex items-center justify-center w-[1.75rem] border-y border-l border-muted hover:underline focus:underline" aria-expanded="true" aria-label="Collapse Guides"><span class="inline-flex transition-transform duration-150" style="transform:rotate(90deg)"><svg class="h-icon-xs w-icon-xs text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"></path></svg></span></button></div></div><div><div><div class="relative"><div class="absolute border-l border-dashed border-muted" style="left:calc(1 * clamp(0.8rem, 1.2vw, 1.625rem) + clamp(0.2rem, 0.3vw, 0.5rem));top:0px;bottom:calc(100% - calc(var(--spacing-vsp-2xs) + 0.5lh));"></div><div class="absolute border-t border-dashed border-muted" style="left:calc(1 * clamp(0.8rem, 1.2vw, 1.625rem) + clamp(0.2rem, 0.3vw, 0.5rem));width:calc(clamp(0.4rem, 0.6vw, 1rem) * 2);top:calc(var(--spacing-vsp-2xs) + 0.5lh);"></div><a href="/docs/guides/getting-started" class="block py-vsp-2xs pr-hsp-sm pb-vsp-xs text-small text-fg break-words hover:text-accent hover:underline focus:underline focus-visible:text-accent" style="padding-left:calc(1 * clamp(0.8rem, 1.2vw, 1.625rem) + 1.25rem + 5px);">Getting Started</a></div></div></div></div></div></nav>';

describe("SiteTreeNav — SSG HTML presence", () => {
  it("keeps the zudo-react tree-block markup deterministic", () => {
    const html = render(<SiteTreeNav tree={[SAMPLE_TREE[0]!]} />);
    expect(html).toBe(TREE_BLOCK_HTML);
  });

  it("renders a nav element with aria-label in static HTML", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} />);
    expect(html).toContain("<nav");
    expect(html).toContain('aria-label="Site index"');
  });

  it("renders custom aria-label when provided", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} ariaLabel="Docs index" />);
    expect(html).toContain('aria-label="Docs index"');
  });

  it("renders category label text in static HTML", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} />);
    expect(html).toContain("Guides");
    expect(html).toContain("Reference");
  });

  it("renders child node href in static HTML", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} />);
    expect(html).toContain('href="/docs/guides/getting-started"');
  });

  it("keeps the #4435 calc spelling and omits the measured inert 2xl icon utility", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} />);
    expect(html).toContain(
      "py-[calc(var(--spacing-vsp-xs)_+_0.15rem)]",
    );
    expect(html).toContain('class="shrink-0 w-[18px]"');
    expect(html).not.toContain("2xl:w-[24px]");
  });

  it("starts only explicitly selected root-category slugs collapsed", () => {
    const html = render(
      <SiteTreeNav
        tree={SAMPLE_TREE}
        initiallyCollapsedCategorySlugs={["changelog"]}
      />,
    );

    expect(html).toContain('aria-expanded="false" aria-label="Expand Release notes"');
    expect(html).not.toContain('href="/docs/changelog/1.0.0"');
    expect(html).toContain('aria-expanded="true" aria-label="Collapse Guides"');
    expect(html).toContain('href="/docs/guides/getting-started"');
  });

  it("keeps all categories expanded by default without inferring from labels", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} />);

    expect(html).toContain('aria-expanded="true" aria-label="Collapse Release notes"');
    expect(html).toContain('href="/docs/changelog/1.0.0"');
  });

  it("renders the data-site-nav attribute in static HTML", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} />);
    expect(html).toContain("data-site-nav");
  });

  it("respects categoryIgnore to filter nodes", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} categoryIgnore={["guides"]} />);
    expect(html).not.toContain("Getting Started");
    expect(html).toContain("Reference");
  });

  it("orders requested root categories before unmatched roots", () => {
    const html = render(
      <SiteTreeNav tree={SAMPLE_TREE} categoryOrder={["reference", "guides"]} />,
    );
    expect(html.indexOf("Reference")).toBeLessThan(html.indexOf("Guides"));
    expect(html.indexOf("Guides")).toBeLessThan(html.indexOf("Release notes"));
  });

  it("renders empty nav when all nodes are ignored", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} categoryIgnore={["guides", "reference"]} />);
    expect(html).toContain("<nav");
    // No category cards rendered
    expect(html).not.toContain("Getting Started");
    expect(html).not.toContain('href="/docs/reference"');
  });
});

describe("SiteTreeNav — note-tray blocks", () => {
  it("renders an index tray as flat, zero-padded ranked rows", () => {
    const html = render(
      <SiteTreeNav
        tree={[
          {
            slug: "series",
            label: "Series",
            position: 0,
            href: "/docs/series",
            hasPage: true,
            shape: "note-tray",
            children: [
              { slug: "series/intro", label: "Introduction", position: 0, href: "/docs/series/intro", hasPage: true, rank: 1, children: [] },
              { slug: "series/install", label: "Installation", position: 1, href: "/docs/series/install", hasPage: true, rank: 2, children: [] },
            ],
          },
        ]}
      />,
    );

    expect(html).toContain('data-note-tray-row="true"');
    expect(html).toContain(">01</span><span class=\"min-w-0 break-words\"><span>Introduction</span>");
    expect(html).toContain(">02</span><span class=\"min-w-0 break-words\"><span>Installation</span>");
    expect(html).toContain('style="width:2ch;">01</span>');
    expect(html).not.toContain("border-dashed");
  });

  it("renders a dated index tray with full dates and no group headings", () => {
    const html = render(
      <SiteTreeNav
        locale="en"
        updatedLabel="Updated"
        tree={[
          {
            slug: "news",
            label: "News",
            position: 0,
            href: "/docs/news",
            hasPage: true,
            shape: "note-tray",
            noteTrayDated: true,
            noteTraySidebar: "index",
            children: [
              { slug: "news/one", label: "One", position: 0, href: "/docs/news/one", hasPage: true, rank: 1, date: "2026-08-19", updated: "2026-08-20", children: [] },
            ],
          },
        ]}
      />,
    );

    expect(html).toContain('<time datetime="2026-08-19"');
    expect(html).toContain("Aug 19, 2026");
    expect(html).not.toContain("Updated");
    expect(html).not.toContain("data-note-tray-group");
  });

  it("keeps optional dates as ranks in an undated index tray", () => {
    const html = render(
      <SiteTreeNav
        locale="en"
        tree={[
          {
            slug: "series",
            label: "Series",
            position: 0,
            href: "/docs/series",
            hasPage: true,
            shape: "note-tray",
            noteTraySidebar: "index",
            children: [
              { slug: "series/intro", label: "Introduction", position: 0, href: "/docs/series/intro", hasPage: true, rank: 1, date: "2026-08-19", children: [] },
            ],
          },
        ]}
      />,
    );

    expect(html).toContain(">01</span><span class=\"min-w-0 break-words\"><span>Introduction</span>");
    expect(html).not.toContain('<time datetime="2026-08-19"');
    expect(html).not.toContain("Aug 19, 2026");
  });

  it("renders dated month groups chronologically with rank-ordered rows", () => {
    const html = render(
      <SiteTreeNav
        locale="ja"
        updatedLabel="更新"
        tree={[
          {
            slug: "blog",
            label: "Blog",
            position: 0,
            href: "/docs/blog",
            hasPage: true,
            shape: "note-tray",
            noteTrayDated: true,
            noteTraySidebar: "month",
            sortOrder: "desc",
            children: [
              { slug: "blog/older", label: "Older", position: 0, href: "/docs/blog/older", hasPage: true, rank: 1, date: "2026-07-28", children: [] },
              { slug: "blog/newest", label: "Newest", position: 2, href: "/docs/blog/newest", hasPage: true, rank: 3, date: "2026-08-19", children: [] },
              { slug: "blog/newer", label: "Newer", position: 1, href: "/docs/blog/newer", hasPage: true, rank: 2, date: "2026-08-12", updated: "2026-08-15", children: [] },
            ],
          },
        ]}
      />,
    );

    expect(html).toContain('data-note-tray-group="2026-08"');
    expect(html).toContain("2026年8月");
    expect(html).toContain(">08-19</time>");
    expect(html).not.toContain("更新");
    expect(html.indexOf("Newest")).toBeLessThan(html.indexOf("Newer"));
    expect(html.indexOf("2026年8月")).toBeLessThan(html.indexOf("2026年7月"));
  });

  it("renders dated year groups as plain one-level headings", () => {
    const html = render(
      <SiteTreeNav
        tree={[
          {
            slug: "notes",
            label: "Notes",
            position: 0,
            href: "/docs/notes",
            hasPage: true,
            shape: "note-tray",
            noteTrayDated: true,
            noteTraySidebar: "year",
            children: [
              { slug: "notes/one", label: "One", position: 0, href: "/docs/notes/one", hasPage: true, rank: 1, date: "2025-12-02", children: [] },
            ],
          },
        ]}
      />,
    );

    expect(html).toContain('data-note-tray-group="2025"');
    expect(html).toContain(">2025</div>");
    expect(html).not.toContain("Collapse 2025");
  });

  it("omits an empty note tray", () => {
    const html = render(
      <SiteTreeNav
        tree={[
          { slug: "empty", label: "Empty", position: 0, href: "/docs/empty", hasPage: true, shape: "note-tray", children: [] },
        ]}
      />,
    );
    expect(html).not.toContain("Empty");
  });
});

describe("SiteTreeNav — link-color rule (focus-visible accent)", () => {
  it("gives the category link, leaf link, and note-tray row anchors a focus-visible accent", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} />);
    // Category link (CategoryNode's <a href>).
    expect(html).toContain(
      'href="/docs/changelog" class="flex-1 flex items-start gap-hsp-xs py-vsp-xs text-fg hover:text-accent hover:underline focus:underline focus-visible:text-accent"',
    );
    // Leaf link (LeafNode, non-root depth).
    expect(html).toContain(
      'href="/docs/guides/getting-started" class="block py-vsp-2xs pr-hsp-sm pb-vsp-xs text-small text-fg break-words hover:text-accent hover:underline focus:underline focus-visible:text-accent"',
    );
  });

  it("gives note-tray row anchors a focus-visible accent", () => {
    const html = render(
      <SiteTreeNav
        tree={[
          {
            slug: "series",
            label: "Series",
            position: 0,
            href: "/docs/series",
            hasPage: true,
            shape: "note-tray",
            children: [
              { slug: "series/intro", label: "Introduction", position: 0, href: "/docs/series/intro", hasPage: true, rank: 1, children: [] },
            ],
          },
        ]}
      />,
    );
    expect(html).toContain(
      'class="flex items-start gap-hsp-sm py-vsp-2xs text-small text-fg hover:text-accent hover:underline focus:underline focus-visible:text-accent"',
    );
  });
});

describe("SiteTreeNav — displayName pin", () => {
  it("has displayName set to SiteTreeNav", () => {
    expect(SiteTreeNav.displayName).toBe("SiteTreeNav");
  });
});

describe("SiteTreeNav — call-site Island marker", () => {
  it("keeps the site nav idle and emits its v3 island boundary in SSG output", () => {
    const html = render(
      islandRoot(h(SiteTreeNav, { tree: SAMPLE_TREE }), {
        identity: { component: "SiteTreeNav", build: "test" },
        when: "idle",
      }),
    );
    expect(html).toContain('data-zfb-island="SiteTreeNav"');
    expect(html).toContain('data-when="idle"');
  });
});
