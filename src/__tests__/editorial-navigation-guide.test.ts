/**
 * Runs the Editorial Navigation guide's example exactly as documented.
 *
 * The guide holds two examples: the curated editorial tree, then the umbrella
 * tree that starts at the `src/lib/learn-navigation.ts` block. Each example's
 * titled code fences are written into its own
 * throwaway project (its node_modules links to this workspace), type-checked
 * with the package's own tsconfig base, and imported. The modules then run
 * against the native route context, nav-tree builder, sidebar resolver and
 * Header/Sidebar factories. The scope recipes and item semantics stated in
 * guides/sidebar.mdx are checked against the same native resolver.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@takazudo/zudo-doc/config";
import type { DocNavNode, DocPageEntry } from "@takazudo/zudo-doc/doc-page-props";
import type { HeaderSlotProps, SidebarSlotProps } from "@takazudo/zudo-doc/chrome-bindings";
import type { ChromeHostBindings } from "@takazudo/zudo-doc/factory-context";
import { createRouteContext, type RouteContext } from "@takazudo/zudo-doc/route-context";
import {
  buildSidebarNavigation,
  type SidebarNavNode,
  type SidebarsConfig,
} from "@takazudo/zudo-doc/sidebar-utils";

const repoRoot = resolve(__dirname, "../..");
const guidePath = (dir: string) => resolve(repoRoot, "src/content", dir, "guides/editorial-navigation.mdx");

/** The first fence of the umbrella example; every fence from here on belongs to it. */
const UMBRELLA_START = "src/lib/learn-navigation.ts";

/**
 * Every fenced block of an MDX file. Titled blocks are keyed by `title="…"`,
 * separately for the curated example and the umbrella example that follows it.
 */
function readFences(path: string): { all: string[]; titled: Map<string, string>; umbrella: Map<string, string> } {
  const all: string[] = [];
  const titled = new Map<string, string>();
  const umbrella = new Map<string, string>();
  let target = titled;
  for (const match of readFileSync(path, "utf8").matchAll(/^```([^\n]*)\n([\s\S]*?)^```$/gm)) {
    all.push(match[0]);
    const title = /title="([^"]+)"/.exec(match[1] ?? "")?.[1];
    if (title === UMBRELLA_START) target = umbrella;
    if (title) target.set(title, match[2] ?? "");
  }
  return { all, titled, umbrella };
}

const EXAMPLE_FILES = [
  "src/navigation/editorial-tree.ts",
  "src/navigation/editorial-chrome.tsx",
  "src/chrome-bindings.tsx",
  "zfb.config.ts",
] as const;

interface EditorialTreeModule {
  toEditorialTree(tree: DocNavNode[]): DocNavNode[];
}
interface EditorialChromeModule {
  createEditorialChrome(
    routeCtx: RouteContext,
    bindings: ChromeHostBindings,
  ): { Header: (props: HeaderSlotProps) => unknown; Sidebar: (props: SidebarSlotProps) => unknown };
}

let projectDir: string;
let tree: EditorialTreeModule;
let chrome: EditorialChromeModule;

beforeAll(async () => {
  const { titled } = readFences(guidePath("docs"));
  projectDir = mkdtempSync(join(tmpdir(), "editorial-navigation-example-"));
  symlinkSync(resolve(repoRoot, "node_modules"), join(projectDir, "node_modules"), "dir");
  writeFileSync(
    join(projectDir, "tsconfig.json"),
    JSON.stringify({
      extends: "@takazudo/zudo-doc/tsconfig.base.json",
      include: ["src", "zfb.config.ts"],
    }),
  );
  for (const file of EXAMPLE_FILES) {
    const source = titled.get(file);
    if (source === undefined) throw new Error(`The guide has no code block titled ${file}`);
    mkdirSync(dirname(join(projectDir, file)), { recursive: true });
    writeFileSync(join(projectDir, file), source);
  }
  tree = await import(pathToFileURL(join(projectDir, "src/navigation/editorial-tree.ts")).href);
  chrome = await import(pathToFileURL(join(projectDir, "src/navigation/editorial-chrome.tsx")).href);
});

afterAll(() => {
  if (projectDir) rmSync(projectDir, { recursive: true, force: true });
});

// Island() refuses targets missing from the build's island registry.
const zfbGlobal = globalThis as typeof globalThis & { __zfb?: Record<string, unknown> };
beforeEach(() => {
  zfbGlobal.__zfb = {
    zudoReactBuild: "editorial-navigation-guide",
    zudoReactIslands: ["SidebarTree", "SidebarToggle", "ThemeToggle"],
  };
});

// ---------------------------------------------------------------------------
// Fixture site — the guide's content tree plus one native child under the
// cross-linked guide, a Japanese locale and an archived version.
// ---------------------------------------------------------------------------

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
  doc("guides/index", "Guides", 1),
  doc("guides/deploying", "Deploying", 1),
  doc("guides/deploying/cloudflare", "Cloudflare", 1),
  doc("reference/index", "Reference", 2),
  doc("reference/basics", "Basics", 1),
  doc("reference/installation", "Installation", 2),
  doc("reference/configuration", "Configuration", 3),
];
const collections: Record<string, DocPageEntry[]> = {
  docs: englishDocs,
  "docs-ja": [doc("reference/basics", "基本", 1)],
  // The archived version predates the Configuration page.
  "docs-v-1.0": englishDocs.filter((entry) => entry.slug !== "reference/configuration"),
};

const settings = {
  ...DEFAULT_SETTINGS,
  base: "/handbook/",
  docsDir: "fixture/docs",
  locales: { ja: { label: "日本語", dir: "fixture/docs-ja" } },
  versions: [{ slug: "1.0", label: "1.0", docsDir: "fixture/docs-v1" }],
  headerNav: [
    { label: "Guides", path: "/docs/guides", categoryMatch: "guides" },
    { label: "Reference", path: "/docs/reference", categoryMatch: "reference" },
  ],
};

function routeContext(): RouteContext {
  return createRouteContext(
    { settings, translations: {}, tagVocabulary: [], colorSchemes: null, assetManifest: null } as never,
    { stableDocs: (name) => collections[name] ?? [] },
  );
}

const baseBindings: ChromeHostBindings = {
  sidebarsConfig: { guides: { items: [], scopeRoot: "configured" } },
};

interface Description {
  type: unknown;
  props: Record<string, unknown>;
}
interface ClientTree {
  nodes: SidebarNavNode[];
  navigation?: { roots: SidebarNavNode[]; localParentId?: string; parents: Record<string, string | null> };
}

/** The SidebarTree island props rendered by the Sidebar slot. */
function sidebarData(element: unknown): ClientTree {
  return ((element as Description).props["child"] as Description).props as unknown as ClientTree;
}
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

const referencePage = {
  currentSlug: "reference/installation",
  lang: "en",
  navSection: "reference",
  currentVersion: undefined,
  currentPath: "/handbook/docs/reference/installation",
};

const editorialReference: Shape[] = [
  {
    label: "Reference",
    href: "/handbook/docs/reference",
    children: [
      {
        label: "Basics",
        href: "/handbook/docs/reference/basics",
        children: [
          { label: "Installation", href: "/handbook/docs/reference/installation", children: [] },
          { label: "Configuration", href: "/handbook/docs/reference/configuration", children: [] },
        ],
      },
      { label: "Deploying", href: "/handbook/docs/guides/deploying", children: [] },
    ],
  },
];

describe("Editorial Navigation guide — documented code", () => {
  it("keeps every code block identical between the English and Japanese guides", () => {
    expect(readFences(guidePath("docs-ja")).all).toEqual(readFences(guidePath("docs")).all);
  });

  it("type-checks the complete example modules against the published package exports", () => {
    const tsc = resolve(repoRoot, "node_modules/typescript/bin/tsc");
    const result = spawnSync(process.execPath, [tsc, "--noEmit", "-p", projectDir], { encoding: "utf8" });
    expect(result.stdout + result.stderr).toBe("");
    expect(result.status).toBe(0);
  }, 120_000);
});

describe("Editorial Navigation guide — toEditorialTree on the native tree", () => {
  it("re-parents real nodes into linked parents without a duplicate landing child", () => {
    const ctx = routeContext();
    const native = ctx.buildNavTree(ctx.stableDocs("docs"), "en", undefined, (slug, locale) => ctx.docsUrl(slug, locale));
    const before = structuredClone(native);
    const forest = tree.toEditorialTree(native);

    expect(shape(forest)).toEqual(editorialReference);
    expect(native).toEqual(before);
    // Each row is a copy of the genuine native node: same slug, href and metadata.
    const reference = ctx.findNode(native, "reference")!;
    expect({ ...forest[0], children: [] }).toEqual({ ...reference, children: [] });
    // The cross-linked guide stays a leaf; its native Cloudflare child is not imported.
    expect(ctx.findNode(native, "guides/deploying")!.children).toHaveLength(1);
    expect(forest[0]!.children[1]).toMatchObject({ slug: "guides/deploying", children: [] });
  });

  it("omits a section page that editorialMembers does not list", () => {
    const ctx = routeContext();
    const native = ctx.buildNavTree(
      [...englishDocs, doc("reference/glossary", "Glossary", 4)],
      "en",
      undefined,
      (slug, locale) => ctx.docsUrl(slug, locale),
    );
    expect(ctx.findNode(native, "reference/glossary")).toBeDefined();
    expect(ctx.findNode(tree.toEditorialTree(native), "reference/glossary")).toBeUndefined();
  });

  it("rejects a generated auto-index row and keeps the native tree when the root is absent", () => {
    const ctx = routeContext();
    const buildHref = (slug: string, locale: string) => ctx.docsUrl(slug, locale);
    // `reference/basics` becomes a directory without index.mdx: a generated auto-index row.
    const autoIndex = ctx.buildNavTree(
      [doc("reference/index", "Reference", 1), doc("reference/basics/intro", "Intro", 1)],
      "en",
      undefined,
      buildHref,
    );
    expect(ctx.findNode(autoIndex, "reference/basics")).toMatchObject({ hasPage: false, href: "/handbook/docs/reference/basics" });
    expect(() => tree.toEditorialTree(autoIndex)).toThrow(/needs an authored page/);

    const guidesOnly = ctx.buildNavTree([doc("guides/index", "Guides", 1)], "en", undefined, buildHref);
    expect(tree.toEditorialTree(guidesOnly)).toBe(guidesOnly);
  });
});

describe("Editorial Navigation guide — paired native chrome", () => {
  it("gives the desktop sidebar and the mobile drawer the same editorial tree, starting at the Reference row", () => {
    const { Header, Sidebar } = chrome.createEditorialChrome(routeContext(), baseBindings);
    const sidebar = sidebarData(Sidebar(referencePage));
    const drawer = drawerData(Header(referencePage));

    expect(shape(sidebar.nodes)).toEqual(editorialReference);
    expect(shape(sidebar.navigation!.roots)).toEqual(editorialReference);
    // Node mode selects the single root row itself, so nothing broader exists.
    expect(sidebar.navigation!.localParentId).toBeUndefined();
    expect(drawer.nodes).toEqual(sidebar.nodes);
    expect(drawer.navigation).toEqual(sidebar.navigation);
  });

  it("keeps the URL owner and the native tree for the cross-linked destination", () => {
    const ctx = routeContext();
    const { Header, Sidebar } = chrome.createEditorialChrome(ctx, baseBindings);
    const deploying = {
      currentSlug: "guides/deploying",
      lang: "en",
      navSection: ctx.getNavSectionForSlug("guides/deploying"),
      currentVersion: undefined,
      currentPath: "/handbook/docs/guides/deploying",
    };
    expect(deploying.navSection).toBe("guides");

    const sidebar = sidebarData(Sidebar(deploying));
    const guides: Shape[] = [
      {
        label: "Guides",
        href: "/handbook/docs/guides",
        children: [
          {
            label: "Deploying",
            href: "/handbook/docs/guides/deploying",
            children: [{ label: "Cloudflare", href: "/handbook/docs/guides/deploying/cloudflare", children: [] }],
          },
        ],
      },
    ];
    expect(shape(sidebar.nodes)).toEqual(guides);
    // The fallback section keeps its own binding: Broaden is capped at Guides.
    expect(shape(sidebar.navigation!.roots)).toEqual(guides);
    expect(drawerData(Header(deploying)).nodes).toEqual(sidebar.nodes);
  });

  it("forwards locale, base and version to the native builders", () => {
    const { Sidebar } = chrome.createEditorialChrome(routeContext(), baseBindings);

    const ja = sidebarData(Sidebar({ ...referencePage, lang: "ja", currentPath: "/handbook/ja/docs/reference/installation" }));
    expect(ja.nodes[0]).toMatchObject({ label: "Reference", href: "/handbook/ja/docs/reference" });
    expect(ja.nodes[0]!.children[0]).toMatchObject({ label: "基本", href: "/handbook/ja/docs/reference/basics" });

    const archived = sidebarData(Sidebar({ ...referencePage, currentVersion: "1.0" }));
    expect(shape(archived.nodes)).toEqual([
      {
        label: "Reference",
        href: "/handbook/v/1.0/docs/reference",
        children: [
          {
            label: "Basics",
            href: "/handbook/v/1.0/docs/reference/basics",
            children: [{ label: "Installation", href: "/handbook/v/1.0/docs/reference/installation", children: [] }],
          },
          { label: "Deploying", href: "/handbook/v/1.0/docs/guides/deploying", children: [] },
        ],
      },
    ]);
  });

  it("leaves the route context used by breadcrumbs, pagers and CategoryNav untouched", () => {
    const ctx = routeContext();
    chrome.createEditorialChrome(ctx, baseBindings);
    const native = ctx.buildNavTree(ctx.stableDocs("docs"), "en", undefined, (slug, locale) => ctx.docsUrl(slug, locale));
    expect(ctx.findNode(native, "reference")!.children.map((node) => node.slug)).toEqual([
      "reference/basics",
      "reference/installation",
      "reference/configuration",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Sidebar guide — category rows, item semantics and scope recipes.
// ---------------------------------------------------------------------------

describe("Sidebar guide — native resolver semantics", () => {
  const recipeDocs = [
    doc("guides/index", "Guides", 1),
    doc("guides/setup/index", "Setup", 1),
    doc("guides/setup/install", "Install", 1),
    doc("guides/writing/index", "Writing", 2),
    doc("guides/writing/pages", "Pages", 1),
    doc("reference/index", "Reference", 2),
    doc("reference/basics", "Basics", 1),
    doc("reference/commands", "Commands", 2),
  ];
  const ctx = routeContext();
  const nativeTree = (docs: unknown[], lang: string) =>
    ctx.buildNavTree(docs as DocPageEntry[], lang, undefined, (slug, locale) => ctx.docsUrl(slug, locale)) as SidebarNavNode[];
  const resolveSection = (
    section: string,
    config: SidebarsConfig,
    buildTree: (docs: unknown[], lang: string) => SidebarNavNode[] = nativeTree,
  ) => buildSidebarNavigation(recipeDocs, "en", section, undefined, config, buildTree, ["guides", "reference"]);
  const leaf = (label: string, path: string): Shape => ({ label, href: `/handbook/docs/${path}`, children: [] });
  const guidesRow: Shape = {
    label: "Guides",
    href: "/handbook/docs/guides",
    children: [
      { label: "Setup", href: "/handbook/docs/guides/setup", children: [leaf("Install", "guides/setup/install")] },
      { label: "Writing", href: "/handbook/docs/guides/writing", children: [leaf("Pages", "guides/writing/pages")] },
    ],
  };
  const referenceRow: Shape = {
    label: "Reference",
    href: "/handbook/docs/reference",
    children: [leaf("Basics", "reference/basics"), leaf("Commands", "reference/commands")],
  };

  it("links categories with an authored or generated index and leaves category_no_page as a heading", () => {
    const rows = nativeTree(
      [
        doc("authored/index", "Authored", 1),
        doc("authored/page", "Page", 1),
        doc("generated/page", "Page", 1),
        doc("heading/index", "Heading", 3, { category_no_page: true }),
        doc("heading/page", "Page", 1),
      ],
      "en",
    );
    expect(rows.map(({ slug, hasPage, href }) => ({ slug, hasPage, href }))).toEqual([
      { slug: "authored", hasPage: true, href: "/handbook/docs/authored" },
      { slug: "heading", hasPage: false, href: undefined },
      { slug: "generated", hasPage: false, href: "/handbook/docs/generated" },
    ]);
  });

  it("keeps the real section root by default and caps Broaden with scopeRoot", () => {
    const automatic = resolveSection("guides", {});
    expect(shape(automatic.nodes)).toEqual([guidesRow]);
    expect(shape(automatic.navigation.roots)).toEqual([guidesRow, referenceRow]);

    const capped = resolveSection("guides", { guides: { items: [], scopeRoot: "configured" } });
    expect(shape(capped.nodes)).toEqual([guidesRow]);
    expect(shape(capped.navigation.roots)).toEqual([guidesRow]);
  });

  it("shows the linked child groups as peers with initialPath [0] in children mode", () => {
    const peers = resolveSection("guides", { guides: { items: [], initialPath: [0] } });
    expect(shape(peers.nodes)).toEqual(guidesRow.children);
    expect(peers.navigation.localParentId).toBe("auto/0");
  });

  it("selects a supplied one-root forest itself, but the first site section on the native forest", () => {
    const definition = { items: [{ type: "autogenerated" as const }], initialPath: [0], initialPathMode: "node" as const };
    const referenceOnly = (docs: unknown[], lang: string) =>
      nativeTree(docs, lang).filter((node) => node.slug === "reference");
    expect(shape(resolveSection("reference", { reference: definition }, referenceOnly).nodes)).toEqual([referenceRow]);
    expect(shape(resolveSection("reference", { reference: definition }).nodes)).toEqual([guidesRow]);
  });

  it("counts initialPath inside dirName's children, not from the omitted directory row", () => {
    const items = [{ type: "autogenerated" as const, dirName: "reference" }];
    expect(resolveSection("reference", { reference: { items, initialPath: [0] } }).nodes).toEqual([]);
    expect(shape(resolveSection("reference", { reference: { items, initialPath: [0], initialPathMode: "node" } }).nodes)).toEqual([
      leaf("Basics", "reference/basics"),
    ]);
  });

  it("turns doc items into leaves and synthetic categories into unlinked headings", () => {
    const resolved = resolveSection("guides", {
      guides: [
        "guides/setup",
        { type: "category", label: "Basics", items: ["reference/basics", "reference/commands"] },
      ],
    });
    expect(shape(resolved.nodes)).toEqual([
      { label: "Setup", href: "/handbook/docs/guides/setup", children: [] },
      { label: "Basics", children: [leaf("Basics", "reference/basics"), leaf("Commands", "reference/commands")] },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Umbrella tree — the Learn recipe. Its helper blocks are the showcase's real
// src/lib modules, byte for byte.
// ---------------------------------------------------------------------------

const UMBRELLA_FILES = [
  "src/lib/learn-navigation.ts",
  "src/lib/learn-chrome.tsx",
  "src/chrome-bindings.tsx",
  "zfb.config.ts",
] as const;

interface UmbrellaChromeModule {
  createUmbrellaChrome(
    routeCtx: RouteContext,
    bindings: ChromeHostBindings,
    umbrellas: readonly { root: string; branches: readonly string[] }[],
  ): { Header: (props: HeaderSlotProps) => unknown; Sidebar: (props: SidebarSlotProps) => unknown };
}
interface UmbrellaTreeModule {
  learnNavigation: { root: string; branches: readonly string[] };
}

describe("Editorial Navigation guide — umbrella tree recipe", () => {
  let umbrellaDir: string;
  let umbrellaChrome: UmbrellaChromeModule;
  let umbrellaTree: UmbrellaTreeModule;

  const learnDocs = [
    doc("learn/index", "Learn", 1, { sidebar_initial_expansion: "collapsed" }),
    doc("guides/index", "Guides", 2),
    doc("guides/setup/index", "Setup", 1),
    doc("guides/setup/install", "Install", 1),
    doc("components/index", "Components", 3),
    doc("components/card", "Card", 1),
    doc("markdown-features/index", "Markdown Features", 4),
    doc("reference/index", "Reference", 5),
  ];
  const learnCollections: Record<string, DocPageEntry[]> = {
    docs: learnDocs,
    "docs-v-1.0": learnDocs.filter((entry) => !entry.slug.startsWith("learn/")),
  };
  const learnContext = () =>
    createRouteContext(
      { settings, translations: {}, tagVocabulary: [], colorSchemes: null, assetManifest: null } as never,
      { stableDocs: (name) => learnCollections[name] ?? [] },
    );
  const section = { items: [], scopeRoot: "configured" } as const;
  const learnBindings: ChromeHostBindings = {
    sidebarsConfig: { learn: section, guides: section, components: section, "markdown-features": section },
  };
  const learnPage = (slug: string, navSection: string, currentVersion?: string) => ({
    currentSlug: slug,
    lang: "en",
    navSection,
    currentVersion,
    currentPath: `/handbook/${currentVersion ? `v/${currentVersion}/` : ""}docs/${slug}`,
  });

  beforeAll(async () => {
    const { umbrella } = readFences(guidePath("docs"));
    umbrellaDir = mkdtempSync(join(tmpdir(), "umbrella-navigation-example-"));
    symlinkSync(resolve(repoRoot, "node_modules"), join(umbrellaDir, "node_modules"), "dir");
    writeFileSync(
      join(umbrellaDir, "tsconfig.json"),
      JSON.stringify({ extends: "@takazudo/zudo-doc/tsconfig.base.json", include: ["src", "zfb.config.ts"] }),
    );
    for (const file of UMBRELLA_FILES) {
      const source = umbrella.get(file);
      if (source === undefined) throw new Error(`The umbrella example has no code block titled ${file}`);
      mkdirSync(dirname(join(umbrellaDir, file)), { recursive: true });
      writeFileSync(join(umbrellaDir, file), source);
    }
    umbrellaTree = await import(pathToFileURL(join(umbrellaDir, "src/lib/learn-navigation.ts")).href);
    umbrellaChrome = await import(pathToFileURL(join(umbrellaDir, "src/lib/learn-chrome.tsx")).href);
  });

  afterAll(() => {
    if (umbrellaDir) rmSync(umbrellaDir, { recursive: true, force: true });
  });

  it("documents the showcase's real helper modules verbatim", () => {
    const { umbrella } = readFences(guidePath("docs"));
    for (const file of ["src/lib/learn-navigation.ts", "src/lib/learn-chrome.tsx"]) {
      expect(umbrella.get(file)).toBe(readFileSync(resolve(repoRoot, file), "utf8"));
    }
  });

  it("type-checks the complete umbrella example against the published package exports", () => {
    const tsc = resolve(repoRoot, "node_modules/typescript/bin/tsc");
    const result = spawnSync(process.execPath, [tsc, "--noEmit", "-p", umbrellaDir], { encoding: "utf8" });
    expect(result.stdout + result.stderr).toBe("");
    expect(result.status).toBe(0);
  }, 120_000);

  it("renders the documented Learn tree and keeps native navigation where Learn is missing", () => {
    const { Header, Sidebar } = umbrellaChrome.createUmbrellaChrome(learnContext(), learnBindings, [umbrellaTree.learnNavigation]);
    const learn = sidebarData(Sidebar(learnPage("learn", "learn")));
    expect(shape(learn.navigation!.roots)).toEqual([
      {
        label: "Learn",
        href: "/handbook/docs/learn",
        children: [
          {
            label: "Guides",
            href: "/handbook/docs/guides",
            children: [
              { label: "Setup", href: "/handbook/docs/guides/setup", children: [
                { label: "Install", href: "/handbook/docs/guides/setup/install", children: [] },
              ] },
            ],
          },
          { label: "Components", href: "/handbook/docs/components", children: [
            { label: "Card", href: "/handbook/docs/components/card", children: [] },
          ] },
          { label: "Markdown Features", href: "/handbook/docs/markdown-features", children: [] },
        ],
      },
    ]);

    const guides = sidebarData(Sidebar(learnPage("guides/setup/install", "guides")));
    expect(guides.nodes.map((node) => node.slug)).toEqual(["guides"]);
    expect(guides.navigation!.localParentId).toBe(learn.navigation!.roots[0]!.occurrenceId);
    expect(drawerData(Header(learnPage("guides/setup/install", "guides"))).navigation).toEqual(guides.navigation);

    const archived = sidebarData(Sidebar(learnPage("guides/setup/install", "guides", "1.0")));
    expect(archived.navigation!.roots.map((node) => node.slug)).toEqual(["guides"]);
    expect(archived.nodes[0]).toMatchObject({ href: "/handbook/v/1.0/docs/guides" });
  });
});
