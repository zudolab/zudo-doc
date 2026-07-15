/**
 * nav-tree-parity.test.ts (#2030)
 *
 * Proof that delegating the host's `buildNavTree` to the shared framework
 * builder (`buildSidebarTree` in @takazudo/zudo-doc/sidebar-tree) is
 * behavior-preserving. The legacy host tree builder (pre-#2030
 * src/utils/docs.ts, verbatim minus caching) is frozen below and its output
 * is deep-compared against the migrated `buildNavTree` across fixtures
 * covering every branch the two implementations share: category indexes,
 * nested categories, frontmatter-vs-sidecar precedence, noPage, sort orders,
 * custom slugs, position fallbacks, and locale-prefixed hrefs.
 *
 * Root docs index (id "" — _data.ts bridging of a root index.mdx): the shared
 * builder drops empty slugs, so the host adapter re-creates the legacy ""
 * node explicitly; parity is asserted below. Documented non-parity edge
 * (intentionally NOT asserted): an explicit `slug: ""` on an entry with a
 * non-empty id — legacy fell back to keying the node by the RAW id (even a
 * slashed one, producing a nonsense category node); the adapter normalizes
 * that to the root "" node instead. See the #2030 report.
 */

import { describe, it, expect } from "vitest";
import { buildNavTree, type CategoryMeta, type NavNode } from "@/utils/docs";
import { toTitleCase, toRouteSlug } from "@takazudo/zudo-doc/slug";
import { docsUrl } from "@/utils/base";
import { defaultLocale, type Locale } from "@/config/i18n";
import type { DocPageEntry } from "@takazudo/zudo-doc/doc-page-props";

// ---------------------------------------------------------------------------
// Frozen legacy implementation (pre-#2030 src/utils/docs.ts, caching removed)
// ---------------------------------------------------------------------------

interface LegacyBuildNode {
  segment: string;
  fullPath: string;
  doc?: DocPageEntry;
  children: Map<string, LegacyBuildNode>;
}

function legacyBuildNavTree(
  docs: DocPageEntry[],
  lang: Locale = defaultLocale,
  categoryMeta?: Map<string, CategoryMeta>,
): NavNode[] {
  const root: LegacyBuildNode = {
    segment: "",
    fullPath: "",
    children: new Map(),
  };

  for (const doc of docs) {
    const slug = doc.data.slug ?? toRouteSlug(doc.slug);
    const parts = slug.split("/");

    if (parts.length <= 1) {
      const segment = parts[0] || slug;
      if (!root.children.has(segment)) {
        root.children.set(segment, {
          segment,
          fullPath: segment,
          children: new Map(),
        });
      }
      root.children.get(segment)!.doc = doc;
    } else {
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const segment = parts[i] ?? "";
        const fullPath = parts.slice(0, i + 1).join("/");
        if (!current.children.has(segment)) {
          current.children.set(segment, {
            segment,
            fullPath,
            children: new Map(),
          });
        }
        if (i === parts.length - 1) {
          current.children.get(segment)!.doc = doc;
        }
        current = current.children.get(segment)!;
      }
    }
  }

  return legacyToNavNodes(root, lang, categoryMeta);
}

function legacyToNavNodes(
  parent: LegacyBuildNode,
  lang: Locale,
  categoryMeta?: Map<string, CategoryMeta>,
  parentSortOrder?: "asc" | "desc",
): NavNode[] {
  const nodes: NavNode[] = [];

  for (const child of parent.children.values()) {
    const doc = child.doc;
    const meta = categoryMeta?.get(child.fullPath);
    const noPage = doc?.data.category_no_page ?? meta?.noPage;
    const sortOrder = doc?.data.category_sort_order ?? meta?.sortOrder ?? "asc";
    const children = legacyToNavNodes(child, lang, categoryMeta, sortOrder);

    nodes.push({
      slug: child.fullPath,
      label:
        doc?.data.sidebar_label ?? doc?.data.title ?? meta?.label ?? toTitleCase(child.segment),
      description: doc?.data.description ?? meta?.description,
      position: doc?.data.sidebar_position ?? meta?.position ?? 999,
      href: noPage
        ? undefined
        : doc || children.length > 0
          ? docsUrl(child.fullPath, lang)
          : undefined,
      hasPage: !!doc && noPage !== true,
      children,
      sortOrder,
    });
  }

  const order = parentSortOrder ?? "asc";
  nodes.sort((a, b) => {
    const posCompare = a.position - b.position;
    if (posCompare !== 0) return order === "desc" ? -posCompare : posCompare;
    const slugCompare = a.slug.localeCompare(b.slug);
    return order === "desc" ? -slugCompare : slugCompare;
  });

  return nodes;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function entry(slug: string, data: Partial<DocPageEntry["data"]> = {}): DocPageEntry {
  const entrySlug = slug === "" ? "index" : slug;
  return {
    slug: entrySlug,
    data: { title: data.title ?? slug, ...data },
    body: "",
    module_specifier: `mdx://docs/${entrySlug}`,
    Content: () => ({ type: "div", props: {}, key: null }),
  };
}

const richCorpus: DocPageEntry[] = [
  entry("getting-started/index", { title: "Getting Started", sidebar_position: 1 }),
  entry("getting-started/install", { title: "Install", sidebar_position: 1 }),
  entry("getting-started/intro", {
    title: "Intro",
    sidebar_label: "Introduction",
    description: "First steps",
  }),
  entry("guides/index", {
    title: "Guides",
    category_no_page: true,
    sidebar_position: 2,
  }),
  entry("guides/deep/nested/page", { title: "Deep Page" }),
  entry("guides/writing", { title: "Writing", sidebar_position: 5 }),
  entry("changelog/index", { title: "Changelog", category_sort_order: "desc" }),
  entry("changelog/2025-01", { title: "2025-01", sidebar_position: 1 }),
  entry("changelog/2025-02", { title: "2025-02", sidebar_position: 2 }),
  entry("reference/custom", { title: "Custom Slug Doc", slug: "reference/renamed" }),
  entry("no-position-a", { title: "Zeta" }),
  entry("no-position-b", { title: "Alpha" }),
  entry("standalone-page", { title: "Standalone", standalone: true }),
  entry("unlisted-page", { title: "Unlisted", unlisted: true }),
];

const richMeta = new Map<string, CategoryMeta>([
  ["guides", { label: "Sidecar Guides", position: 7, sortOrder: "asc" }],
  ["guides/deep", { label: "Deep", position: 1 }],
  ["reference", { label: "Reference", description: "API surface", noPage: true }],
  ["orphan-dir", { label: "Orphan", position: 3 }],
]);

// ---------------------------------------------------------------------------
// Parity assertions
// ---------------------------------------------------------------------------

describe("buildNavTree parity with the frozen legacy builder (#2030)", () => {
  it("matches on the rich corpus without category meta (default locale)", () => {
    expect(buildNavTree(richCorpus)).toEqual(legacyBuildNavTree(richCorpus));
  });

  it("matches on the rich corpus with category meta (default locale)", () => {
    expect(buildNavTree(richCorpus, "en", richMeta)).toEqual(
      legacyBuildNavTree(richCorpus, "en", richMeta),
    );
  });

  it("matches on a non-default locale (locale-prefixed hrefs)", () => {
    expect(buildNavTree(richCorpus, "ja" as Locale, richMeta)).toEqual(
      legacyBuildNavTree(richCorpus, "ja" as Locale, richMeta),
    );
  });

  it("matches when the UNFILTERED list (incl. unlisted/standalone) is passed", () => {
    // The breadcrumb path builds trees from unfiltered docs — the shared
    // builder's default visibility filter must stay disabled in the adapter.
    const tree = buildNavTree(richCorpus, "en", richMeta);
    expect(tree).toEqual(legacyBuildNavTree(richCorpus, "en", richMeta));
    const slugs = JSON.stringify(tree);
    expect(slugs).toContain("standalone-page");
    expect(slugs).toContain("unlisted-page");
  });

  it("matches on an empty corpus", () => {
    expect(buildNavTree([], "en", richMeta)).toEqual(legacyBuildNavTree([], "en", richMeta));
  });

  it("matches when a root docs index (id '') is present", () => {
    const corpus = [
      entry("", { title: "Docs Home", sidebar_position: 1 }),
      ...richCorpus,
    ];
    const mine = buildNavTree(corpus, "en", richMeta);
    expect(mine).toEqual(legacyBuildNavTree(corpus, "en", richMeta));
    expect(JSON.stringify(mine)).toBe(JSON.stringify(legacyBuildNavTree(corpus, "en", richMeta)));
    const root = mine.find((n) => n.slug === "");
    expect(root?.href).toBe(docsUrl("", "en"));
    expect(root?.hasPage).toBe(true);
  });

  it("matches root docs index ordering without an explicit position (999 tie → first)", () => {
    const corpus = [...richCorpus, entry("", { title: "Docs Home" })];
    const mine = buildNavTree(corpus, "ja" as Locale);
    expect(mine).toEqual(legacyBuildNavTree(corpus, "ja" as Locale));
    expect(JSON.stringify(mine)).toBe(JSON.stringify(legacyBuildNavTree(corpus, "ja" as Locale)));
  });

  it("matches a root docs index carrying category_no_page", () => {
    const corpus = [entry("", { title: "Docs Home", category_no_page: true }), ...richCorpus];
    expect(buildNavTree(corpus, "en")).toEqual(legacyBuildNavTree(corpus, "en"));
  });

  it("matches JSON-serialized output exactly (key presence parity for hydration payloads)", () => {
    // Sidebar islands serialize nodes to JSON; undefined-valued keys vanish
    // identically on both sides, so byte-equal JSON is the relevant contract.
    expect(JSON.stringify(buildNavTree(richCorpus, "ja" as Locale, richMeta))).toBe(
      JSON.stringify(legacyBuildNavTree(richCorpus, "ja" as Locale, richMeta)),
    );
  });
});

// ---------------------------------------------------------------------------
// buildHref injection × caching (#2344, S1a — codex review finding)
// ---------------------------------------------------------------------------
// Both nav-tree cache layers are keyed by (docs, lang, categoryMeta) and assume
// the default docsUrl href space. A custom buildHref mints a different href
// space for the SAME key, so it must bypass the cache — otherwise a prior
// default-href build returns a stale tree, and a custom-href build poisons the
// cache for later default callers.
describe("buildNavTree buildHref × cache isolation", () => {
  it("custom buildHref mints hrefs in the injected space even after a default-href build cached the same docs", () => {
    const corpus = [entry("getting-started/intro", { title: "Intro" })];
    // 1. Warm the cache via the default href space (stable array instance →
    //    populates both the identity and content cache).
    const def = buildNavTree(corpus, "en");
    expect(def.find((n) => n.slug === "getting-started")?.href).toBe(docsUrl("getting-started", "en"));
    // 2. Same docs/lang/categoryMeta, custom buildHref — must NOT return the
    //    cached default-href tree.
    const versioned = buildNavTree(corpus, "en", undefined, {
      buildHref: (slug) => `/v/1.0/docs/${slug}/`,
    });
    expect(versioned.find((n) => n.slug === "getting-started")?.href).toBe("/v/1.0/docs/getting-started/");
  });

  it("a custom-buildHref build does not poison the default-href cache for later callers", () => {
    const corpus = [entry("guides/writing", { title: "Writing" })];
    // 1. Custom-href build first.
    const versioned = buildNavTree(corpus, "en", undefined, {
      buildHref: (slug) => `/v/2.0/docs/${slug}/`,
    });
    expect(versioned.find((n) => n.slug === "guides")?.href).toBe("/v/2.0/docs/guides/");
    // 2. Default-href build of the SAME docs must still get default hrefs.
    const def = buildNavTree(corpus, "en");
    expect(def.find((n) => n.slug === "guides")?.href).toBe(docsUrl("guides", "en"));
  });
});
