/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * Factory tests for createCategoryNavWrapper — version threading (#3218).
 *
 * The wrapper previously hard-coded `resolveNavSource(locale, undefined, ...)`
 * and never remapped hrefs, so nav cards under `/v/{version}` silently linked
 * to the latest-version page instead of staying inside the version (source
 * issue #3194). Verifies:
 *
 *  1. Without `currentVersion`: `resolveNavSource` is called with `undefined`
 *     and card hrefs are byte-identical to the pre-#3218 shape.
 *  2. With `currentVersion`: `resolveNavSource` is called with the version
 *     slug (version-scoped data source) and card hrefs carry the versioned
 *     `/v/{slug}/` form (href remap) — for both the `category` (children of a
 *     node) and `categories` (explicit top-level slug list) modes.
 */

import { describe, expect, it, vi } from "vitest";
import { createCategoryNavWrapper } from "../index.js";
import type { CategoryNavDeps, CategoryNavNode } from "../index.js";
import type { NavNode as V2NavNode } from "../../nav-indexing/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(slug: string, overrides: Partial<CategoryNavNode> = {}): CategoryNavNode {
  return {
    slug,
    label: slug,
    hasPage: true,
    href: `/docs/${slug}`,
    children: [],
    ...overrides,
  };
}

function findNodeRecursive(
  tree: CategoryNavNode[],
  slug: string,
): CategoryNavNode | undefined {
  for (const node of tree) {
    if (node.slug === slug) return node;
    const found = findNodeRecursive(node.children, slug);
    if (found) return found;
  }
  return undefined;
}

function makeDeps(overrides: Partial<CategoryNavDeps> = {}): CategoryNavDeps {
  return {
    defaultLocale: "en",
    resolveNavSource: () => ({ navDocs: [], categoryMeta: new Map() }),
    buildNavTree: () => [
      makeNode("getting-started", {
        children: [
          makeNode("getting-started/install"),
          makeNode("getting-started/quickstart"),
        ],
      }),
    ],
    findNode: findNodeRecursive,
    firstRoutedHref: (node) => node.href,
    versionedDocsUrl: (slug, versionSlug, lang) => `/v/${versionSlug}/${lang}/docs/${slug}`,
    ...overrides,
  };
}

function cardsOf(result: unknown): V2NavNode[] {
  return (result as { props: { children: V2NavNode[] } }).props.children;
}

// ---------------------------------------------------------------------------
// `category` mode (children of a single node)
// ---------------------------------------------------------------------------

describe("createCategoryNavWrapper — version threading (#3218), category mode", () => {
  it("without a version: resolveNavSource(locale, undefined, ...) and hrefs are unversioned", () => {
    const resolveNavSource = vi.fn(() => ({ navDocs: [], categoryMeta: new Map() }));
    const CategoryNavWrapper = createCategoryNavWrapper(makeDeps({ resolveNavSource }));
    const result = CategoryNavWrapper({ category: "getting-started" });

    expect(resolveNavSource).toHaveBeenCalledWith("en", undefined, { keepUnlisted: true });
    expect(cardsOf(result).map((c) => c.href)).toEqual([
      "/docs/getting-started/install",
      "/docs/getting-started/quickstart",
    ]);
  });

  it("with a version: resolveNavSource(locale, version, ...) and hrefs carry /v/{slug}/", () => {
    const resolveNavSource = vi.fn(() => ({ navDocs: [], categoryMeta: new Map() }));
    const CategoryNavWrapper = createCategoryNavWrapper(makeDeps({ resolveNavSource }));
    const result = CategoryNavWrapper({ category: "getting-started", currentVersion: "1.0" });

    expect(resolveNavSource).toHaveBeenCalledWith("en", "1.0", { keepUnlisted: true });
    expect(cardsOf(result).map((c) => c.href)).toEqual([
      "/v/1.0/en/docs/getting-started/install",
      "/v/1.0/en/docs/getting-started/quickstart",
    ]);
  });

  it("back-compat: versionedDocsUrl omitted + a version requested — hrefs stay unversioned and a dev warning is logged (no throw)", () => {
    // `versionedDocsUrl` is optional (frozen public subpath back-compat —
    // see the field's doc comment in ../index.js). A pre-#3218 caller that
    // hand-constructs CategoryNavDeps without it must keep compiling and
    // must not crash when a version is requested; it degrades to unversioned
    // hrefs with a loud warning instead.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deps = makeDeps();
    delete (deps as { versionedDocsUrl?: unknown }).versionedDocsUrl;
    const CategoryNavWrapper = createCategoryNavWrapper(deps);
    const result = CategoryNavWrapper({ category: "getting-started", currentVersion: "1.0" });

    expect(cardsOf(result).map((c) => c.href)).toEqual([
      "/docs/getting-started/install",
      "/docs/getting-started/quickstart",
    ]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("versionedDocsUrl"));
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// `categories` mode (explicit top-level slug list)
// ---------------------------------------------------------------------------

describe("createCategoryNavWrapper — version threading (#3218), categories mode", () => {
  it("without a version: card hrefs resolved via findNode are unversioned", () => {
    const CategoryNavWrapper = createCategoryNavWrapper(makeDeps());
    const result = CategoryNavWrapper({ categories: ["getting-started"] });

    expect(cardsOf(result)).toEqual([
      expect.objectContaining({ href: "/docs/getting-started" }),
    ]);
  });

  it("with a version: card hrefs resolved via findNode carry /v/{slug}/", () => {
    const CategoryNavWrapper = createCategoryNavWrapper(makeDeps());
    const result = CategoryNavWrapper({ categories: ["getting-started"], currentVersion: "1.0" });

    expect(cardsOf(result)).toEqual([
      expect.objectContaining({ href: "/v/1.0/en/docs/getting-started" }),
    ]);
  });
});
