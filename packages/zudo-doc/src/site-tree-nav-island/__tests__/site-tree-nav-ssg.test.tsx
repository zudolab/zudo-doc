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

const TREE_BLOCK_HTML = '<nav aria-label="Site index" data-site-nav="true" data-variant="default" class="zd-site-tree grid gap-vsp-md" style="grid-template-columns:repeat(auto-fill, minmax(min(18rem, 100%), 1fr));"><div class="zd-site-tree-card min-w-0 border border-muted bg-bg p-hsp-sm" data-site-tree-root="guides"><div class="zd-site-tree-body"><div class="min-w-0"><div class="zd-site-tree-head flex items-start justify-between gap-hsp-xs text-small"><button type="button" class="zd-site-tree-label flex min-w-0 flex-1 items-start text-left font-semibold text-fg break-words hover:text-accent hover:underline focus:underline focus-visible:text-accent" aria-expanded="true" aria-controls="zd-site-tree-guides"><span class="zd-site-tree-marker flex shrink-0 items-center justify-center" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 103.395 107.049" aria-hidden="true" class="shrink-0 w-[18px]"><path d="M5.746 5.74 0 11.49l20.987 20.96C34.126 45.572 41.963 53.45 41.948 53.523c-.012.062-9.456 9.544-20.986 21.07L0 95.55l5.714 5.715c3.142 3.143 5.748 5.715 5.79 5.715s2.63-2.563 5.75-5.696l17.939-18.001c21.867-21.94 29.443-29.599 29.443-29.768 0-.114-.665-.804-5.084-5.275C51.872 40.47 11.71.125 11.565.036 11.525.01 8.906 2.578 5.746 5.74m38.345-.066c-3.132 3.13-5.696 5.71-5.696 5.732-.001.022 2.16 2.185 4.8 4.807 2.641 2.623 8.382 8.338 12.758 12.702 15.38 15.337 23.763 23.641 24.314 24.086.19.153.346.336.346.405 0 .07-1.738 1.847-3.887 3.976a17515 17515 0 0 0-20.35 20.264 19555 19555 0 0 1-17.223 17.158c-.416.409-.757.77-.757.8 0 .083 11.415 11.485 11.457 11.445.235-.22 53.542-53.528 53.542-53.543C103.395 53.472 49.891.02 49.837 0c-.028-.01-2.613 2.543-5.746 5.674"></path></svg></span><span class="min-w-0">Guides</span></button><button type="button" class="zd-site-tree-toggle flex shrink-0 items-center justify-center border border-muted text-muted hover:text-accent hover:underline focus:underline focus-visible:text-accent" aria-expanded="true" aria-label="Collapse Guides" aria-controls="zd-site-tree-guides"><span class="inline-flex transition-transform duration-150" aria-hidden="true" style="transform:rotate(90deg)"><svg class="h-icon-xs w-icon-xs" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"></path></svg></span></button></div></div><div id="zd-site-tree-guides" class="min-w-0"><ul class="zd-site-tree-list" role="list"><li class="zd-site-tree-row" data-node="guides/getting-started"><span aria-hidden="true" class="zd-site-tree-rail" data-tree-rail="true" data-root="" data-first="true" data-last="true"></span><span aria-hidden="true" class="zd-site-tree-branch" data-tree-branch="true"></span><div class="zd-site-tree-line relative flex min-w-0 items-start gap-hsp-xs"><a href="/docs/guides/getting-started" class="zd-site-tree-label block min-w-0 flex-1 text-left text-fg break-words hover:text-accent hover:underline focus:underline focus-visible:text-accent"><span class="block">Getting Started</span></a></div></li></ul></div></div></div></nav>';

describe("SiteTreeNav — SSG HTML presence", () => {
  it("keeps the zudo-react tree-block markup deterministic", () => {
    const html = render(<SiteTreeNav tree={[SAMPLE_TREE[0]!]} />);
    expect(html).toBe(TREE_BLOCK_HTML);
  });

  it("renders a lazy 1200x630 cover image on a root card with coverHref", () => {
    const tree = [{ ...SAMPLE_TREE[2]!, coverHref: "/img/covers/reference.png" }];
    const html = render(<SiteTreeNav tree={tree} />);
    expect(html).toContain(
      '<img src="/img/covers/reference.png" alt="" width="1200" height="630" loading="lazy" decoding="async" class="zd-site-nav-cover">',
    );
  });

  it("renders no cover image without coverHref", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} />);
    expect(html).not.toContain("zd-site-nav-cover");
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

  it("keeps the 18px category icon inside its shared slot and omits the measured inert 2xl icon utility", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} />);
    expect(html).toContain('<span class="zd-site-tree-marker flex shrink-0 items-center justify-center" aria-hidden="true"><svg');
    expect(html).toContain('class="shrink-0 w-[18px]"');
    expect(html).not.toContain("2xl:w-[24px]");
  });

  it("starts explicitly selected root-category slugs collapsed", () => {
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

  it("matches full nested slugs at every depth without changing siblings or leaves", () => {
    const branch = (root: string): SidebarNavNode => ({
      slug: root, label: root, position: 0, href: `/base/ja/docs/${root}`, hasPage: true,
      children: [{
        slug: `${root}/utilities`, label: `${root} utilities`, position: 0,
        href: `/base/ja/docs/${root}/utilities`, hasPage: true,
        children: [{
          slug: `${root}/utilities/deep`, label: `${root} deep`, position: 0,
          href: `/base/ja/docs/${root}/utilities/deep`, hasPage: true,
          children: [{ slug: `${root}/utilities/deep/page`, label: `${root} page`, position: 0, href: `/base/ja/docs/${root}/utilities/deep/page`, hasPage: true, children: [] }],
        }],
      }],
    });
    const tree = [branch("a"), branch("b")];
    const original = structuredClone(tree);
    const html = render(<SiteTreeNav tree={tree} initiallyCollapsedCategorySlugs={["a/utilities/deep", "unknown", "a/utilities/deep", "b/utilities/deep/page"]} />);
    expect(html).toContain('href="/base/ja/docs/a/utilities/deep"');
    expect(html).toContain('aria-expanded="false" aria-label="Expand a deep"');
    expect(html).not.toContain('href="/base/ja/docs/a/utilities/deep/page"');
    expect(html).toContain('aria-expanded="true" aria-label="Collapse b deep"');
    expect(html).toContain('href="/base/ja/docs/b/utilities/deep/page"');
    expect(tree).toEqual(original);
    expect(render(<SiteTreeNav tree={tree} initiallyCollapsedCategorySlugs={[]} />)).toContain('href="/base/ja/docs/a/utilities/deep/page"');
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
      'href="/docs/changelog" class="zd-site-tree-label flex min-w-0 flex-1 items-start text-left font-semibold text-fg break-words hover:text-accent hover:underline focus:underline focus-visible:text-accent"',
    );
    // Leaf link (tree row).
    expect(html).toContain(
      'href="/docs/guides/getting-started" class="zd-site-tree-label block min-w-0 flex-1 text-left text-fg break-words hover:text-accent hover:underline focus:underline focus-visible:text-accent"',
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
      'class="group flex items-start gap-hsp-sm py-vsp-2xs text-small text-fg hover:text-accent hover:underline focus:underline focus-visible:text-accent"',
    );
    expect(html).toContain(
      'class="shrink-0 font-mono tabular-nums text-caption text-muted group-hover:text-accent group-focus-visible:text-accent"',
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
