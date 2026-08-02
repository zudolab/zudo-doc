/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * Factory tests for createCategoryTreeNavWrapper — version threading (#3218).
 *
 * The wrapper previously hard-coded `resolveNavSource(locale, undefined, ...)`
 * and never remapped hrefs, so nav cards under `/v/{version}` silently linked
 * to the latest-version page instead of staying inside the version (source
 * issue #3194). Verifies:
 *
 *  1. Without `currentVersion`: `resolveNavSource` is called with `undefined`
 *     and card hrefs are byte-identical to the pre-#3218 shape.
 *  2. With `currentVersion`: `resolveNavSource` is called with the version
 *     slug (version-scoped data source) and the rendered tree's hrefs carry
 *     the versioned `/v/{slug}/` form (href remap, applied after
 *     groupSatelliteNodes — same order as `buildSidebarNodes`).
 */

import { describe, expect, it, vi } from "vitest";
import { createCategoryTreeNavWrapper } from "../index.js";
import type { CategoryTreeNavDeps, CategoryTreeNavNode } from "../index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(
  slug: string,
  overrides: Partial<CategoryTreeNavNode> = {},
): CategoryTreeNavNode {
  return {
    slug,
    label: slug,
    hasPage: true,
    href: `/docs/${slug}`,
    children: [],
    ...overrides,
  };
}

function makeDeps(overrides: Partial<CategoryTreeNavDeps> = {}): CategoryTreeNavDeps {
  return {
    defaultLocale: "en",
    resolveNavSource: () => ({ navDocs: [], categoryMeta: new Map() }),
    buildNavTree: () => [
      makeNode("guides", {
        children: [makeNode("guides/layout"), makeNode("guides/theming")],
      }),
    ],
    groupSatelliteNodes: (tree) => tree,
    findNode: (tree, slug) => tree.find((n) => n.slug === slug),
    versionedDocsUrl: (slug, versionSlug, lang) => `/v/${versionSlug}/${lang}/docs/${slug}`,
    ...overrides,
  };
}

function childHrefsOf(result: unknown): (string | undefined)[] {
  const el = result as { props: { children: CategoryTreeNavNode[] } };
  return el.props.children.map((c) => c.href);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createCategoryTreeNavWrapper — version threading (#3218)", () => {
  it("without a version: resolveNavSource(locale, undefined, ...) and hrefs are unversioned", () => {
    const resolveNavSource = vi.fn(() => ({ navDocs: [], categoryMeta: new Map() }));
    const CategoryTreeNavWrapper = createCategoryTreeNavWrapper(makeDeps({ resolveNavSource }));
    const result = CategoryTreeNavWrapper({ category: "guides" });

    expect(resolveNavSource).toHaveBeenCalledWith("en", undefined, { keepUnlisted: true });
    expect(childHrefsOf(result)).toEqual(["/docs/guides/layout", "/docs/guides/theming"]);
  });

  it("with a version: resolveNavSource(locale, version, ...) and hrefs carry /v/{slug}/", () => {
    const resolveNavSource = vi.fn(() => ({ navDocs: [], categoryMeta: new Map() }));
    const CategoryTreeNavWrapper = createCategoryTreeNavWrapper(makeDeps({ resolveNavSource }));
    const result = CategoryTreeNavWrapper({ category: "guides", currentVersion: "1.0" });

    expect(resolveNavSource).toHaveBeenCalledWith("en", "1.0", { keepUnlisted: true });
    expect(childHrefsOf(result)).toEqual([
      "/v/1.0/en/docs/guides/layout",
      "/v/1.0/en/docs/guides/theming",
    ]);
  });

  it("back-compat: versionedDocsUrl omitted + a version requested — hrefs stay unversioned and a dev warning is logged (no throw)", () => {
    // `versionedDocsUrl` is optional (frozen public subpath back-compat —
    // see the field's doc comment in ../index.js). A pre-#3218 caller that
    // hand-constructs CategoryTreeNavDeps without it must keep compiling and
    // must not crash when a version is requested; it degrades to unversioned
    // hrefs with a loud warning instead.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deps = makeDeps();
    delete (deps as { versionedDocsUrl?: unknown }).versionedDocsUrl;
    const CategoryTreeNavWrapper = createCategoryTreeNavWrapper(deps);
    const result = CategoryTreeNavWrapper({ category: "guides", currentVersion: "1.0" });

    expect(childHrefsOf(result)).toEqual(["/docs/guides/layout", "/docs/guides/theming"]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("versionedDocsUrl"));
    warnSpy.mockRestore();
  });

  it("passes the version-remapped tree to groupSatelliteNodes' result before findNode, not the raw pre-remap tree", () => {
    // Regression guard for ordering: groupSatelliteNodes must see the RAW tree
    // (its grouping-by-prefix logic depends on unversioned slugs), and the
    // remap must happen on its result — mirroring buildSidebarNodes.
    const groupSatelliteNodes = vi.fn((tree: CategoryTreeNavNode[]) => tree);
    const CategoryTreeNavWrapper = createCategoryTreeNavWrapper(
      makeDeps({ groupSatelliteNodes }),
    );
    CategoryTreeNavWrapper({ category: "guides", currentVersion: "1.0" });

    expect(groupSatelliteNodes).toHaveBeenCalledWith(
      [expect.objectContaining({ slug: "guides", href: "/docs/guides" })],
      ["guides"],
    );
  });
});

// ---------------------------------------------------------------------------
// Back-compat: the pre-#3218 slug-less node shape
// ---------------------------------------------------------------------------

describe("createCategoryTreeNavWrapper — back-compat: pre-#3218 slug-less node shape", () => {
  // `CategoryTreeNavNode.slug` is optional (frozen public subpath back-compat
  // — see the field's doc comment in ../index.js). These literals are the exact
  // nodes a pre-#3218 consumer's `buildNavTree` emits; the explicit
  // `CategoryTreeNavNode[]` annotation is the compile-time half of the guard —
  // the package typecheck (`pnpm --filter @takazudo/zudo-doc typecheck`, gated
  // in b4push and CI) fails here if `slug` is ever made required again.
  const legacyTree: CategoryTreeNavNode[] = [
    {
      label: "guides",
      hasPage: true,
      href: "/docs/guides",
      children: [
        { label: "layout", hasPage: true, href: "/docs/guides/layout", children: [] },
      ],
    },
  ];

  const legacyDeps = (): CategoryTreeNavDeps =>
    makeDeps({
      buildNavTree: () => legacyTree,
      // A pre-#3218 consumer's findNode matched on its own key, not on `slug`.
      findNode: (tree, key) => tree.find((n) => n.label === key),
    });

  it("renders unversioned children, unchanged from the pre-#3218 behavior", () => {
    const result = createCategoryTreeNavWrapper(legacyDeps())({ category: "guides" });
    expect(childHrefsOf(result)).toEqual(["/docs/guides/layout"]);
  });

  it("with a version requested: hrefs stay verbatim (nothing to rebuild them from) and nothing throws", () => {
    const result = createCategoryTreeNavWrapper(legacyDeps())({
      category: "guides",
      currentVersion: "1.0",
    });
    expect(childHrefsOf(result)).toEqual(["/docs/guides/layout"]);
  });
});
