// prepare-home-data — the shared home-page DATA-PREP sequence (epic #2499,
// #2519; reverses the S3 #2502 "stay HERE, not in the shared factory" call
// per #2508 — that decision is superseded, this file is the shared factory).
//
// resolveNavSource → categoryMeta selection → buildNavTree → getCategoryOrder
// → groupSatelliteNodes → collectTags/tagCount was copied across six files in
// two shapes (default-locale / locale-prefixed). This factory absorbs the
// whole sequence, including the locale-config guard, so each of the six
// adapters is left with only its own routing concern (frontmatter, paths(),
// ctx source, `extras`).
//
// `ctx` is a PARAMETER, never imported from `routes/_context.js` — that shim
// re-exports a payload pulled from `virtual:zudo-doc-route-context`, which
// only resolves inside the routes plugin. This lives in its own file (not in
// the `./index.tsx` view factory) so the view-factory FILE itself carries no
// `node:fs` edge: a module importing `createHomePageView` from `./index.tsx`
// by path does not pull in sidebar-tree's `loadCategoryMeta`. The `./index.tsx`
// barrel DOES re-export `prepareHomeData`, so a barrel importer's graph does
// gain the static `node:fs` edge — that is acceptable because the barrel is a
// server-side-only entry (route/page rendering), and `loadCategoryMeta`
// degrades gracefully under zfb's SSG runtime `node:fs` stub.

import type { RouteContext } from "../factory-context/index.js";
import type { NavSourceOptions } from "../nav-source-docs/index.js";
import type { DocNavNode, DocPageEntry } from "../doc-page-props/index.js";
import type { TagItem } from "../nav-indexing/types.js";
import { loadCategoryMeta, type CategoryMeta } from "../sidebar-tree/index.js";

/** Default nav-source filter for non-default locales (locale-first merge with
 *  EN fallback, unlisted docs retained — matches the old per-route inline
 *  options object exactly). */
const LOCALE_NAV_SOURCE_OPTIONS: NavSourceOptions = {
  applyDefaultLocaleOnlyFilter: true,
  keepUnlisted: true,
};

export interface PrepareHomeDataOptions {
  /**
   * Override nav-source filtering. Default: `{}` for the default locale;
   * `{ applyDefaultLocaleOnlyFilter: true, keepUnlisted: true }` otherwise.
   */
  navSourceOptions?: NavSourceOptions;
  /**
   * Override the category-meta directory. When set, category meta is loaded via
   * `loadCategoryMeta(categoryMetaDir)` on BOTH branches — replacing the default
   * locale's merged `resolveNavSource` categoryMeta and the non-default locale's
   * `loadCategoryMeta(getLocaleConfig(locale).dir)`. When unset, the default
   * locale uses the categoryMeta `resolveNavSource` returns and non-default
   * locales use `loadCategoryMeta(cfg.dir)` — locale-dir-ONLY.
   */
  categoryMetaDir?: string;
}

export interface HomeData {
  /** GROUPED tree — the post-`groupSatelliteNodes` output (spreads onto
   *  `HomePageViewProps.tree`). */
  tree: DocNavNode[];
  categoryOrder: string[];
  /** Alphabetically-sorted tag list (tag + doc count + pre-resolved,
   *  locale-prefixed href) for the home "Tags" section — spreads onto
   *  `HomePageViewProps.tags`. Empty when no tags exist for the locale. */
  tags: TagItem[];
}

/**
 * Prepare the home-page nav tree / category order / tag count for `locale`.
 *
 * Branches on `locale === ctx.defaultLocale`:
 *
 * - Default locale: `resolveNavSource(locale, undefined, {})` and its
 *   returned `categoryMeta` (the merged base+locale meta) — unless
 *   `options.categoryMetaDir` is set, in which case that dir is loaded via
 *   `loadCategoryMeta` instead.
 * - Non-default locale: requires `ctx.getLocaleConfig(locale)` — throws if
 *   the locale isn't configured, absorbing the duplicated route/page guard —
 *   then resolves nav source with the locale-home filter and reads category
 *   meta from the locale dir ONLY, `loadCategoryMeta(cfg.dir)`. This is
 *   deliberately NOT the merged base+locale categoryMeta `resolveNavSource`
 *   returns: locale home pages historically never merged in base meta (unlike
 *   the locale doc route), and that exact behavior is preserved here — do not
 *   "fix" it to use the merged meta, that would silently change sidebar-grid
 *   labels/positions.
 */
export function prepareHomeData(
  ctx: RouteContext,
  locale: string,
  options?: PrepareHomeDataOptions,
): HomeData {
  let navDocs: DocPageEntry[];
  let categoryMeta: Map<string, CategoryMeta>;

  if (locale === ctx.defaultLocale) {
    const resolved = ctx.resolveNavSource(locale, undefined, options?.navSourceOptions ?? {});
    navDocs = resolved.navDocs;
    categoryMeta = options?.categoryMetaDir
      ? loadCategoryMeta(options.categoryMetaDir)
      : resolved.categoryMeta;
  } else {
    const cfg = ctx.getLocaleConfig(locale);
    if (!cfg) {
      throw new Error(`prepareHomeData: locale "${locale}" is not configured in settings.locales`);
    }
    const resolved = ctx.resolveNavSource(
      locale,
      undefined,
      options?.navSourceOptions ?? LOCALE_NAV_SOURCE_OPTIONS,
    );
    navDocs = resolved.navDocs;
    categoryMeta = loadCategoryMeta(options?.categoryMetaDir ?? cfg.dir);
  }

  const tree = ctx.buildNavTree(navDocs, locale, categoryMeta, (slug, loc) => ctx.docsUrl(slug, loc));
  const categoryOrder = ctx.getCategoryOrder();
  const grouped = ctx.groupSatelliteNodes(tree, categoryOrder);

  const tagMap = ctx.collectTags(
    navDocs.filter((d) => !d.data.category_no_page),
    (entrySlug, data) => data.slug ?? ctx.toRouteSlug(entrySlug),
  );
  // Sorted alphabetically (page-locale collation) with pre-resolved,
  // locale-prefixed hrefs — mirrors the /docs/tags index page's TagItem[]
  // construction (tag-pages/index.tsx) so the home chips link to the exact
  // same targets.
  const tagPrefix = locale === ctx.defaultLocale ? "" : `/${locale}`;
  const tags: TagItem[] = [...tagMap.values()]
    .sort((a, b) => a.tag.localeCompare(b.tag, locale))
    .map((info) => ({
      tag: info.tag,
      count: info.count,
      // Tag segment URL-encoded — href sites only; route params stay raw.
      href: ctx.withBase(`${tagPrefix}/docs/tags/${encodeURIComponent(info.tag)}`),
    }));

  return { tree: grouped, categoryOrder, tags };
}
