// locale-merge — pure locale-merge utility for combining locale doc arrays
// with base-locale fallbacks (epic #2344, S6).
//
// Moved from the showcase's `pages/lib/locale-merge.ts` into the shared
// package. Previously this imported `isDefaultLocaleOnlyPath` from the host's
// `@/utils/base` and `DocsEntry` / `CategoryMeta` from `@/types/docs-entry` /
// `@/utils/docs` — host-alias imports that would not resolve in downstream
// consumers. The package version:
//   - Makes `DocsEntry` generic (`T extends { id: string; data: { slug?: string; unlisted?: boolean } }`)
//   - Accepts `isDefaultLocaleOnlyPath` as an injected parameter in options
//   - Inlines `mergeCategoryMeta` as a pure helper (no `loadCategoryMeta` call)
//
// WHY CALLER LOADS, HELPER MERGES (unchanged from original):
//   Collection naming varies per context (regular docs, versioned, locale-versioned),
//   and the bridging also varies per call site. Keeping the helper as a pure
//   merge over pre-loaded arrays avoids encoding that logic here.
//
// This is a pure module — no node builtins, no `@/` imports, safe in the
// config eval graph and in client islands.

// ---------------------------------------------------------------------------
// Minimal structural DocsEntry shape the merge functions need
// ---------------------------------------------------------------------------

/**
 * Minimal structural interface for a docs entry.
 *
 * Structurally compatible with the host's `DocsEntry` from
 * `@/types/docs-entry`. Callers pass their concrete entry arrays and
 * TypeScript's structural typing ensures compatibility.
 */
export interface MergeDocsEntry {
  id: string;
  data: {
    slug?: string;
    unlisted?: boolean;
    [key: string]: unknown;
  };
}

// ---------------------------------------------------------------------------
// mergeLocaleDocs
// ---------------------------------------------------------------------------

/**
 * Options for mergeLocaleDocs.
 *
 * The generic parameter `T` allows callers to pass arrays of a concrete entry
 * subtype and get back results of the same subtype, eliminating `as unknown as`
 * casts at call sites.
 */
export interface MergeLocaleDocsOptions<T extends MergeDocsEntry = MergeDocsEntry> {
  /** Pre-loaded base (EN/default-locale) docs array, already draft-filtered. */
  baseDocs: T[];
  /** Pre-loaded locale-specific docs array, already draft-filtered. */
  localeDocs: T[];
  /**
   * When true, base docs whose path matches a `defaultLocaleOnlyPrefixes`
   * entry are excluded from the merge result. This matches the behavior of the
   * inline copies in route-enumerators, nav helpers, and page paths() sections.
   *
   * Pass true for any call site that enumerates routes or builds nav trees for
   * non-default locales (where showing a default-locale-only page to a locale
   * user would be incorrect). Pass false (or omit) for call sites where the
   * filtered paths are harmless — e.g. category nav cards, taglist columns.
   *
   * @default false
   */
  applyDefaultLocaleOnlyFilter?: boolean;
  /**
   * Controls whether `unlisted: true` docs survive the merge.
   *
   * - `true`  — unlisted docs are RETAINED (locale + base). Route/sitemap
   *             enumeration uses this: unlisted pages have real HTML files, so
   *             they must be built; nav callers rely on `isNavVisible`
   *             downstream to hide them from the tree.
   * - `false` (default) — unlisted docs are DROPPED from both locale and base.
   *             Tag aggregation uses this so hidden pages don't contribute tags.
   *
   * @default false
   */
  keepUnlisted?: boolean;
  /**
   * Host-injected predicate: returns true when a path should be excluded from
   * the non-default-locale merge (i.e. it belongs to the default locale only).
   *
   * Only called when `applyDefaultLocaleOnlyFilter` is true. The host stub
   * passes `isDefaultLocaleOnlyPath` from `@/utils/base`.
   *
   * When omitted (or when `applyDefaultLocaleOnlyFilter` is false), no path
   * filtering is applied.
   *
   * Example: host passes `(path) => isDefaultLocaleOnlyPath(path)` where
   * `isDefaultLocaleOnlyPath` is from `src/utils/base.ts`.
   */
  isDefaultLocaleOnlyPath?: (path: string) => boolean;
}

/**
 * Result of mergeLocaleDocs.
 *
 * **Array identity:** Each call returns a fresh array — no module-level
 * memoization is applied. If a caller keys a cache on the docs array identity
 * (e.g. a nav-tree cache), it should memoize the result itself rather than
 * relying on reference stability from this helper.
 *
 * This contract is intentionally unchanged from the original. The
 * identity-stable layer for nav-source arrays lives ABOVE this helper:
 * `pages/lib/_nav-source-docs.ts` memoizes the merge result on the
 * snapshot-anchored input arrays + option signature (see
 * `pages/lib/_nav-source-cache.ts`), so `mergeLocaleDocs` itself stays a pure,
 * memo-free function (#1902).
 *
 * The generic `T` mirrors the parameter on {@link MergeLocaleDocsOptions} so
 * the returned `docs` array preserves the subtype of the input arrays.
 */
export interface MergeLocaleDocsResult<T extends MergeDocsEntry = MergeDocsEntry> {
  /**
   * Merged doc array: locale docs first, followed by base docs for slugs not
   * present in the locale collection (and not excluded by filter options).
   */
  docs: T[];
  /**
   * Set of slugs that came from the locale collection.
   * Useful for callers that need to determine whether a page is a fallback
   * (i.e. `isFallback = !localeSlugSet.has(slug)`).
   */
  localeSlugSet: ReadonlySet<string>;
}

/**
 * Merge locale docs with base-locale fallbacks.
 *
 * Locale docs take priority; base docs fill in slugs not covered by the locale
 * collection. Optionally excludes default-locale-only paths and/or unlisted pages.
 *
 * **Slug keying**: slug identity uses `d.data.slug ?? d.id`. Since `loadDocs`
 * already strips the `/index` suffix (via `stripIndexSuffix` in `pages/_data.ts`),
 * this key is consistent across all call sites regardless of whether they
 * loaded docs via `loadDocs` or `bridgeEntries`.
 *
 * **Array identity**: returns a fresh array on each call — see
 * {@link MergeLocaleDocsResult} for caching guidance.
 */
export function mergeLocaleDocs<T extends MergeDocsEntry = MergeDocsEntry>(
  options: MergeLocaleDocsOptions<T>,
): MergeLocaleDocsResult<T> {
  const {
    baseDocs,
    localeDocs,
    applyDefaultLocaleOnlyFilter = false,
    keepUnlisted = false,
    isDefaultLocaleOnlyPath,
  } = options;

  const filteredLocale = keepUnlisted
    ? localeDocs
    : localeDocs.filter((d) => !d.data.unlisted);

  const filteredBase = keepUnlisted
    ? baseDocs
    : baseDocs.filter((d) => !d.data.unlisted);

  const localeSlugSet = new Set(filteredLocale.map((d) => d.data.slug ?? d.id));

  let fallbackDocs = filteredBase.filter(
    (d) => !localeSlugSet.has(d.data.slug ?? d.id),
  );

  if (applyDefaultLocaleOnlyFilter && isDefaultLocaleOnlyPath) {
    fallbackDocs = fallbackDocs.filter(
      (d) => !isDefaultLocaleOnlyPath(`/docs/${d.data.slug ?? d.id}`),
    );
  }

  return {
    docs: [...filteredLocale, ...fallbackDocs],
    localeSlugSet,
  };
}
