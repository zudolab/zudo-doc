/**
 * The Learn umbrella navigation (src/lib/learn-navigation.ts, learn-chrome.tsx)
 * against the native tree builder, sidebar resolver and Header/Sidebar
 * factories, plus the real showcase content it is configured for.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@takazudo/zudo-doc/config";
import type { DocPageEntry } from "@takazudo/zudo-doc/doc-page-props";
import type { ChromeHostBindings } from "@takazudo/zudo-doc/factory-context";
import { createRouteContext, type RouteContext } from "@takazudo/zudo-doc/route-context";
import type { SidebarNavNode } from "@takazudo/zudo-doc/sidebar-utils";
import { createUmbrellaChrome } from "../lib/learn-chrome";
import {
  learnNavigation,
  toUmbrellaTree,
  umbrellaSidebar,
  type UmbrellaNavigation,
} from "../lib/learn-navigation";

const repoRoot = resolve(__dirname, "../..");

// Island() refuses targets missing from the build's island registry.
const zfbGlobal = globalThis as typeof globalThis & { __zfb?: Record<string, unknown> };
beforeEach(() => {
  zfbGlobal.__zfb = {
    zudoReactBuild: "learn-navigation",
    zudoReactIslands: ["SidebarTree", "SidebarToggle", "ThemeToggle"],
  };
});

function doc(slug: string, title: string, sidebar_position: number, extra: Record<string, unknown> = {}): DocPageEntry {
  return {
    slug,
    data: { title, sidebar_position, ...extra },
    body: "",
    module_specifier: `mdx://docs/${slug}`,
    Content: () => null,
  } as unknown as DocPageEntry;
}

const englishDocs = [
  doc("learn/index", "Learn", 1, { sidebar_initial_expansion: "collapsed" }),
  doc("guides/index", "Guides", 2),
  doc("guides/setup", "Setup", 1),
  doc("guides/deep/index", "Deep", 2),
  doc("guides/deep/inner/index", "Inner", 1),
  doc("guides/deep/inner/leaf", "Leaf", 1),
  doc("guides/hidden", "Hidden", 3, { unlisted: true }),
  doc("components/index", "Components", 3),
  doc("components/card", "Card", 1),
  doc("markdown-features/index", "Markdown Features", 4),
  doc("markdown-features/math", "Math", 1),
  doc("reference/index", "Reference", 5),
  doc("reference/basics", "Basics", 1),
];
const collections: Record<string, DocPageEntry[]> = {
  docs: englishDocs,
  "docs-ja": [doc("learn/index", "学ぶ", 1), doc("guides/index", "ガイド", 2)],
  // Archived like docs-v1: no Learn landing page.
  "docs-v-1.0": englishDocs.filter((entry) => !entry.slug.startsWith("learn/")),
};

const headerNav = [
  {
    label: "Learn",
    path: "/docs/learn",
    categoryMatch: "learn",
    versioned: false,
    children: [
      { label: "Guides", path: "/docs/guides", categoryMatch: "guides" },
      { label: "Components", path: "/docs/components", categoryMatch: "components" },
      { label: "Markdown Features", path: "/docs/markdown-features", categoryMatch: "markdown-features" },
    ],
  },
  { label: "Reference", path: "/docs/reference", categoryMatch: "reference" },
];

function routeContext(docs: Record<string, DocPageEntry[]> = collections): RouteContext {
  const settings = {
    ...DEFAULT_SETTINGS,
    base: "/handbook/",
    docsDir: "fixture/docs",
    locales: { ja: { label: "日本語", dir: "fixture/docs-ja" } },
    versions: [{ slug: "1.0", label: "1.0", docsDir: "fixture/docs-v1" }],
    headerNav,
  };
  return createRouteContext(
    { settings, translations: {}, tagVocabulary: [], colorSchemes: null, assetManifest: null } as never,
    { stableDocs: (name) => docs[name] ?? [] },
  );
}

const section = { items: [], scopeRoot: "configured" } as const;
const bindings: ChromeHostBindings = {
  sidebarsConfig: {
    learn: section,
    guides: section,
    components: section,
    "markdown-features": section,
    reference: section,
  },
};

const nativeTree = (ctx: RouteContext, docs: DocPageEntry[], lang = "en") =>
  ctx.buildNavTree(docs, lang, undefined, (slug, locale) => ctx.docsUrl(slug, locale));

interface Description {
  type: unknown;
  props: Record<string, unknown>;
}
interface ClientTree {
  nodes: SidebarNavNode[];
  navigation: {
    id: string;
    roots: SidebarNavNode[];
    localParentId?: string;
    parents: Record<string, string | null>;
    initialExpansion?: Record<string, string>;
  };
}
/** The SidebarTree island props rendered by the Sidebar slot. */
const sidebarData = (element: unknown) =>
  ((element as Description).props["child"] as Description).props as unknown as ClientTree;
/** The SidebarToggle (mobile drawer) island props rendered by the Header slot. */
function drawerData(element: unknown): ClientTree {
  const island = (element as Description).props["sidebarToggle"] as Description;
  return (island.props["child"] as Description).props as unknown as ClientTree;
}

interface Shape {
  label: string;
  href?: string;
  children: Shape[];
}
function shape(nodes: readonly { label: string; href?: string; children: readonly unknown[] }[]): Shape[] {
  return nodes.map((node) => ({
    label: node.label,
    ...(node.href !== undefined ? { href: node.href } : {}),
    children: shape(node.children as never),
  }));
}
const slugs = (nodes: readonly { slug: string }[]) => nodes.map((node) => node.slug);

function page(slug: string, navSection: string, extra: { lang?: string; currentVersion?: string } = {}) {
  const lang = extra.lang ?? "en";
  const prefix = `/handbook/${extra.currentVersion ? `v/${extra.currentVersion}/` : ""}${lang === "en" ? "" : `${lang}/`}`;
  return { currentSlug: slug, lang, navSection, currentVersion: extra.currentVersion, currentPath: `${prefix}docs/${slug}` };
}

describe("toUmbrellaTree", () => {
  it("puts the complete native branches under one linked Learn row without mutating the input", () => {
    const ctx = routeContext();
    const tree = nativeTree(ctx, englishDocs);
    const before = structuredClone(tree);
    const forest = toUmbrellaTree(tree, learnNavigation)!;

    expect(forest).toHaveLength(1);
    expect({ ...forest[0], children: [] }).toEqual({ ...ctx.findNode(tree, "learn"), children: [] });
    expect(slugs(forest[0]!.children)).toEqual(["guides", "components", "markdown-features"]);
    // The real native nodes, descendants and metadata included; no Overview duplicate.
    for (const branch of forest[0]!.children) expect(branch).toBe(ctx.findNode(tree, branch.slug));
    expect(shape(forest)[0]!.children[0]).toEqual({
      label: "Guides",
      href: "/handbook/docs/guides",
      children: [
        { label: "Setup", href: "/handbook/docs/guides/setup", children: [] },
        {
          label: "Deep",
          href: "/handbook/docs/guides/deep",
          children: [
            { label: "Inner", href: "/handbook/docs/guides/deep/inner", children: [
              { label: "Leaf", href: "/handbook/docs/guides/deep/inner/leaf", children: [] },
            ] },
          ],
        },
        // Unlisted pages keep their native treatment.
        { label: "Hidden", href: "/handbook/docs/guides/hidden", children: [] },
      ],
    });
    expect(tree).toEqual(before);
  });

  it("picks up a new page and nested category inside a branch without editing membership", () => {
    const ctx = routeContext();
    const tree = nativeTree(ctx, [
      ...englishDocs,
      doc("guides/new-page", "New page", 4),
      doc("guides/new-group/index", "New group", 5),
      doc("guides/new-group/child", "Child", 1),
    ]);
    const guides = toUmbrellaTree(tree, learnNavigation)![0]!.children[0]!;
    expect(ctx.findNode([guides], "guides/new-page")).toBeDefined();
    expect(slugs(ctx.findNode([guides], "guides/new-group")!.children)).toEqual(["guides/new-group/child"]);
  });

  it("returns undefined without the root page and skips missing branches without reordering", () => {
    const ctx = routeContext();
    expect(toUmbrellaTree(nativeTree(ctx, collections["docs-v-1.0"]!), learnNavigation)).toBeUndefined();
    const partial = toUmbrellaTree(
      nativeTree(ctx, englishDocs.filter((entry) => !entry.slug.startsWith("components/"))),
      learnNavigation,
    )!;
    expect(slugs(partial[0]!.children)).toEqual(["guides", "markdown-features"]);
  });
});

describe("umbrellaSidebar", () => {
  const forest = toUmbrellaTree(nativeTree(routeContext(), englishDocs), learnNavigation)!;

  it("selects the Learn row or the actual branch row in node mode", () => {
    const base = { items: [{ type: "autogenerated" }], initialPathMode: "node", scopeRoot: "configured" };
    expect(umbrellaSidebar(forest, "learn")).toEqual({ ...base, initialPath: [0] });
    expect(umbrellaSidebar(forest, "guides")).toEqual({ ...base, initialPath: [0, 0] });
    expect(umbrellaSidebar(forest, "markdown-features")).toEqual({ ...base, initialPath: [0, 2] });
    expect(umbrellaSidebar(forest, "reference")).toBeUndefined();
  });

  it("follows the retained branches instead of fixed indexes", () => {
    const partial = [{ ...forest[0]!, children: forest[0]!.children.filter((node) => node.slug !== "components") }];
    expect(umbrellaSidebar(partial, "markdown-features")?.initialPath).toEqual([0, 1]);
    expect(umbrellaSidebar(partial, "components")).toBeUndefined();
  });
});

describe("createUmbrellaChrome", () => {
  const learnShape = (prefix: string): Shape[] => [
    {
      label: "Learn",
      href: `${prefix}docs/learn`,
      children: [
        expect.objectContaining({ label: "Guides", href: `${prefix}docs/guides` }),
        expect.objectContaining({ label: "Components", href: `${prefix}docs/components` }),
        expect.objectContaining({ label: "Markdown Features", href: `${prefix}docs/markdown-features` }),
      ] as Shape[],
    },
  ];

  it("gives the four sections one shared context and different node-mode baselines", () => {
    const { Sidebar } = createUmbrellaChrome(routeContext(), bindings, [learnNavigation]);
    const views = {
      learn: sidebarData(Sidebar(page("learn", "learn"))),
      guides: sidebarData(Sidebar(page("guides/setup", "guides"))),
      components: sidebarData(Sidebar(page("components/card", "components"))),
      "markdown-features": sidebarData(Sidebar(page("markdown-features/math", "markdown-features"))),
    };
    const { learn, guides } = views;

    expect(shape(learn.navigation.roots)).toEqual(learnShape("/handbook/"));
    for (const view of Object.values(views)) {
      expect(view.navigation.id).toBe(learn.navigation.id);
      expect(view.navigation.roots).toEqual(learn.navigation.roots);
      expect(view.navigation.parents).toEqual(learn.navigation.parents);
      expect(view.navigation.initialExpansion).toEqual({ learn: "collapsed" });
    }
    // Learn is the fresh view and the ceiling; each subsection starts at its own row.
    expect(slugs(learn.nodes)).toEqual(["learn"]);
    expect(learn.navigation.localParentId).toBeUndefined();
    const learnId = learn.navigation.roots[0]!.occurrenceId;
    for (const [sectionKey, view] of Object.entries(views)) {
      if (sectionKey === "learn") continue;
      expect(slugs(view.nodes)).toEqual([sectionKey]);
      expect(view.navigation.localParentId).toBe(learnId);
      expect(view.navigation.parents[view.nodes[0]!.occurrenceId!]).toBe(learnId);
    }
    expect(guides.nodes[0]!.children.map((node) => node.slug)).toEqual(["guides/setup", "guides/deep"]);
  });

  it("gives the desktop sidebar and the mobile drawer the same navigation", () => {
    const { Header, Sidebar } = createUmbrellaChrome(routeContext(), bindings, [learnNavigation]);
    for (const props of [page("learn", "learn"), page("components/card", "components")]) {
      const sidebar = sidebarData(Sidebar(props));
      const drawer = drawerData(Header(props));
      expect(drawer.nodes).toEqual(sidebar.nodes);
      expect(drawer.navigation).toEqual(sidebar.navigation);
    }
  });

  it("keeps native locale and base hrefs", () => {
    const { Sidebar } = createUmbrellaChrome(routeContext(), bindings, [learnNavigation]);
    const ja = sidebarData(Sidebar(page("guides", "guides", { lang: "ja" })));
    expect(ja.navigation.roots[0]).toMatchObject({ label: "学ぶ", href: "/handbook/ja/docs/learn" });
    expect(ja.nodes[0]).toMatchObject({ label: "ガイド", href: "/handbook/ja/docs/guides" });
  });

  it("uses the fully native pair where the version has no Learn page", () => {
    const ctx = routeContext();
    const { Header, Sidebar } = createUmbrellaChrome(ctx, bindings, [learnNavigation]);
    const props = page("guides/setup", "guides", { currentVersion: "1.0" });
    const archived = sidebarData(Sidebar(props));
    const native = createUmbrellaChrome(ctx, bindings, []).Sidebar(props);

    expect(archived).toEqual(sidebarData(native));
    expect(slugs(archived.navigation.roots)).toEqual(["guides"]);
    expect(archived.nodes[0]!.href).toBe("/handbook/v/1.0/docs/guides");
    expect(drawerData(Header(props)).navigation).toEqual(archived.navigation);
  });

  it("never selects another branch when one is missing", () => {
    const docs = { ...collections, docs: englishDocs.filter((entry) => !entry.slug.startsWith("components/")) };
    const { Sidebar } = createUmbrellaChrome(routeContext(docs), bindings, [learnNavigation]);
    const markdown = sidebarData(Sidebar(page("markdown-features/math", "markdown-features")));
    expect(slugs(markdown.nodes)).toEqual(["markdown-features"]);
    expect(slugs(markdown.navigation.roots[0]!.children)).toEqual(["guides", "markdown-features"]);
  });

  it("leaves unrelated sections and the shared route context native", () => {
    const ctx = routeContext();
    const { Sidebar } = createUmbrellaChrome(ctx, bindings, [learnNavigation]);
    const reference = sidebarData(Sidebar(page("reference/basics", "reference")));
    expect(slugs(reference.navigation.roots)).toEqual(["reference"]);
    expect(reference).toEqual(sidebarData(createUmbrellaChrome(ctx, bindings, []).Sidebar(page("reference/basics", "reference"))));
    // Breadcrumbs, pager and CategoryNav keep reading the untouched URL tree.
    expect(slugs(nativeTree(ctx, englishDocs)).slice(0, 4)).toEqual(["learn", "guides", "components", "markdown-features"]);
  });

  it("supports several umbrellas, each selected by its own sections", () => {
    const atlas: UmbrellaNavigation = { root: "reference", branches: ["components"] };
    const { Sidebar } = createUmbrellaChrome(routeContext(), bindings, [learnNavigation, atlas]);
    expect(slugs(sidebarData(Sidebar(page("reference/basics", "reference"))).navigation.roots[0]!.children)).toEqual(["components"]);
    // The first umbrella that lists a section owns it.
    expect(slugs(sidebarData(Sidebar(page("components/card", "components"))).navigation.roots)).toEqual(["learn"]);
  });
});

// ---------------------------------------------------------------------------
// The showcase content this configuration is written for.
// ---------------------------------------------------------------------------

/** Scalar frontmatter only: enough for the nav builder's visibility and order fields. */
function readDocs(dir: string): DocPageEntry[] {
  const root = resolve(repoRoot, dir);
  const entries: DocPageEntry[] = [];
  const walk = (current: string) => {
    for (const name of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, name.name);
      if (name.isDirectory()) walk(path);
      else if (/\.mdx?$/.test(name.name)) {
        const front = /^---\n([\s\S]*?)\n---/.exec(readFileSync(path, "utf8"))?.[1] ?? "";
        const data: Record<string, unknown> = {};
        for (const line of front.split("\n")) {
          const match = /^([a-z_]+):\s*(.*)$/.exec(line);
          if (!match || match[2] === "") continue;
          const raw = match[2]!.replace(/^["']|["']$/g, "");
          data[match[1]!] = raw === "true" ? true : raw === "false" ? false : raw === "null" ? null : /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
        }
        const slug = relative(root, path).replace(/\.mdx?$/, "");
        entries.push({ slug, data, body: "", module_specifier: `mdx://${slug}`, Content: () => null } as unknown as DocPageEntry);
      }
    }
  };
  for (const sectionDir of ["learn", ...learnNavigation.branches]) {
    if (existsSync(join(root, sectionDir))) walk(join(root, sectionDir));
  }
  return entries.filter((entry) => !(entry.data as { draft?: boolean }).draft);
}

describe("showcase Learn content", () => {
  it.each(["docs", "docs-ja"])("src/content/%s holds the Learn page and all three branches in card order", (dir) => {
    const ctx = routeContext();
    const forest = toUmbrellaTree(nativeTree(ctx, readDocs(`src/content/${dir}`)), learnNavigation);
    expect(forest).toBeDefined();
    expect(slugs(forest![0]!.children)).toEqual([...learnNavigation.branches]);
    for (const branch of forest![0]!.children) {
      expect(branch).toMatchObject({ hasPage: true });
      expect(branch.children.length).toBeGreaterThan(0);
    }
    const landing = readFileSync(resolve(repoRoot, `src/content/${dir}/learn/index.mdx`), "utf8");
    expect(landing).toMatch(/^sidebar_initial_expansion: collapsed$/m);
    const cards = /<CategoryNav categories=\{(\[[^\]]*\])\}/.exec(landing)?.[1];
    expect(JSON.parse(cards ?? "null")).toEqual([...learnNavigation.branches]);
  });

  it("the archived version has no Learn page, so it keeps native navigation", () => {
    const ctx = routeContext();
    expect(toUmbrellaTree(nativeTree(ctx, readDocs("src/content/docs-v1")), learnNavigation)).toBeUndefined();
  });
});

