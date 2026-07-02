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
// only resolves inside the routes plugin. Kept as a separate file from the
// view factory (`./index.tsx`) so the `node:fs` edge pulled in via
// sidebar-tree's `loadCategoryMeta` stays out of the view module's import
// graph and out of any client-island chain.

import type { RouteContext } from "../factory-context/index.js";
import type { NavSourceOptions } from "../nav-source-docs/index.js";
import type { DocNavNode, DocPageEntry } from "../doc-page-props/index.js";
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
   * Override the category-meta directory. Default: the default locale uses
   * the categoryMeta `resolveNavSource` returns; non-default locales use
   * `loadCategoryMeta(getLocaleConfig(locale).dir)` — locale-dir-ONLY.
   */
  categoryMetaDir?: string;
}

export interface HomeData {
  /** GROUPED tree — the post-`groupSatelliteNodes` output (spreads onto
   *  `HomePageViewProps.tree`). */
  tree: DocNavNode[];
  categoryOrder: string[];
  tagCount: number;
}

/**
 * Prepare the home-page nav tree / category order / tag count for `locale`.
 *
 * Branches on `locale === ctx.defaultLocale`:
 *
 * - Default locale: `resolveNavSource(locale, undefined, {})` and its
 *   returned `categoryMeta` (the merged base+locale meta).
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
    categoryMeta = resolved.categoryMeta;
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

  const tagCount = ctx.collectTags(
    navDocs.filter((d) => !d.data.category_no_page),
    (id, data) => data.slug ?? ctx.toRouteSlug(id),
  ).size;

  return { tree: grouped, categoryOrder, tagCount };
}
