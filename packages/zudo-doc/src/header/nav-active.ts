// Pure, settings-free helpers backing the JSX <Header /> port.
//
// These exist as their own module so unit tests can exercise the active-
// path resolution logic without booting the host project's @/config or
// @/utils modules. The Header component imports from here too so the
// runtime and the tests share a single source of truth.

/** Minimal shape the active-path resolver needs from a header nav item. */
export interface NavItemLike {
  path: string;
  /**
   * The "big category" this nav entry claims (mirrors the host's
   * `getNavSectionForSlug` / sidebar `categoryMatch`). When the host knows
   * which category the current page belongs to, category matching is
   * preferred over URL-path heuristics — see `isNavItemActiveByCategory`.
   */
  categoryMatch?: string;
  children?: { path: string; categoryMatch?: string }[];
}

/**
 * Strip the locale prefix from `pathWithoutBase` when the page is being
 * served under a non-default locale. Mirrors the inline regex inside
 * `header` so the JSX port matches the legacy template's
 * active-link behaviour.
 *
 * Examples:
 *   pathForMatch("/ja/docs/intro", "ja", "en") === "/docs/intro"
 *   pathForMatch("/docs/intro",   "en", "en") === "/docs/intro"
 *   pathForMatch(null,            "ja", "en") === ""
 */
export function pathForMatch(
  pathWithoutBase: string,
  lang: string | undefined,
  defaultLocale: string,
): string {
  if (lang == null || lang === defaultLocale) return pathWithoutBase;
  // Segment boundary required: "/ja-tutorial/..." must not lose its "/ja".
  return pathWithoutBase.replace(new RegExp(`^/${lang}(?=/|$)`), "");
}

/**
 * Pick the deepest header-nav path that the current page lives under.
 *
 * The legacy template flattens parent + child paths, filters by
 * `pathForMatch.startsWith(p)`, and picks the longest match — this keeps
 * a child link active even when its parent's path is also a prefix of
 * the current page.
 *
 * Returns `undefined` when no nav entry matches; callers should treat
 * that as "no active link."
 */
/**
 * Segment-aware prefix test: nav path `/docs/guides` matches `/docs/guides`
 * and `/docs/guides/...` but NOT `/docs/guideship`.
 */
function pathMatchesNavPath(currentPath: string, navPath: string): boolean {
  if (currentPath === navPath) return true;
  const prefix = navPath.endsWith("/") ? navPath : `${navPath}/`;
  return currentPath.startsWith(prefix);
}

export function computeActiveNavPath(
  navItems: readonly NavItemLike[],
  pathForMatchValue: string,
): string | undefined {
  const allNavPaths = navItems.flatMap((item) => {
    const paths = [item.path];
    if (item.children) {
      paths.push(...item.children.map((child) => child.path));
    }
    return paths;
  });
  return allNavPaths
    .filter((p) => pathMatchesNavPath(pathForMatchValue, p))
    .sort((a, b) => b.length - a.length)[0];
}

/**
 * Active-state predicate for a top-level nav item: the item itself, or
 * any of its children, matches the active path. Mirrors the inline
 * `isNavItemActive` helper in the legacy template.
 */
export function isNavItemActive(
  item: NavItemLike,
  activeNavPath: string | undefined,
): boolean {
  if (activeNavPath === item.path) return true;
  if (item.children?.some((child) => activeNavPath === child.path)) return true;
  return false;
}

/**
 * Category-based active-state predicate. A nav entry is active when its
 * own `categoryMatch` equals the page's resolved big category
 * (`activeCategory`), or when any of its children claim that category.
 *
 * This is the authoritative "is the page under this big category?" check
 * — it mirrors how the sidebar scopes its tree (`getNavSectionForSlug`),
 * so the header highlight stays correct even when a category's page URLs
 * do not share a prefix with the nav item's `path` (the case the older
 * path-only heuristic missed). Callers prefer this over `isNavItemActive`
 * and fall back to path matching when `activeCategory` is absent (e.g.
 * home, 404, tag, and version pages, which carry no nav section).
 *
 * Works for both top-level items and child items: a child has no
 * `children` of its own, so the call collapses to a single
 * `categoryMatch` comparison.
 */
export function isNavItemActiveByCategory(
  item: NavItemLike,
  activeCategory: string | undefined,
): boolean {
  if (activeCategory == null) return false;
  // `activeCategory` is non-null here, so a plain `===` already rejects an
  // entry whose `categoryMatch` is undefined — no extra null guard needed.
  if (item.categoryMatch === activeCategory) return true;
  if (item.children?.some((child) => child.categoryMatch === activeCategory)) {
    return true;
  }
  return false;
}
