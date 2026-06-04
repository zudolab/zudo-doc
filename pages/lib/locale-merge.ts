// Shared utility for merging locale docs with base-locale fallbacks.
//
// Used by route enumerators, nav helpers, and locale page modules to implement
// the locale-first + base-fallback merge strategy.
//
// Strategy:
//   1. Caller loads the locale and base doc arrays (via loadDocs / bridgeEntries).
//   2. mergeLocaleDocs({ baseDocs, localeDocs, ... }) builds the merged list.
//   3. Locale docs take priority; base docs fill in slugs not present in locale.
//   4. Optionally excludes base docs that are default-locale-only paths.
//   5. Optionally filters out unlisted pages (for tag enumeration).
//
// WHY caller loads, helper merges:
//   Collection naming varies per context (regular docs, versioned, locale-versioned),
//   and the bridging (loadDocs vs. bridgeEntries) also varies per call site. Keeping
//   the helper as a pure merge over pre-loaded arrays avoids encoding that logic here
//   and lets each call site retain its own load pattern.
//
// This is a zfb-only module (synchronous, uses pre-loaded collections).

import { isDefaultLocaleOnlyPath } from "@/utils/base";
import type { DocsEntry } from "@/types/docs-entry";

// ---------------------------------------------------------------------------
// mergeLocaleDocs memoization
// ---------------------------------------------------------------------------
//
// WeakMap chain: baseDocs → localeDocs → optionBits(string) → result.
// The option bits key encodes the two boolean flags so different flag
// combinations produce distinct cache entries.
//
// This memoization is effective only when the caller passes stable array
// references — i.e. when `loadDocs()` is memoized (see pages/_data.ts).
// When arrays are fresh per call, cache misses are harmless (same O(n)
// work as before).

type MergeInner = Map<string, MergeLocaleDocsResult>;
type MergeMiddle = WeakMap<DocsEntry[], MergeInner>;
const mergeLocalDocsCache = new WeakMap<DocsEntry[], MergeMiddle>();

function mergeOptionBits(
  applyDefaultLocaleOnlyFilter: boolean,
  keepUnlisted: boolean,
): string {
  return `${applyDefaultLocaleOnlyFilter ? "1" : "0"}:${keepUnlisted ? "1" : "0"}`;
}

// ---------------------------------------------------------------------------
// mergeLocaleDocs
// ---------------------------------------------------------------------------

/**
 * Options for mergeLocaleDocs.
 */
export interface MergeLocaleDocsOptions {
  /** Pre-loaded base (EN/default-locale) docs array, already draft-filtered. */
  baseDocs: DocsEntry[];
  /** Pre-loaded locale-specific docs array, already draft-filtered. */
  localeDocs: DocsEntry[];
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
}

/**
 * Result of mergeLocaleDocs.
 *
 * **Array identity:** When `baseDocs` and `localeDocs` are stable array
 * references (e.g. sourced from the memoized `loadDocs` helper), the
 * result is memoized and the same `docs` array reference is returned for
 * the same (baseDocs, localeDocs, options) combination. Callers that key
 * a WeakMap on the returned `docs` array (e.g. `buildNavTree`'s nav-tree
 * cache) will therefore hit on subsequent calls within the same build
 * snapshot.
 */
export interface MergeLocaleDocsResult {
  /**
   * Merged doc array: locale docs first, followed by base docs for slugs not
   * present in the locale collection (and not excluded by filter options).
   */
  docs: DocsEntry[];
  /**
   * Set of slugs that came from the locale collection.
   * Useful for callers that need to determine whether a page is a fallback
   * (i.e. `isFallback = !localeSlugSet.has(slug)`).
   */
  localeSlugSet: Set<string>;
}

/**
 * Merge locale docs with base-locale fallbacks.
 *
 * Locale docs take priority; base docs fill in slugs not covered by the locale
 * collection. Optionally excludes default-locale-only paths and/or unlisted pages.
 *
 * **Slug keying**: slug identity uses `d.data.slug ?? d.id`. Since `loadDocs`
 * already strips the `/index` suffix (via `stripIndexSuffix` in `_data.ts`),
 * this key is consistent across all call sites regardless of whether they
 * loaded docs via `loadDocs` or `bridgeEntries`.
 *
 * **Array identity**: when `baseDocs` and `localeDocs` are stable references
 * (from the memoized `loadDocs` helper), the result is identity-memoized and
 * the same `docs` array reference is returned for the same inputs — see
 * {@link MergeLocaleDocsResult} for details. When the inputs are fresh arrays,
 * memoization misses harmlessly and the function computes normally.
 */
export function mergeLocaleDocs(
  options: MergeLocaleDocsOptions,
): MergeLocaleDocsResult {
  const {
    baseDocs,
    localeDocs,
    applyDefaultLocaleOnlyFilter = false,
    keepUnlisted = false,
  } = options;

  // Identity memoization: WeakMap chain baseDocs → localeDocs → optionBits.
  const optBits = mergeOptionBits(applyDefaultLocaleOnlyFilter, keepUnlisted);
  let middle = mergeLocalDocsCache.get(baseDocs);
  if (!middle) {
    middle = new WeakMap<DocsEntry[], MergeInner>();
    mergeLocalDocsCache.set(baseDocs, middle);
  }
  let inner = middle.get(localeDocs);
  if (!inner) {
    inner = new Map<string, MergeLocaleDocsResult>();
    middle.set(localeDocs, inner);
  }
  const cached = inner.get(optBits);
  if (cached) return cached;

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

  if (applyDefaultLocaleOnlyFilter) {
    fallbackDocs = fallbackDocs.filter(
      (d) => !isDefaultLocaleOnlyPath(`/docs/${d.data.slug ?? d.id}`),
    );
  }

  const result: MergeLocaleDocsResult = {
    docs: [...filteredLocale, ...fallbackDocs],
    localeSlugSet,
  };
  inner.set(optBits, result);
  return result;
}

// ---------------------------------------------------------------------------
// mergeCategoryMeta
// ---------------------------------------------------------------------------

import { loadCategoryMeta } from "@/utils/docs";
import type { CategoryMeta } from "@/utils/docs";

/**
 * Merge category metadata for a locale: base metadata first, locale overrides
 * win on overlapping keys.
 *
 * This matches the category-meta merge order used in route enumerators,
 * nav helpers, and page paths() sections.
 */
export function mergeCategoryMeta(
  baseDir: string,
  localeDir: string,
): Map<string, CategoryMeta> {
  return new Map<string, CategoryMeta>([
    ...loadCategoryMeta(baseDir),
    ...loadCategoryMeta(localeDir),
  ]);
}
