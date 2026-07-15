// doc-route-entries — shared, memoized route-entry builder for the 4 doc
// catch-all routes (epic #2344, S6).
//
// Moved from the showcase's `pages/lib/_doc-route-entries.ts` into the shared
// package. Previously this imported host utilities (`@/utils/docs`,
// `@/utils/nav-scope`, the package slug helpers, `@/config/i18n`) directly — imports
// that would not resolve in downstream consumers. The package version accepts
// all host-specific functions via injected context through
// `createDocRouteEntries(ctx)`.
//
// MEMOIZATION: the result is memoized with the #1902 WeakMap pattern
// (memoizeDerived keyed on the identity-stable `source.docs` array + a
// per-route signature), so the expensive per-entry work — extractHeadings,
// buildBreadcrumbs, prev/next resolution — runs ONCE per entry per build, not
// once per entry per page (zfb re-invokes paths() once per built page).

import type { DocPageEntry, DocNavNode, AutoIndexNode, DocPageBaseProps } from "../doc-page-props/index.js";
import type { NavSourceDocs } from "../nav-source-docs/index.js";
import { memoizeDerived } from "../nav-source-cache/index.js";
import type { BreadcrumbItem } from "../breadcrumb/types.js";
import type { HeadingItem } from "../extract-headings/index.js";
import type { CategoryMeta } from "../sidebar-tree/index.js";
import { buildBreadcrumbs as buildBreadcrumbsImpl } from "../routes/_docs-helpers.js";
import {
  resolveDocPrevNext,
  flattenSubtree,
  rewriteNavHref,
  remapNavChildHrefs,
} from "../doc-route-paths/index.js";

export type { DocPageEntry, DocNavNode, AutoIndexNode, DocPageBaseProps, NavSourceDocs };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One enumerated doc route: a content entry or an auto-generated category
 *  index, with all per-page derived data pre-computed. */
export interface DocRouteEntry {
  /** Canonical route slug ("" for the docs root index — #1891). */
  slug: string;
  /** Optional-catchall params array — `toSlugParams(slug)` ([] for the root). */
  slugParams: string[];
  /**
   * True when the entry came from the base collection rather than the locale
   * collection (`!localeSlugSet.has(slug)`). Only meaningful on routes whose
   * nav source performs a locale merge — routes without one (default-locale /
   * versioned-EN, where `localeSlugSet` is empty) must ignore this field.
   * Always false for autoIndex items.
   */
  isFallback: boolean;
  /** Shared page props (kind/entry/autoIndex/breadcrumbs/prev/next/headings). */
  props: DocPageBaseProps;
}

export interface BuildDocRouteEntriesArgs {
  /** Identity-stable nav source for this route's (locale, version) context. */
  source: NavSourceDocs;
  /** Active locale for nav-tree labels and breadcrumbs. */
  locale: string;
  /**
   * Unique memo signature for this route context. Each route file passes its
   * own prefix plus the loop variables (version slug / locale), e.g.
   * "docs;en", "locale-docs;ja", "v-docs;1.0", "v-locale-docs;1.0;ja" —
   * call sites that share a docs array identity must never collide on a key.
   */
  routeSig: string;
  /** Versioned URL closure bound to the route's version (+ locale). Presence
   *  switches the versioned behaviors (breadcrumbs, prev/next, child hrefs). */
  urlFor?: (slug: string) => string;
}

// ---------------------------------------------------------------------------
// Injected context for createDocRouteEntries
// ---------------------------------------------------------------------------

// BreadcrumbItem and HeadingItem are imported from the package's own intra-package
// paths above (breadcrumb/types.js and extract-headings/index.js) — no local
// re-declarations needed.
export type { BreadcrumbItem, HeadingItem };

/**
 * Context slice `createDocRouteEntries` derives its bag from (epic Collapse
 * Wiring Shells #2420, FACTORIES #2424 — breaking signature). STRUCTURAL SUBSET
 * of the unified `RouteContext`/`ChromeContext` — the nav-tree builder is
 * reconstructed by binding the context's 4-arg `buildNavTree` to `docsUrl`, and
 * the breadcrumb trail by binding the package `buildBreadcrumbs` to the
 * locale-prefixed `withBase` base, exactly as the pre-collapse wiring did.
 */
export interface DocRouteEntriesContext {
  /** Default locale code (drives the breadcrumb base-prefix selection). */
  defaultLocale: string;
  /** Build the nav tree for a locale (4-arg form with an explicit href builder). */
  buildNavTree: (
    docs: DocPageEntry[],
    locale: string,
    categoryMeta: Map<string, CategoryMeta> | undefined,
    buildHref: (slug: string, locale: string) => string,
  ) => DocNavNode[];
  /** Build a docs URL for the given slug and locale. */
  docsUrl: (slug: string, locale?: string) => string;
  /** Prefix a path with the configured base directory. */
  withBase: (path: string) => string;
  /** Collect all auto-generated index nodes (categories without index.mdx). */
  collectAutoIndexNodes: (tree: DocNavNode[]) => AutoIndexNode[];
  /** Determine the nav section (categoryMatch) for a slug. */
  getNavSectionForSlug: (slug: string) => string | undefined;
  /** Filter top-level nav nodes by a categoryMatch value. */
  getNavSubtree: (tree: DocNavNode[], categoryMatch?: string) => DocNavNode[];
  /** Convert a content entry slug to a canonical route slug. */
  toRouteSlug: (entrySlug: string) => string;
  /** Convert a canonical route slug to an optional-catchall params array. */
  toSlugParams: (slug: string) => string[];
  /** Extract headings from a raw MDX body (bound to settings depth/strategy). */
  extractHeadings: (body: string) => HeadingItem[];
}

// ---------------------------------------------------------------------------
// createDocRouteEntries factory
// ---------------------------------------------------------------------------

/**
 * Result of `createDocRouteEntries`. Contains the `buildDocRouteEntries`
 * function bound to the injected context.
 */
export interface DocRouteEntriesAPI {
  /**
   * Enumerate all doc routes for one (locale, version) context, with per-entry
   * derived data pre-computed. Memoized per build on the identity-stable
   * `source.docs` array.
   */
  buildDocRouteEntries: (args: BuildDocRouteEntriesArgs) => DocRouteEntry[];
}

/**
 * Create the `buildDocRouteEntries` function bound to the host's injected
 * context.
 *
 * @example
 * ```ts
 * // pages/lib/_doc-route-entries.ts (thin stub)
 * import { createDocRouteEntries } from "@takazudo/zudo-doc/doc-route-entries";
 * import { buildNavTree, buildBreadcrumbs, collectAutoIndexNodes } from "@/utils/docs";
 * import { getNavSectionForSlug, getNavSubtree } from "@/utils/nav-scope";
 * import { toRouteSlug, toSlugParams } from "@takazudo/zudo-doc/slug";
 * import { extractHeadings } from "./_extract-headings";
 *
 * export const { buildDocRouteEntries } = createDocRouteEntries(routeContext);
 * export type { DocRouteEntry, BuildDocRouteEntriesArgs };
 * ```
 */
export function createDocRouteEntries(
  ctx: DocRouteEntriesContext,
): DocRouteEntriesAPI {
  // Derive the old narrow bag from the unified context: bind the 4-arg
  // `buildNavTree` to `docsUrl` for the 3-arg form the body uses, and bind the
  // package `buildBreadcrumbs` to the locale-prefixed `withBase` base.
  const defaultLocale = ctx.defaultLocale;
  const buildNavTree = (
    docs: DocPageEntry[],
    locale: string,
    categoryMeta: Map<string, CategoryMeta>,
  ): DocNavNode[] =>
    ctx.buildNavTree(docs, locale, categoryMeta, (slug, loc) => ctx.docsUrl(slug, loc));
  const buildBreadcrumbs = (
    tree: DocNavNode[],
    slug: string,
    locale: string,
    urlFor?: (slug: string) => string,
  ): BreadcrumbItem[] =>
    buildBreadcrumbsImpl(
      tree,
      slug,
      locale === defaultLocale ? ctx.withBase("/") : ctx.withBase(`/${locale}/`),
      urlFor,
    );
  const collectAutoIndexNodes = ctx.collectAutoIndexNodes;
  const getNavSectionForSlug = ctx.getNavSectionForSlug;
  const getNavSubtree = ctx.getNavSubtree;
  const toRouteSlug = ctx.toRouteSlug;
  const toSlugParams = ctx.toSlugParams;
  const extractHeadings = ctx.extractHeadings;

  function buildDocRouteEntries(args: BuildDocRouteEntriesArgs): DocRouteEntry[] {
    const { source, locale, routeSig, urlFor } = args;

    return memoizeDerived([source.docs], `docRouteEntries;${routeSig}`, () => {
      const { docs, navDocs, categoryMeta, localeSlugSet } = source;

      // Nav docs: exclude unlisted (for sidebar/prev-next) but keep for breadcrumbs
      const tree = buildNavTree(navDocs, locale, categoryMeta);
      // Breadcrumb tree: latest routes use the full tree (including unlisted)
      // for accurate crumbs; versioned routes resolve crumbs against the nav
      // tree itself (#1916 #1).
      const breadcrumbTree = urlFor
        ? tree
        : buildNavTree(docs, locale, categoryMeta);

      const result: DocRouteEntry[] = [];

      // Regular doc pages
      for (const entry of docs) {
        // A `category_no_page` index.mdx carries category metadata only — keep
        // it in the nav tree but emit NO route for it.
        if (entry.data.category_no_page === true) continue;

        const slug = entry.data.slug ?? toRouteSlug(entry.slug);
        const navSection = getNavSectionForSlug(slug);
        const subtree = getNavSubtree(tree, navSection);

        const { prev: prevNode, next: nextNode } = resolveDocPrevNext(
          tree,
          flattenSubtree(subtree),
          slug,
          entry.data as { pagination_prev?: string | null; pagination_next?: string | null },
        );

        result.push({
          slug,
          slugParams: toSlugParams(slug),
          isFallback: !localeSlugSet.has(slug),
          props: {
            kind: "entry",
            entry,
            breadcrumbs: buildBreadcrumbs(breadcrumbTree, slug, locale, urlFor),
            prev: rewriteNavHref(prevNode, urlFor),
            next: rewriteNavHref(nextNode, urlFor),
            headings: extractHeadings(entry.body ?? ""),
          },
        });
      }

      // Auto-generated index pages for categories without index.mdx
      for (const node of collectAutoIndexNodes(tree)) {
        result.push({
          slug: node.slug,
          slugParams: toSlugParams(node.slug),
          isFallback: false,
          props: {
            kind: "autoIndex",
            autoIndex: urlFor
              ? {
                  ...node,
                  children: remapNavChildHrefs(node.children, urlFor) as DocNavNode[],
                }
              : node,
            breadcrumbs: buildBreadcrumbs(breadcrumbTree, node.slug, locale, urlFor),
            prev: null,
            next: null,
            headings: [],
          },
        });
      }

      return result;
    });
  }

  return { buildDocRouteEntries };
}
