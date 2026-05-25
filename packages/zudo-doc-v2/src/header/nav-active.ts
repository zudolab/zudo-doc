// Pure, settings-free helpers backing the JSX <Header /> port.
//
// These exist as their own module so unit tests can exercise the active-
// path resolution logic without booting the host project's @/config or
// @/utils modules. The Header component imports from here too so the
// runtime and the tests share a single source of truth.

/** Minimal shape the active-path resolver needs from a header nav item. */
export interface NavItemLike {
  path: string;
  children?: { path: string }[];
}

/**
 * Strip the locale prefix from `pathWithoutBase` when the page is being
 * served under a non-default locale. Mirrors the inline regex inside
 * `header.astro` so the JSX port matches the legacy template's
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
  return pathWithoutBase.replace(new RegExp(`^/${lang}`), "");
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
    .filter((p) => pathForMatchValue.startsWith(p))
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
