/**
 * Unit tests for `prepareHomeData` (#2519).
 *
 * Covers:
 *  1. Default-locale branch: `resolveNavSource`'s own returned `categoryMeta`,
 *     called with `{}` nav-source options.
 *  2. Non-default-locale branch: `resolveNavSource` called with
 *     `{ applyDefaultLocaleOnlyFilter: true, keepUnlisted: true }`, and
 *     category meta read via `loadCategoryMeta(cfg.dir)` — locale-dir-ONLY,
 *     NOT the merged categoryMeta `resolveNavSource` returned.
 *  3. An unconfigured locale throws.
 *  4. `tagCount` excludes `category_no_page` docs and uses
 *     `data.slug ?? toRouteSlug(id)`.
 *  5. `navSourceOptions` / `categoryMetaDir` overrides are honored.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { RouteContext } from "../../factory-context/index.js";
import type { DocPageEntry, DocNavNode } from "../../doc-page-props/index.js";
import type { CategoryMeta } from "../../sidebar-tree/index.js";

const { loadCategoryMetaMock } = vi.hoisted(() => ({
  loadCategoryMetaMock: vi.fn(),
}));

vi.mock("../../sidebar-tree/index.js", () => ({
  loadCategoryMeta: loadCategoryMetaMock,
}));

import { prepareHomeData } from "../prepare-home-data.js";

function makeDoc(overrides: Partial<DocPageEntry> = {}): DocPageEntry {
  return {
    id: "getting-started",
    data: { title: "Getting Started" },
    ...overrides,
  } as DocPageEntry;
}

interface StubOptions {
  defaultLocale?: string;
  getLocaleConfig?: RouteContext["getLocaleConfig"];
  navDocs?: DocPageEntry[];
  resolvedCategoryMeta?: Map<string, CategoryMeta>;
  tree?: DocNavNode[];
}

/** A minimal stub RouteContext — only the members `prepareHomeData` reads. */
function makeStubRouteContext(opts: StubOptions = {}) {
  const navDocs = opts.navDocs ?? [makeDoc()];
  const resolvedCategoryMeta = opts.resolvedCategoryMeta ?? new Map<string, CategoryMeta>();
  const tree = opts.tree ?? [];

  const resolveNavSource = vi.fn().mockReturnValue({
    docs: navDocs,
    navDocs,
    categoryMeta: resolvedCategoryMeta,
    localeSlugSet: new Set<string>(),
  });
  const buildNavTree = vi.fn().mockReturnValue(tree);
  const getCategoryOrder = vi.fn().mockReturnValue(["guides"]);
  const groupSatelliteNodes = vi.fn((t: DocNavNode[]) => t);
  const collectTags = vi.fn().mockReturnValue(new Map());
  const docsUrl = vi.fn((slug: string, lang?: string) => `/${lang}/docs/${slug}`);
  const toRouteSlug = vi.fn((id: string) => id);

  const ctx = {
    defaultLocale: opts.defaultLocale ?? "en",
    getLocaleConfig: opts.getLocaleConfig ?? (() => undefined),
    resolveNavSource,
    buildNavTree,
    getCategoryOrder,
    groupSatelliteNodes,
    collectTags,
    docsUrl,
    toRouteSlug,
  } as unknown as RouteContext;

  return {
    ctx,
    resolveNavSource,
    buildNavTree,
    getCategoryOrder,
    groupSatelliteNodes,
    collectTags,
    docsUrl,
    toRouteSlug,
  };
}

beforeEach(() => {
  loadCategoryMetaMock.mockReset();
  loadCategoryMetaMock.mockReturnValue(new Map());
});

describe("prepareHomeData — default-locale branch", () => {
  it("uses resolveNavSource's returned categoryMeta with {} nav-source options", () => {
    const resolvedCategoryMeta = new Map<string, CategoryMeta>([["guides", { label: "Guides" }]]);
    const { ctx, resolveNavSource, buildNavTree } = makeStubRouteContext({
      defaultLocale: "en",
      resolvedCategoryMeta,
    });

    prepareHomeData(ctx, "en");

    expect(resolveNavSource).toHaveBeenCalledWith("en", undefined, {});
    expect(loadCategoryMetaMock).not.toHaveBeenCalled();
    // buildNavTree receives resolveNavSource's own categoryMeta, not a
    // locale-dir-loaded one.
    expect(buildNavTree.mock.calls[0]![2]).toBe(resolvedCategoryMeta);
  });

  it("passes a docsUrl-bound href builder to buildNavTree", () => {
    const { ctx, buildNavTree, docsUrl } = makeStubRouteContext({ defaultLocale: "en" });

    prepareHomeData(ctx, "en");

    const hrefBuilder = buildNavTree.mock.calls[0]![3];
    hrefBuilder("getting-started", "en");
    expect(docsUrl).toHaveBeenCalledWith("getting-started", "en");
  });
});

describe("prepareHomeData — non-default-locale branch", () => {
  it("passes the locale-home nav-source filter and reads locale-dir-only categoryMeta", () => {
    const cfg = { label: "Japanese", dir: "src/content/docs-ja" };
    const localeCategoryMeta = new Map<string, CategoryMeta>([["guides", { label: "ガイド" }]]);
    loadCategoryMetaMock.mockReturnValue(localeCategoryMeta);

    const mergedCategoryMeta = new Map<string, CategoryMeta>([["guides", { label: "MERGED — must not be used" }]]);
    const { ctx, resolveNavSource, buildNavTree } = makeStubRouteContext({
      defaultLocale: "en",
      getLocaleConfig: () => cfg,
      resolvedCategoryMeta: mergedCategoryMeta,
    });

    prepareHomeData(ctx, "ja");

    expect(resolveNavSource).toHaveBeenCalledWith("ja", undefined, {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });
    expect(loadCategoryMetaMock).toHaveBeenCalledWith(cfg.dir);
    // CRITICAL semantics: locale-dir-only categoryMeta is used, NOT the
    // merged categoryMeta resolveNavSource returned.
    expect(buildNavTree.mock.calls[0]![2]).toBe(localeCategoryMeta);
    expect(buildNavTree.mock.calls[0]![2]).not.toBe(mergedCategoryMeta);
  });

  it("throws for an unconfigured locale", () => {
    const { ctx } = makeStubRouteContext({
      defaultLocale: "en",
      getLocaleConfig: () => undefined,
    });

    expect(() => prepareHomeData(ctx, "fr")).toThrow(/fr.*not configured/);
  });
});

describe("prepareHomeData — tagCount", () => {
  it("excludes category_no_page docs and uses data.slug ?? toRouteSlug(id)", () => {
    const navDocs: DocPageEntry[] = [
      makeDoc({ id: "a", data: { title: "A", slug: "custom-a" } }),
      makeDoc({ id: "b", data: { title: "B", category_no_page: true } }),
      makeDoc({ id: "c", data: { title: "C" } }),
    ];
    const { ctx, collectTags, toRouteSlug } = makeStubRouteContext({
      defaultLocale: "en",
      navDocs,
    });

    prepareHomeData(ctx, "en");

    expect(collectTags).toHaveBeenCalledTimes(1);
    const [filteredDocs, slugFn] = collectTags.mock.calls[0]!;
    expect(filteredDocs).toEqual([navDocs[0]!, navDocs[2]!]);

    slugFn(navDocs[0]!.id, navDocs[0]!.data);
    expect(toRouteSlug).not.toHaveBeenCalled(); // slug present — no fallback call
    slugFn(navDocs[2]!.id, navDocs[2]!.data);
    expect(toRouteSlug).toHaveBeenCalledWith("c");
  });

  it("returns the tagCount as collectTags' resolved map size", () => {
    const { ctx, collectTags } = makeStubRouteContext({ defaultLocale: "en" });
    collectTags.mockReturnValue(new Map([["a", {}], ["b", {}]]));

    const data = prepareHomeData(ctx, "en");

    expect(data.tagCount).toBe(2);
  });
});

describe("prepareHomeData — overrides", () => {
  it("navSourceOptions overrides the default filter for the default locale", () => {
    const { ctx, resolveNavSource } = makeStubRouteContext({ defaultLocale: "en" });

    prepareHomeData(ctx, "en", { navSourceOptions: { keepUnlisted: true } });

    expect(resolveNavSource).toHaveBeenCalledWith("en", undefined, { keepUnlisted: true });
  });

  it("navSourceOptions overrides the default locale-home filter for a non-default locale", () => {
    const cfg = { label: "Japanese", dir: "src/content/docs-ja" };
    const { ctx, resolveNavSource } = makeStubRouteContext({
      defaultLocale: "en",
      getLocaleConfig: () => cfg,
    });

    prepareHomeData(ctx, "ja", { navSourceOptions: { keepUnlisted: false } });

    expect(resolveNavSource).toHaveBeenCalledWith("ja", undefined, { keepUnlisted: false });
  });

  it("categoryMetaDir is honored on the default-locale branch (loads it instead of resolveNavSource's categoryMeta)", () => {
    const overrideMeta = new Map<string, CategoryMeta>([["guides", { label: "Override" }]]);
    loadCategoryMetaMock.mockReturnValue(overrideMeta);
    const resolvedCategoryMeta = new Map<string, CategoryMeta>([["guides", { label: "resolveNavSource — must not be used" }]]);
    const { ctx, buildNavTree } = makeStubRouteContext({
      defaultLocale: "en",
      resolvedCategoryMeta,
    });

    prepareHomeData(ctx, "en", { categoryMetaDir: "src/content/docs-v2" });

    expect(loadCategoryMetaMock).toHaveBeenCalledWith("src/content/docs-v2");
    expect(buildNavTree.mock.calls[0]![2]).toBe(overrideMeta);
    expect(buildNavTree.mock.calls[0]![2]).not.toBe(resolvedCategoryMeta);
  });

  it("categoryMetaDir overrides the locale-dir passed to loadCategoryMeta", () => {
    const cfg = { label: "Japanese", dir: "src/content/docs-ja" };
    const { ctx } = makeStubRouteContext({
      defaultLocale: "en",
      getLocaleConfig: () => cfg,
    });

    prepareHomeData(ctx, "ja", { categoryMetaDir: "src/content/docs-ja-v2" });

    expect(loadCategoryMetaMock).toHaveBeenCalledWith("src/content/docs-ja-v2");
  });
});

describe("prepareHomeData — grouping", () => {
  it("returns the GROUPED (post-groupSatelliteNodes) tree, not the raw buildNavTree output", () => {
    const rawTree: DocNavNode[] = [
      { slug: "a", label: "A", position: 0, hasPage: true, children: [] },
    ];
    const groupedTree: DocNavNode[] = [
      { slug: "grouped", label: "Grouped", position: 0, hasPage: true, children: [] },
    ];
    const { ctx, groupSatelliteNodes, getCategoryOrder } = makeStubRouteContext({
      defaultLocale: "en",
      tree: rawTree,
    });
    groupSatelliteNodes.mockReturnValue(groupedTree);

    const data = prepareHomeData(ctx, "en");

    expect(groupSatelliteNodes).toHaveBeenCalledWith(rawTree, ["guides"]);
    expect(data.tree).toBe(groupedTree);
    expect(data.categoryOrder).toBe(getCategoryOrder.mock.results[0]!.value);
  });
});
