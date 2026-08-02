/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// category-nav — factory for the MDX <CategoryNav> wrapper component
// (epic #2344, S8).
//
// The host's `pages/lib/_category-nav.tsx` previously imported host singletons
// (`@/utils/docs`, `@/config/i18n`, and the host-bound `resolveNavSource`)
// directly. This factory receives those as injected dependencies so the logic
// lives in the package while the host stub keeps the singleton imports.
//
// Data-resolution steps performed before forwarding to the v2 CategoryNav component:
//   1. Load docs for the active locale (or defaultLocale when not passed).
//   2. Build the nav tree with buildNavTree().
//   3. Find the target category node via findNode().
//   4. Filter to children with hasPage === true.
//   5. Forward the resolved children to the v2 CategoryNav component.
//
// All data access is synchronous (ADR-004 zfb content snapshot contract).
// The `lang` prop is injected by createMdxComponents() in
// pages/_mdx-components.ts so locale routes get locale-aware nav data.

import type { JSX } from "preact";
import { CategoryNav as CategoryNavV2 } from "../nav-indexing/index.js";
import type { NavNode as V2NavNode } from "../nav-indexing/types.js";
import { remapVersionedHrefs } from "../nav-data-prep/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal nav node shape required by the category-nav factory. */
export interface CategoryNavNode {
  /** Content slug — required by remapVersionedHrefs to rebuild a versioned href. */
  slug: string;
  label: string;
  description?: string;
  href?: string;
  hasPage: boolean;
  children: CategoryNavNode[];
}

/** Minimal nav source needed by the category-nav factory. */
export interface CategoryNavSource {
  navDocs: unknown[];
  categoryMeta: Map<string, unknown>;
}

/** Props for the CategoryNavWrapper component. */
export interface CategoryNavWrapperProps {
  /**
   * Slug of the category whose immediate children should be listed, e.g.
   * "getting-started" or "guides/layout-demos".
   */
  category?: string;
  /**
   * Explicit list of top-level category slugs to render as cards. Use this
   * when the target categories are not children of a single parent node in
   * the nav tree (e.g. "claude-md", "claude-skills" are top-level siblings
   * of "claude", not children). Each slug is resolved to its nav node; nodes
   * not found in the tree are silently skipped.
   *
   * A `category_no_page` category has no route of its own, so its card links to
   * the first routed descendant page (via firstRoutedHref); categories with no
   * reachable page are skipped rather than emitting a dead link.
   */
  categories?: string[];
  /**
   * Active locale. Injected via createMdxComponents() closure.
   * Defaults to defaultLocale when not provided.
   */
  lang?: string;
  /**
   * Active version slug for a `/v/{version}` route. Injected via
   * createMdxComponents() closure alongside `lang` (#3218). When set, the nav
   * source resolves the version's doc collection and emitted hrefs are
   * remapped to their versioned form; omitted (latest/unversioned pages)
   * leaves behavior unchanged.
   */
  currentVersion?: string;
  /** Optional extra CSS classes forwarded to the <nav> element. */
  class?: string;
}

/** Injected dependencies for {@link createCategoryNavWrapper}. */
export interface CategoryNavDeps {
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
  ) => CategoryNavSource;
  /**
   * Build the nav tree for a locale.
   * Host passes `buildNavTree` from `@/utils/docs`.
   */
  buildNavTree: (
    docs: unknown[],
    locale: string,
    categoryMeta: Map<string, unknown>,
  ) => CategoryNavNode[];
  /**
   * Find a node by slug in the nav tree.
   * Host passes `findNode` from `@/utils/docs`.
   */
  findNode: (tree: CategoryNavNode[], slug: string) => CategoryNavNode | undefined;
  /**
   * Recursively find the first href in a node's subtree.
   * Host passes `firstRoutedHref` from `@/utils/docs`.
   */
  firstRoutedHref: (node: CategoryNavNode) => string | undefined;
  /**
   * Build a versioned docs URL: `versionedDocsUrl(slug, versionSlug, lang)`.
   * Host passes `ctx.versionedDocsUrl`. Used to remap the resolved tree's
   * hrefs into their versioned form when `currentVersion` is set (#3218) —
   * mirrors the sidebar's `buildSidebarNodes` two-step in `chrome/derive.tsx`.
   *
   * Optional — `./category-nav` is a documented frozen-1.0 public subpath
   * (`packages/zudo-doc/CLAUDE.md`/`API.md`), so a pre-#3218 caller that hand-
   * constructs `CategoryNavDeps` without this field must keep compiling.
   * Omitting it while passing `currentVersion` leaves hrefs unversioned (a
   * loud dev warning is emitted) rather than throwing.
   */
  versionedDocsUrl?: (slug: string, versionSlug: string, lang: string) => string;
}

/**
 * Create the `CategoryNavWrapper` component bound to the host's nav source
 * and tree-building dependencies.
 *
 * Supports two modes:
 * - `category`: resolves immediate children of a single category node.
 * - `categories`: resolves an explicit list of top-level slugs as cards.
 *   Use this when the target categories are siblings in the nav tree rather
 *   than children of a common parent (e.g. claude-md / claude-skills are
 *   top-level peers of claude, not children of it). A noPage category card
 *   links to its first routed descendant page (it has no route of its own).
 *
 * Returns null when no visible children are resolved.
 */
export function createCategoryNavWrapper(
  deps: CategoryNavDeps,
): (props: CategoryNavWrapperProps) => JSX.Element | null {
  const { defaultLocale, resolveNavSource, buildNavTree, findNode, firstRoutedHref, versionedDocsUrl } =
    deps;

  function CategoryNavWrapper({
    category,
    categories,
    lang = defaultLocale,
    currentVersion,
    class: className,
  }: CategoryNavWrapperProps): JSX.Element | null {
    const locale = lang;

    // No defaultLocaleOnly filter — category cards intentionally show all EN
    // pages even if they match defaultLocaleOnlyPrefixes (the option signature in
    // resolveNavSource keeps this variant from colliding with the sidebar's).
    const { navDocs, categoryMeta } = resolveNavSource(locale, currentVersion, {
      keepUnlisted: true,
    });
    const rawTree = buildNavTree(navDocs, locale, categoryMeta);
    // Two-step version threading mirroring buildSidebarNodes (chrome/derive.tsx):
    // version-scoped data source above, then remap the resolved hrefs into
    // their versioned form (#3218). Unversioned pages: tree === rawTree.
    let tree = rawTree;
    if (currentVersion) {
      if (versionedDocsUrl) {
        tree = remapVersionedHrefs(rawTree, currentVersion, locale, versionedDocsUrl);
      } else {
        // versionedDocsUrl is optional (back-compat for pre-#3218 CategoryNavDeps
        // callers, see the field's doc comment) — silently leaving hrefs
        // unversioned would hide the misconfiguration, so warn loudly.
        console.warn(
          "[zudo-doc] CategoryNavWrapper: currentVersion is set but CategoryNavDeps.versionedDocsUrl " +
            "was not provided — nav card hrefs will NOT be remapped into the version.",
        );
      }
    }

    let children: V2NavNode[];

    if (categories !== undefined) {
      // Explicit slug list mode: resolve each slug to its nav node and build a
      // card for it. A `category_no_page` category has no route of its own
      // (collectAutoIndexNodes skips noPage nodes), so its card links to the
      // first routed descendant page; categories with no reachable page are
      // skipped rather than emitting a dead link.
      children = categories
        .map((slug): V2NavNode | null => {
          const node = findNode(tree, slug);
          if (!node) return null;
          const href = node.href ?? firstRoutedHref(node);
          if (!href) return null;
          return {
            label: node.label,
            description: node.description,
            href,
            hasPage: true,
            children: [],
          };
        })
        .filter((n): n is V2NavNode => n !== null);
    } else if (category !== undefined) {
      const categoryNode = findNode(tree, category);
      children = (categoryNode?.children.filter((c) => c.hasPage) ?? []) as V2NavNode[];
    } else {
      return null;
    }

    if (children.length === 0) return null;

    return <CategoryNavV2 children={children} class={className} />;
  }

  return CategoryNavWrapper;
}
