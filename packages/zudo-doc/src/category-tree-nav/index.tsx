/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// category-tree-nav — factory for the MDX <CategoryTreeNav> wrapper component
// (epic #2344, S8).
//
// The host's `pages/lib/_category-tree-nav.tsx` previously imported host singletons
// (`@/utils/docs`, `@/config/i18n`, and the host-bound `resolveNavSource`)
// directly. This factory receives those as injected dependencies so the logic
// lives in the package while the host stub keeps the singleton imports.
//
// Data-resolution steps performed before forwarding to the v2 CategoryTreeNav component:
//   1. Load docs for the active locale (defaultLocale when not passed).
//   2. Build the full nav tree with buildNavTree() + groupSatelliteNodes()
//      (category slug is passed as the grouping prefix list).
//   3. Find the target category node via findNode().
//   4. Filter to children with hasPage === true or children.length > 0.
//   5. Forward the resolved children to the v2 CategoryTreeNav component.
//
// All data access is synchronous (ADR-004 zfb content snapshot contract).
// The `lang` prop is injected by createMdxComponents() in
// pages/_mdx-components.ts so locale routes get locale-aware nav data.

import type { JSX } from "preact";
import { CategoryTreeNav as CategoryTreeNavV2 } from "../nav-indexing/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal nav node shape required by the category-tree-nav factory. */
export interface CategoryTreeNavNode {
  label: string;
  description?: string;
  href?: string;
  hasPage: boolean;
  children: CategoryTreeNavNode[];
}

/** Minimal nav source needed by the category-tree-nav factory. */
export interface CategoryTreeNavSource {
  navDocs: unknown[];
  categoryMeta: Map<string, unknown>;
}

/** Props for the CategoryTreeNavWrapper component. */
export interface CategoryTreeNavWrapperProps {
  /**
   * Slug of the category whose children should be rendered as a tree,
   * e.g. "guides" or "getting-started".
   */
  category: string;
  /**
   * Active locale. Injected via createMdxComponents() closure.
   * Defaults to defaultLocale when not provided.
   */
  lang?: string;
}

/** Injected dependencies for {@link createCategoryTreeNavWrapper}. */
export interface CategoryTreeNavDeps {
  /** Default locale code (e.g. `"en"`). */
  defaultLocale: string;
  /**
   * Resolve the identity-stable nav source for an EN/locale context.
   * Host passes `resolveNavSource` from `pages/lib/_nav-source-docs.ts`.
   */
  resolveNavSource: (
    lang: string,
    currentVersion: string | undefined,
    options?: { applyDefaultLocaleOnlyFilter?: boolean; keepUnlisted?: boolean },
  ) => CategoryTreeNavSource;
  /**
   * Build the nav tree for a locale.
   * Host passes `buildNavTree` from `@/utils/docs`.
   */
  buildNavTree: (
    docs: unknown[],
    locale: string,
    categoryMeta: Map<string, unknown>,
  ) => CategoryTreeNavNode[];
  /**
   * Group satellite nodes under target category prefixes in the nav tree.
   * Host passes `groupSatelliteNodes` from `@/utils/docs`.
   */
  groupSatelliteNodes: (tree: CategoryTreeNavNode[], prefixes: string[]) => CategoryTreeNavNode[];
  /**
   * Find a node by slug in the nav tree.
   * Host passes `findNode` from `@/utils/docs`.
   */
  findNode: (tree: CategoryTreeNavNode[], slug: string) => CategoryTreeNavNode | undefined;
}

/**
 * Create the `CategoryTreeNavWrapper` component bound to the host's nav source
 * and tree-building dependencies.
 *
 * Returns null when the category is not found or has no renderable children —
 * matching the original Astro component's guard.
 */
export function createCategoryTreeNavWrapper(
  deps: CategoryTreeNavDeps,
): (props: CategoryTreeNavWrapperProps) => JSX.Element | null {
  const { defaultLocale, resolveNavSource, buildNavTree, groupSatelliteNodes, findNode } = deps;

  function CategoryTreeNavWrapper({
    category,
    lang = defaultLocale,
  }: CategoryTreeNavWrapperProps): JSX.Element | null {
    const locale = lang;

    // No defaultLocaleOnly filter — tree nav intentionally shows all EN pages
    // (same variant as _category-nav.tsx).
    const { navDocs, categoryMeta } = resolveNavSource(locale, undefined, {
      keepUnlisted: true,
    });
    const rawTree = buildNavTree(navDocs, locale, categoryMeta);
    // groupSatelliteNodes with [category] groups satellite nodes under the
    // target category — matching the original Astro component.
    const tree = groupSatelliteNodes(rawTree, [category]);

    const categoryNode = findNode(tree, category);
    const children =
      categoryNode?.children.filter((c) => c.hasPage || c.children.length > 0) ??
      [];

    if (children.length === 0) return null;

    return <CategoryTreeNavV2 children={children} />;
  }

  return CategoryTreeNavWrapper;
}
