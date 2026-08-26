// Contract suite for `@takazudo/zudo-doc/site-schema` (zudolab/zudo-doc#3395).
//
// Four things are pinned here:
//   1. the subpath exists in package.json#exports and points at the built barrel;
//   2. the exported symbol set (runtime functions + the type names in the
//      emitted declaration);
//   3. the pure domain behaves — nav tree, breadcrumbs, prev/next, auto-index,
//      and the per-factory memo scope that keeps two route contexts from
//      serving each other's cached routes;
//   4. NOTHING reachable from the barrel — through the bundled JS graph OR the
//      transitive `.d.ts` graph — is a `node:*` builtin, preact, a stylesheet,
//      a `virtual:` module, or an `@takazudo/zfb*` package.
//
// The dist-reading cases assume a prior `pnpm --filter @takazudo/zudo-doc build`,
// the same precondition catalog.test.ts relies on; they read artifacts only and
// never trigger a build, so this stays in the fast unit tier.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  schemaVersion,
  buildNavTree,
  buildBreadcrumbs,
  collectAutoIndexNodes,
  createDocRouteEntries,
  findNode,
  firstRoutedHref,
  groupSatelliteNodes,
  isNavVisible,
  resolveDocPrevNext,
  flattenTree,
  validateNoteTrays,
} from "../site-schema/index.js";
import type {
  AutoIndexNode,
  DocEntryLike,
  DocNavNode,
  DocPageFrontmatter,
  DocRouteEntriesContext,
  NavSourceDocs,
} from "../site-schema/index.js";
import { toRouteSlug, toSlugParams } from "../slug/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "../..");
const REPO_ROOT = resolve(PKG_ROOT, "../..");
const SRC_ENTRY = resolve(PKG_ROOT, "src/site-schema/index.ts");
const DIST_DTS = resolve(PKG_ROOT, "dist/site-schema/index.d.ts");

// The detector is shared verbatim with the `prepack` guard
// (`scripts/check-site-schema.mjs`) so the two can never disagree about what
// counts as browser-unsafe. It is loaded through a runtime URL rather than a
// literal specifier because it is plain `.mjs` with no declarations — node and
// vitest both resolve it, and TypeScript never has to.
interface SiteSchemaGraph {
  forbiddenLabel(specifier: string): string | undefined;
  analyzeDeclarationGraph(entry: string): {
    violations: Array<{ specifier: string; label: string; importer: string }>;
    files: string[];
  };
  analyzeSiteSchemaGraph(args: { entry: string; resolveFrom: string[] }): Promise<{
    violations: Array<{ specifier: string; label: string; importer: string }>;
    specifiers: string[];
  }>;
}

async function loadGraphHelper(): Promise<SiteSchemaGraph> {
  const url = pathToFileURL(resolve(PKG_ROOT, "scripts/site-schema-graph.mjs")).href;
  return (await import(/* @vite-ignore */ url)) as SiteSchemaGraph;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function entry(slug: string, data: Partial<DocPageFrontmatter> = {}): DocEntryLike {
  return { slug, data: { title: slug, ...data }, body: "" };
}

const docsUrlFor = (base: string) => (slug: string) => (slug ? `${base}/docs/${slug}/` : `${base}/docs/`);

/** A minimal but complete route context, parameterized on its URL space so two
 *  instances are distinguishable in their output. */
function makeContext(base: string): DocRouteEntriesContext {
  return {
    defaultLocale: "en",
    buildNavTree: (docs, locale, categoryMeta, buildHref) =>
      buildNavTree(docs, locale, categoryMeta, buildHref),
    docsUrl: docsUrlFor(base),
    withBase: (path) => `${base}${path}`,
    collectAutoIndexNodes: (tree) => collectAutoIndexNodes(tree) as AutoIndexNode[],
    getNavSectionForSlug: () => undefined,
    getNavSubtree: (tree) => tree,
    toRouteSlug,
    toSlugParams,
    extractHeadings: () => [],
  };
}

function makeSource(docs: DocEntryLike[]): NavSourceDocs {
  return { docs, navDocs: docs, categoryMeta: new Map(), localeSlugSet: new Set() };
}

// ---------------------------------------------------------------------------
// (1) Exports-map entry
// ---------------------------------------------------------------------------

describe("./site-schema subpath export", () => {
  it("points at the built barrel", () => {
    const pkg = JSON.parse(readFileSync(resolve(PKG_ROOT, "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
      scripts: Record<string, string>;
    };
    expect(pkg.exports["./site-schema"]).toEqual({
      types: "./dist/site-schema/index.d.ts",
      default: "./dist/site-schema/index.js",
    });
  });

  it("is guarded at publish time by check-site-schema.mjs", () => {
    const pkg = JSON.parse(readFileSync(resolve(PKG_ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["check:prepack-contract"]).toContain("check-site-schema.mjs");
    expect(pkg.scripts.prepack).toBe("pnpm check:prepack-contract");
  });
});

// ---------------------------------------------------------------------------
// (2) Exported symbol set
// ---------------------------------------------------------------------------

describe("site-schema exported symbols", () => {
  it("freezes the runtime export set", async () => {
    const mod = await import("../site-schema/index.js");
    expect(Object.keys(mod).sort()).toMatchInlineSnapshot(`
      [
        "buildBreadcrumbs",
        "buildNavTree",
        "buildSidebarTree",
        "collectAutoIndexNodes",
        "createDocRouteEntries",
        "extractHeadings",
        "findNode",
        "firstRoutedHref",
        "flattenSubtree",
        "flattenTree",
        "getCategoryOrder",
        "getNavSectionForSlug",
        "getNavSubtree",
        "groupSatelliteNodes",
        "isNavVisible",
        "remapNavChildHrefs",
        "resolveDocPrevNext",
        "rewriteNavHref",
        "schemaVersion",
        "validateNoteTrays",
      ]
    `);
  });

  it("carries a schemaVersion so consumers can fail closed", () => {
    expect(schemaVersion).toBe(1);
  });

  it("declares every documented type in the emitted declaration", () => {
    expect(existsSync(DIST_DTS), `${DIST_DTS} missing — run \`pnpm --filter @takazudo/zudo-doc build\``).toBe(true);
    const dts = readFileSync(DIST_DTS, "utf8");
    for (const name of [
      "DocNavNode",
      "AutoIndexNode",
      "DocPageFrontmatter",
      "DocPageBaseProps",
      "DocPageEntryProps",
      "DocPageAutoIndexProps",
      "DocRouteEntry",
      "BuildDocRouteEntriesArgs",
      "DocRouteEntriesContext",
      "NavSourceDocs",
      "BreadcrumbItem",
      "HeadingItem",
      "SidebarNode",
      "CategoryMeta",
      "SidebarFrontmatter",
      "CollectionEntryLike",
      "PaginationOverrides",
    ]) {
      expect(dts, `${name} is not exported from dist/site-schema/index.d.ts`).toContain(name);
    }
  });

  it("keeps the component-side breadcrumb helpers out of the contract", async () => {
    const mod = await import("../site-schema/index.js");
    expect(mod).not.toHaveProperty("findPath");
    expect(mod).not.toHaveProperty("buildBreadcrumbItems");
  });
});

// ---------------------------------------------------------------------------
// (3) The pure domain
// ---------------------------------------------------------------------------

describe("site-schema pure surface", () => {
  const docs = [
    entry("getting-started/index", { title: "Getting Started", sidebar_position: 1 }),
    entry("getting-started/install", { title: "Install", sidebar_position: 2 }),
    entry("guides/deep/nested", { title: "Nested", sidebar_position: 1 }),
  ];

  const tree = buildNavTree(docs, "en", undefined, (slug) => docsUrlFor("")(slug));

  it("builds a nav tree with category nesting", () => {
    expect(tree.map((n) => n.slug).sort()).toEqual(["getting-started", "guides"]);
    expect(findNode(tree, "getting-started/install")?.hasPage).toBe(true);
  });

  it("carries note-tray fields through the DocNavNode allowlist", () => {
    const noteTree = buildNavTree(
      [
        entry("notes/index", {
          category_shape: "note-tray",
          note_tray_dated: true,
          note_tray_sidebar: "month",
        }),
        entry("notes/hello", {
          sidebar_position: 1,
          date: "2026-08-22",
          updated: "2026-08-23",
        }),
      ],
      "en",
      undefined,
      docsUrlFor(""),
    );
    expect(noteTree[0]).toMatchObject({
      shape: "note-tray",
      noteTrayDated: true,
      noteTraySidebar: "month",
      children: [
        { date: "2026-08-22", updated: "2026-08-23", rank: 1 },
      ],
    });
  });

  it("treats a category without an index.mdx as an auto-index", () => {
    const autoIndexes = collectAutoIndexNodes(tree).map((n) => n.slug);
    expect(autoIndexes).toContain("guides");
    // getting-started HAS an index.mdx, so it is a real route, not an auto-index.
    expect(autoIndexes).not.toContain("getting-started");
  });

  it("walks the slug path to build breadcrumbs, leaving the last crumb unlinked", () => {
    const crumbs = buildBreadcrumbs(tree, "getting-started/install", "/");
    expect(crumbs.map((c) => c.label)).toEqual(["", "Getting Started", "Install"]);
    expect(crumbs[0]?.href).toBe("/");
    expect(crumbs.at(-1)?.href).toBeUndefined();
  });

  it("remaps intermediate crumbs through hrefFor but never the current page", () => {
    const crumbs = buildBreadcrumbs(tree, "getting-started/install", "/", (slug) => `/v/1.0/${slug}/`);
    expect(crumbs[1]?.href).toBe("/v/1.0/getting-started/");
    expect(crumbs.at(-1)?.href).toBeUndefined();
  });

  it("resolves prev/next sequentially and honours frontmatter overrides", () => {
    const flat = flattenTree(tree);
    const plain = resolveDocPrevNext(tree, flat, "getting-started/install", {});
    expect(plain.prev?.slug).toBe("getting-started");

    const suppressed = resolveDocPrevNext(tree, flat, "getting-started/install", {
      pagination_prev: null,
    });
    expect(suppressed.prev).toBeNull();

    const redirected = resolveDocPrevNext(tree, flat, "getting-started/install", {
      pagination_next: "guides/deep/nested",
    });
    expect(redirected.next?.slug).toBe("guides/deep/nested");
  });

  it("finds the first routed descendant href", () => {
    const guides = findNode(tree, "guides");
    expect(guides).toBeDefined();
    expect(firstRoutedHref(guides as DocNavNode)).toBe("/docs/guides/deep/nested/");
  });

  it("groups slug-prefix satellites under their primary node", () => {
    const flatTree: DocNavNode[] = [
      { slug: "api", label: "API", position: 1, hasPage: true, children: [] },
      { slug: "api-legacy", label: "Legacy", position: 2, hasPage: true, children: [] },
      { slug: "guides", label: "Guides", position: 3, hasPage: true, children: [] },
    ];
    const grouped = groupSatelliteNodes(flatTree, ["api"]);
    expect(grouped.map((n) => n.slug)).toEqual(["api", "guides"]);
    expect(grouped[0]?.children.map((c) => c.slug)).toEqual(["api-legacy"]);
  });

  it("hides unlisted and standalone docs from navigation", () => {
    expect(isNavVisible(entry("a"))).toBe(true);
    expect(isNavVisible(entry("b", { unlisted: true }))).toBe(false);
    expect(isNavVisible(entry("c", { standalone: true }))).toBe(false);
  });
});

describe("validateNoteTrays", () => {
  function validate(docs: DocEntryLike[]): void {
    const tree = buildNavTree(
      docs.filter(isNavVisible),
      "en",
      undefined,
      docsUrlFor(""),
    );
    validateNoteTrays(tree, docs);
  }

  it("accepts a valid flat dated tray", () => {
    expect(() =>
      validate([
        entry("notes/index", {
          category_shape: "note-tray",
          note_tray_dated: true,
          note_tray_sidebar: "month",
        }),
        entry("notes/one", { date: "2026-08-22" }),
      ]),
    ).not.toThrow();
  });

  it("reports every offending slug across rules (a)-(f)", () => {
    const docs = [
      entry("nested/notes/index", { category_shape: "note-tray" }),
      entry("nested/notes/deep/item"),
      entry("dated/index", {
        category_shape: "note-tray",
        note_tray_dated: true,
      }),
      entry("dated/unlisted", { unlisted: true }),
      entry("grouped/index", {
        category_shape: "note-tray",
        note_tray_sidebar: "year",
      }),
      entry("hidden/index", {
        category_shape: "note-tray",
        category_no_page: true,
      }),
      entry("bad-date", { date: "2026-02-31", updated: "2026-13-01" }),
    ];

    let message = "";
    try {
      validate(docs);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("[a] nested/notes");
    expect(message).toContain("[b] nested/notes/deep/item");
    expect(message).toContain("[c] dated/unlisted");
    expect(message).toContain("[d] grouped");
    expect(message).toContain("[e] hidden");
    expect(message).toContain("[f] bad-date");
  });

  it("rejects a declaration on a non-index file", () => {
    expect(() => validate([entry("notes", { category_shape: "note-tray" })])).toThrow(
      /notes.*index\.mdx/,
    );
  });
});

// ---------------------------------------------------------------------------
// (3b) createDocRouteEntries — route emission + memo scoping
// ---------------------------------------------------------------------------

describe("createDocRouteEntries", () => {
  const docs = [
    entry("index"),
    entry("guides/index", { category_no_page: true }),
    entry("guides/one"),
    entry("orphans/child"),
  ];

  it("emits no route for a category_no_page entry and one for each auto-index", () => {
    const { buildDocRouteEntries } = createDocRouteEntries(makeContext(""));
    const routes = buildDocRouteEntries({
      source: makeSource(docs),
      locale: "en",
      routeSig: "docs;en",
    });
    const slugs = routes.map((r) => r.slug);

    expect(slugs).toContain("guides/one");
    // `guides/index` carries category metadata only.
    expect(slugs.filter((s) => s === "guides")).toHaveLength(0);
    // `orphans` has a child but no index.mdx → one auto-index route.
    expect(slugs).toContain("orphans");
    expect(routes.find((r) => r.slug === "orphans")?.props.kind).toBe("autoIndex");
    expect(routes.find((r) => r.slug === "guides/one")?.props.kind).toBe("entry");
  });

  it("memoizes repeat calls within one factory", () => {
    const { buildDocRouteEntries } = createDocRouteEntries(makeContext(""));
    const source = makeSource(docs);
    const first = buildDocRouteEntries({ source, locale: "en", routeSig: "docs;en" });
    const second = buildDocRouteEntries({ source, locale: "en", routeSig: "docs;en" });
    expect(second).toBe(first);
  });

  it("runs note-tray validation as part of memoized route construction", () => {
    const invalidDocs = [
      entry("notes/index", {
        category_shape: "note-tray",
        note_tray_dated: true,
      }),
      entry("notes/unlisted", { unlisted: true }),
    ];
    const source = {
      ...makeSource(invalidDocs),
      navDocs: invalidDocs.filter(isNavVisible),
    };
    const { buildDocRouteEntries } = createDocRouteEntries(makeContext(""));
    expect(() =>
      buildDocRouteEntries({ source, locale: "en", routeSig: "docs;en" }),
    ).toThrow(/notes\/unlisted/);
  });

  // Regression for #3395: the memo used to be keyed on `source.docs` identity +
  // routeSig alone, so two factories sharing a docs array and a routeSig but
  // built over different URL/context closures served each other's cached routes.
  it("scopes the memo per factory instance", () => {
    const source = makeSource(docs);
    const args = { source, locale: "en", routeSig: "docs;en" } as const;

    const a = createDocRouteEntries(makeContext("/a")).buildDocRouteEntries({ ...args });
    const b = createDocRouteEntries(makeContext("/b")).buildDocRouteEntries({ ...args });

    expect(a).not.toBe(b);
    expect(a[0]?.props.breadcrumbs[0]?.href).toBe("/a/");
    expect(b[0]?.props.breadcrumbs[0]?.href).toBe("/b/");

    const autoIndexHref = (routes: typeof a) =>
      routes.find((r) => r.slug === "orphans")?.props.autoIndex?.href;
    expect(autoIndexHref(a)).toBe("/a/docs/orphans/");
    expect(autoIndexHref(b)).toBe("/b/docs/orphans/");
  });
});

// ---------------------------------------------------------------------------
// (4) Browser safety — bundled graph
// ---------------------------------------------------------------------------

describe("site-schema stays browser-safe", () => {
  it("reaches no node:*, preact, .css, virtual:, or @takazudo/zfb specifier", async () => {
    const { analyzeSiteSchemaGraph } = await loadGraphHelper();
    const { violations, specifiers } = await analyzeSiteSchemaGraph({
      entry: SRC_ENTRY,
      resolveFrom: [PKG_ROOT, REPO_ROOT, __dirname],
    });
    expect(
      violations,
      violations.map((v) => `${v.specifier} (${v.label}) via ${v.importer}`).join("\n"),
    ).toEqual([]);
    // Sanity: the analysis actually walked a graph rather than short-circuiting.
    expect(specifiers.length).toBeGreaterThan(0);
  });

  it("DETECTS a forbidden specifier (guard is not dead code)", async () => {
    const { forbiddenLabel } = await loadGraphHelper();
    expect(forbiddenLabel("node:fs")).toBe("node builtin");
    expect(forbiddenLabel("preact/hooks")).toBe("preact");
    expect(forbiddenLabel("@takazudo/zfb/content")).toBe("zfb engine package");
    expect(forbiddenLabel("@takazudo/zfb-runtime")).toBe("zfb engine package");
    expect(forbiddenLabel("virtual:zudo-doc-route-context")).toBe("zfb virtual module");
    expect(forbiddenLabel("../theme.css")).toBe("stylesheet");
    expect(forbiddenLabel("../slug/index.js")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// (4b) Browser safety — TRANSITIVE declaration graph
// ---------------------------------------------------------------------------

describe("site-schema declaration graph", () => {
  it("never reaches @takazudo/zfb (or any other forbidden package) transitively", async () => {
    const { analyzeDeclarationGraph } = await loadGraphHelper();
    expect(
      existsSync(DIST_DTS),
      `${DIST_DTS} missing — run \`pnpm --filter @takazudo/zudo-doc build\``,
    ).toBe(true);

    const { violations, files } = analyzeDeclarationGraph(DIST_DTS);
    expect(
      violations,
      violations.map((v) => `${v.specifier} (${v.label}) declared in ${v.importer}`).join("\n"),
    ).toEqual([]);
    // The walk must have covered more than the barrel itself.
    expect(files.length).toBeGreaterThan(1);
  });
});
