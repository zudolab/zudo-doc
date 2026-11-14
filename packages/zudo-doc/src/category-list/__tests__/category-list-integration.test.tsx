/** @jsxRuntime automatic */
/**
 * Category list through the REAL route context: nav source (locale merge,
 * default-locale-only filter, visibility), nav tree, route-slug overrides,
 * base path and version href remapping, then the homepage recipe and the
 * locale/version-bound `<CategoryList>` MDX binding (#4802).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { h } from "@takazudo/zfb/zudo-react";
import type { Child, Component } from "@takazudo/zfb/zudo-react";
import { renderSsr as render } from "../../__tests__/helpers/zudo-react.js";
import { createRouteContextPayload } from "../../route-context-payload/index.js";
import { createRouteContext } from "../../route-context/index.js";
import { createChrome } from "../../chrome/index.js";
import { deriveMdxComponents } from "../../chrome/derive.js";
import type { HomeSection, Settings } from "../../settings.js";
import type { CategoryListProps } from "../index.js";

vi.mock("../../doclayout/index.js", () => ({
  DocLayoutWithDefaults: (props: Record<string, unknown>) => <main>{props.children as Child}</main>,
}));
vi.mock("../../head-with-defaults/index.js", () => ({ createHeadWithDefaults: () => () => null }));
vi.mock("../../auto-logo/index.js", () => ({ AutoLogo: () => <svg aria-hidden="true" /> }));
vi.mock("@takazudo/zfb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@takazudo/zfb")>();
  return { ...actual, Island: () => <div data-zd-test-island /> };
});

type Doc = { slug: string; data: Record<string, unknown> };
const doc = (slug: string, data: Record<string, unknown>): Doc => ({ slug, data: { title: slug, ...data } });

function blogPosts(count: number): Doc[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const date = `2026-01-${String(n).padStart(2, "0")}`;
    return doc(`blog/post-${n}`, { title: `Post ${n}`, date, sidebar_position: n });
  });
}

const EN_DOCS: Doc[] = [
  doc("blog/index", {
    title: "Blog",
    category_shape: "note-tray",
    note_tray_dated: true,
    category_sort_order: "desc",
  }),
  ...blogPosts(12).map((d) =>
    d.slug === "blog/post-12"
      ? { ...d, data: { ...d.data, description: "Newest post.", updated: "2026-02-01", tags: ["design", "design"] } }
      : d.slug === "blog/post-11"
        ? { ...d, data: { ...d.data, updated: d.data.date } }
        : d,
  ),
  // Public visibility: hidden from navigation and therefore from the listing.
  doc("blog/post-unlisted", { title: "Hidden unlisted", date: "2026-03-01", unlisted: true }),
  doc("blog/post-standalone", { title: "Hidden standalone", date: "2026-03-02", standalone: true }),
  // search_exclude is not a navigation filter.
  doc("blog/post-search-excluded", { title: "Search excluded", date: "2026-01-13", sidebar_position: 13, search_exclude: true }),
  doc("notes/index", { title: "Notes", category_shape: "note-tray", category_sort_order: "asc" }),
  doc("notes/first", { title: "First note", sidebar_position: 1 }),
  doc("notes/second", { title: "Second note", sidebar_position: 2 }),
  doc("notes/third", { title: "Third note", sidebar_position: 3 }),
  doc("guides/index", { title: "Guides", description: "How-to guides." }),
  doc("guides/setup", { title: "Setup", sidebar_position: 1, description: "Install it." }),
  // Grouping-only folder (no index page) with a real document inside.
  doc("guides/advanced/tuning", { title: "Tuning", sidebar_position: 2 }),
  // Route-slug override: the canonical route is guides/ship, not the file path.
  doc("guides/deployment-file", { title: "Ship it", slug: "guides/ship", sidebar_position: 3 }),
  doc("reference/index", { title: "Reference", category_no_page: true }),
  doc("reference/api", { title: "API" }),
  doc("hidden-cat/index", { title: "Hidden category" }),
  doc("hidden-cat/only", { title: "Only", unlisted: true }),
  doc("dormant/index", { title: "Dormant", unlisted: true }),
  doc("dormant/later", { title: "Later", unlisted: true }),
  doc("en-only/index", { title: "English only" }),
  doc("en-only/page", { title: "English page" }),
];

const JA_DOCS: Doc[] = [
  doc("blog/index", { title: "ブログ", category_shape: "note-tray", note_tray_dated: true, category_sort_order: "desc" }),
  doc("blog/post-12", {
    title: "とても長い日本語のタイトルが折り返されることを確認するための投稿",
    date: "2026-01-12",
    sidebar_position: 12,
  }),
  // An unlisted translation must not leak its English fallback.
  doc("blog/post-11", { title: "非公開の翻訳", date: "2026-01-11", sidebar_position: 11, unlisted: true }),
];

function makeRoute(settings: Partial<Settings>, extraCollections: Record<string, Doc[]> = {}) {
  const payload = createRouteContextPayload({
    siteTitle: "Category list site",
    settings: {
      locales: { ja: { label: "日本語", dir: "src/content/docs-ja" } },
      defaultLocaleOnlyPrefixes: ["/docs/en-only/"],
      ...settings,
    } as Partial<Settings>,
  });
  const collections: Record<string, Doc[]> = { docs: EN_DOCS, "docs-ja": JA_DOCS, ...extraCollections };
  return createRouteContext(JSON.parse(JSON.stringify(payload)), {
    stableDocs: (name: string) => (collections[name] ?? []) as never,
  });
}

function renderHome(sections: HomeSection[], locale = "en", settings: Partial<Settings> = {}) {
  const route = makeRoute({
    home: { sections: [{ type: "site-tree" }, ...sections] },
    ...settings,
  } as Partial<Settings>);
  const { HomePageView } = createChrome(route, {});
  return render(<HomePageView locale={locale} tree={[]} categoryOrder={[]} tagCount={0} />);
}

function sectionHtml(html: string, index: number): string {
  const marker = `id="zd-home-category-list-${index}-heading"`;
  const start = html.lastIndexOf("<section", html.indexOf(marker));
  return html.slice(start, html.indexOf("</section>", start));
}

const titles = (html: string): string[] =>
  [...html.matchAll(/<h3 class="zd-category-list-title[^"]*">([^<]*)<\/h3>/g)].map((m) => m[1]!);

afterEach(() => vi.restoreAllMocks());

describe("category-list home section", () => {
  it("cards and list resolve the same items, ranks and links", () => {
    const html = renderHome([
      { type: "category-list", category: "blog", limit: 4, lead: "rank" },
      { type: "category-list", category: "blog", limit: 4, lead: "rank", layout: "list" },
    ]);
    const cards = sectionHtml(html, 1);
    const list = sectionHtml(html, 2);
    expect(cards).toContain('data-layout="cards"');
    expect(list).toContain('data-layout="list"');
    // search_exclude stays; unlisted/standalone are gone before counting.
    expect(titles(cards)).toEqual(["Search excluded", "Post 12", "Post 11", "Post 10"]);
    expect(titles(list)).toEqual(titles(cards));
    const ranks = (s: string) => [...s.matchAll(/zd-category-list-rank[^>]*>(\d+)</g)].map((m) => m[1]);
    expect(ranks(cards)).toEqual(["13", "12", "11", "10"]);
    expect(ranks(list)).toEqual(ranks(cards));
    const hrefs = (s: string) => [...s.matchAll(/<a href="([^"]+)" class="zd-category-list-link/g)].map((m) => m[1]);
    expect(hrefs(cards)).toEqual([
      "/docs/blog/post-search-excluded",
      "/docs/blog/post-12",
      "/docs/blog/post-11",
      "/docs/blog/post-10",
    ]);
    expect(hrefs(list)).toEqual(hrefs(cards));
    expect(html).not.toContain("Hidden unlisted");
    expect(html).not.toContain("Hidden standalone");
  });

  it("dated tray: auto lead is the publication date, never repeated, updated labelled and deduped", () => {
    const html = renderHome([
      { type: "category-list", category: "blog", limit: 4, showDate: true, showUpdated: true, showTags: true, showCount: true },
    ], "en", { docTags: true } as Partial<Settings>);
    const section = sectionHtml(html, 1);
    expect(section).toContain('data-lead="date"');
    // Post 12: one publication <time> (the lead) plus an "Updated" one.
    const post12 = section.slice(section.indexOf('href="/docs/blog/post-12"'), section.indexOf('href="/docs/blog/post-11"'));
    expect(post12.match(/datetime="2026-01-12"/g)).toHaveLength(1);
    expect(post12).toContain('datetime="2026-02-01"');
    expect(post12).toContain("Updated <time");
    // Tags are plain text, deduplicated, and never links.
    expect(post12.match(/zd-category-list-tag /g)).toHaveLength(1);
    // Post 11's updated date equals its publication date → omitted.
    const post11 = section.slice(section.indexOf('href="/docs/blog/post-11"'), section.indexOf('href="/docs/blog/post-10"'));
    expect(post11).not.toContain("Updated");
    // Count is visible/total before the limit (13 eligible incl. search-excluded).
    expect(section).toContain("Showing 4 of 13");
    // No nested anchors: every item anchor closes before the next opens.
    const anchors = section.match(/<a\b|<\/a>/g) ?? [];
    for (let i = 0; i < anchors.length; i += 2) {
      expect(anchors[i]).toBe("<a");
      expect(anchors[i + 1]).toBe("</a>");
    }
  });

  it("undated tray leads with the canonical rank; ordinary categories never get one", () => {
    const html = renderHome([
      { type: "category-list", category: "notes", limit: 2, layout: "list" },
      { type: "category-list", category: "guides", limit: 9, lead: "rank" },
    ]);
    const notes = sectionHtml(html, 1);
    expect(notes).toContain('data-lead="rank"');
    expect([...notes.matchAll(/zd-category-list-rank[^>]*>(\d+)</g)].map((m) => m[1])).toEqual(["01", "02"]);
    const guides = sectionHtml(html, 2);
    expect(guides).toContain('data-lead="none"');
    expect(guides).not.toContain("zd-category-list-rank");
  });

  it("ordinary categories: descendants through grouping folders, route-slug overrides, landing page excluded", () => {
    const html = renderHome([
      { type: "category-list", category: "guides", limit: 10, showPath: true },
      { type: "category-list", category: "guides", limit: 10, scope: "direct" },
    ]);
    const descendants = sectionHtml(html, 1);
    // Canonical tree order: the index-less "advanced" folder sorts by the
    // default position (999), after the positioned "Ship it" page.
    expect(titles(descendants)).toEqual(["Setup", "Ship it", "Tuning"]);
    expect(descendants).toContain('href="/docs/guides/ship"');
    expect(descendants).not.toContain("deployment-file");
    expect(descendants).toContain("Advanced");
    expect(titles(sectionHtml(html, 2))).toEqual(["Setup", "Ship it"]);
    // The section heading defaults to the category label; the archive is its landing page.
    expect(descendants).toContain(">Guides</h2>");
    expect(descendants).toMatch(/href="\/docs\/guides" class="zd-category-list-archive/);
  });

  it("keeps unique heading ids and accessible names for repeated sections", () => {
    const html = renderHome([
      { type: "category-list", category: "blog", limit: 2, heading: "Latest" },
      { type: "category-list", category: "blog", limit: 5, layout: "list", heading: "More posts" },
    ]);
    const ids = [...html.matchAll(/id="(zd-home-category-list-\d+-heading)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["zd-home-category-list-1-heading", "zd-home-category-list-2-heading"]);
    expect(html).toContain('aria-labelledby="zd-home-category-list-1-heading"');
    expect(html).toContain('aria-labelledby="zd-home-category-list-2-heading"');
  });

  it("suppresses the whole section for a valid but empty category", () => {
    const html = renderHome([
      { type: "category-list", category: "hidden-cat", limit: 3, heading: "Ghost", description: "Nothing here", showCount: true },
    ]);
    expect(html).not.toContain("Ghost");
    expect(html).not.toContain("Nothing here");
    expect(html).not.toContain('data-zd-home-section="category-list"');
  });

  it("keeps items but drops the archive link (and warns) when the category has no page", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const html = renderHome([{ type: "category-list", category: "reference", limit: 3, showCount: true }]);
    const section = sectionHtml(html, 1);
    expect(titles(section)).toEqual(["API"]);
    expect(section).not.toContain("zd-category-list-archive");
    expect(section).toContain("zd-category-list-count");
    expect(warn.mock.calls.some((c) => String(c[0]).includes("has no archive page"))).toBe(true);
  });

  it("supports a title-only configuration with no archive link or footer", () => {
    const html = renderHome([
      { type: "category-list", category: "guides", limit: 2, showDescription: false, showArchive: false },
    ]);
    const section = sectionHtml(html, 1);
    expect(section).not.toContain("zd-category-list-description");
    expect(section).not.toContain("zd-category-list-meta");
    expect(section).not.toContain("zd-category-list-footer");
    expect(section).not.toContain("data-descriptions");
  });

  it("throws a clear authoring error for an unknown category or a document target", () => {
    expect(() => renderHome([{ type: "category-list", category: "blgo", limit: 3 }])).toThrow(
      /home\.sections\[1\]: unknown category "blgo"/,
    );
    expect(() => renderHome([{ type: "category-list", category: "guides/setup", limit: 3 }])).toThrow(
      /is a document, not a category/,
    );
    // A category that exists but has no navigable page at all is empty, not a typo.
    expect(renderHome([{ type: "category-list", category: "dormant", limit: 3 }])).not.toContain(
      'data-zd-home-section="category-list"',
    );
  });

  it("uses the localized heading/archive label, locale fallback and default-locale-only rules", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const sections: HomeSection[] = [
      {
        type: "category-list",
        category: "blog",
        limit: 3,
        archiveLabel: "All posts",
        locales: { ja: { heading: "最新の記事", archiveLabel: "記事一覧" } },
      },
      { type: "category-list", category: "en-only", limit: 3, heading: "English only section" },
    ];
    const ja = renderHome(sections, "ja");
    const blog = sectionHtml(ja, 1);
    expect(blog).toContain(">最新の記事</h2>");
    expect(blog).toContain("記事一覧");
    // The JA translation replaces post 12; the unlisted JA post 11 hides the EN one.
    expect(titles(blog)).toEqual([
      "Search excluded",
      "とても長い日本語のタイトルが折り返されることを確認するための投稿",
      "Post 10",
    ]);
    expect(blog).not.toContain("Post 11");
    expect(blog).toContain('href="/ja/docs/blog/post-12"');
    expect(blog).toMatch(/href="\/ja\/docs\/blog" class="zd-category-list-archive/);
    // A default-locale-only category is absent in JA: no section, no throw.
    expect(ja).not.toContain("English only section");
    const en = renderHome(sections, "en");
    expect(en).toContain("All posts");
    expect(en).toContain("English only section");
  });

  it("prefixes every destination with the configured base path", () => {
    const html = renderHome([{ type: "category-list", category: "guides", limit: 1 }], "en", { base: "/handbook/" } as Partial<Settings>);
    expect(html).toContain('href="/handbook/docs/guides/setup"');
    expect(html).toMatch(/href="\/handbook\/docs\/guides" class="zd-category-list-archive/);
  });

  it("emits plain server HTML with no client script or island for the listing", () => {
    const html = renderHome([{ type: "category-list", category: "blog", limit: 2, layout: "list" }]);
    const section = sectionHtml(html, 1);
    expect(section).not.toContain("<script");
    expect(section).not.toContain("data-zd-test-island");
    expect(section).toContain("<a href=");
  });

  it("coexists with doc-cards and still requires exactly one site-tree", () => {
    const html = renderHome([
      { type: "doc-cards", docs: ["guides/setup"] },
      { type: "category-list", category: "notes", limit: 1 },
    ]);
    expect(html).toContain('data-zd-home-section="doc-cards"');
    expect(html).toContain('data-zd-home-section="site-tree"');
    expect(html).toContain('data-zd-home-section="category-list"');
  });
});

describe("<CategoryList> MDX binding", () => {
  function bound(lang: string, version?: string, extra: Partial<Settings> = {}) {
    const route = makeRoute(
      {
        versions: [{ slug: "1.0", label: "1.0", docsDir: "src/content/docs-v1" }],
        ...extra,
      } as Partial<Settings>,
      {
        "docs-v-1.0": [
          doc("blog/index", { title: "Old blog", category_shape: "note-tray", note_tray_dated: true }),
          doc("blog/old-post", { title: "Old post", date: "2025-01-01" }),
        ],
      },
    );
    const ctx = { ...route, components: {}, hostBindings: {} };
    const components = deriveMdxComponents(ctx as never).createMdxComponentsBound(lang, version);
    return components.CategoryList as Component<CategoryListProps>;
  }

  it("is registered per page and renders without its own heading", () => {
    const html = render(h(bound("en"), { category: "notes", limit: 2, layout: "list" }));
    expect(html).toContain('data-zd-category-list="notes"');
    expect(html).not.toContain("<h2");
    expect(html.match(/<h3 /g)).toHaveLength(2);
  });

  it("binds the page locale", () => {
    const html = render(h(bound("ja"), { category: "blog", limit: 1, lead: "none" }));
    expect(html).toContain('href="/ja/docs/blog/search-excluded"'.replace("search-excluded", "post-search-excluded"));
  });

  it("resolves the version's collection and remaps hrefs into the version", () => {
    const html = render(h(bound("en", "1.0"), { category: "blog", limit: 3 }));
    expect(html).toContain("Old post");
    expect(html).toContain('href="/v/1.0/docs/blog/old-post"');
    expect(html).toMatch(/href="\/v\/1\.0\/docs\/blog" class="zd-category-list-archive/);
  });

  it("supports titleLevel 4 under an h3", () => {
    const html = render(h(bound("en"), { category: "notes", limit: 1, titleLevel: 4 }));
    expect(html).toContain("<h4 ");
  });

  it("validates options at render with useful errors", () => {
    expect(() => render(h(bound("en"), { category: "notes", limit: 0 } as unknown as Record<string, unknown>))).toThrow(
      /<CategoryList>\.limit 0: a positive integer is required/,
    );
    expect(() =>
      render(h(bound("en"), { category: "notes", limit: 2, layout: "compact" } as unknown as Record<string, unknown>)),
    ).toThrow(/<CategoryList>\.layout/);
  });

  it("renders nothing for a category missing from a version (no throw)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(render(h(bound("en", "1.0"), { category: "notes", limit: 2 }))).toBe("");
  });
});
