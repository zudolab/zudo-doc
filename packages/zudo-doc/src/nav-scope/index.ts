// nav-scope — parameterized pure functions for filtering the nav tree
// by headerNav categoryMatch values (epic #2344, S5).
//
// The host's `src/utils/nav-scope.ts` previously read `settings.headerNav`
// at module scope. These factories receive the headerNav as an argument so
// the logic lives in the package while the host stub keeps the singleton.
//
// Pure functions — no node builtins, no host alias imports.

/** Minimal nav node shape required by nav-scope functions. */
export interface NavScopeNode {
  slug: string;
  children: NavScopeNode[];
}

/** Minimal shape of a headerNav item the nav-scope functions need. */
export interface NavScopeHeaderNavItem {
  categoryMatch?: string;
  children?: Array<{ categoryMatch?: string }>;
}

/**
 * Collect all categoryMatch strings from headerNav (including children), in order.
 *
 * Parameterized version of the host's `getCategoryOrder()` — receives the
 * headerNav array instead of reading `settings.headerNav` directly.
 */
export function getCategoryOrder(headerNav: NavScopeHeaderNavItem[]): string[] {
  return headerNav.flatMap((item) => {
    const matches: string[] = [];
    if (item.categoryMatch) matches.push(item.categoryMatch);
    if (item.children) {
      for (const child of item.children) {
        if (child.categoryMatch) matches.push(child.categoryMatch);
      }
    }
    return matches;
  });
}

/**
 * Resolve which explicit categoryMatch owns a slug's top-level category.
 *
 * A matcher `m` owns the top-level segment `m` itself and its dash
 * "satellites" (`m-*`), the same convention `groupSatelliteNodes` uses for the
 * generated `claude-md/`, `claude-skills/`, `codex-agents-md/`, … trees. `foo`
 * does not own `foo2`. When several matchers apply, the longest wins, so an
 * explicit `foo-bar` keeps `foo-bar` and `foo-bar-*` out of `foo`. `"!"` is
 * ignored; callers apply the fallback themselves.
 */
export function resolveCategoryOwner(
  slug: string,
  explicitMatches: readonly string[],
): string | undefined {
  const topCategory = slug.split("/")[0] ?? "";
  let owner: string | undefined;
  for (const cm of explicitMatches) {
    if (cm === "!" || !cm) continue;
    if (topCategory !== cm && !topCategory.startsWith(cm + "-")) continue;
    if (owner === undefined || cm.length > owner.length) owner = cm;
  }
  return owner;
}

/**
 * Given a doc's slug (e.g. "getting-started/introduction" or "guides/overview"),
 * return the categoryMatch value of the headerNav item it belongs to.
 *
 * Parameterized version of the host's `getNavSectionForSlug()` — receives the
 * headerNav array instead of reading `settings.headerNav` directly.
 */
export function getNavSectionForSlug(
  slug: string,
  headerNav: NavScopeHeaderNavItem[],
): string | undefined {
  const explicitMatch = resolveCategoryOwner(slug, getCategoryOrder(headerNav));
  if (explicitMatch !== undefined) return explicitMatch;

  // Fallback: return the default ("!") matcher
  const defaultItem = headerNav.find(
    (item) => item.categoryMatch === "!",
  );
  return defaultItem?.categoryMatch;
}

/**
 * Filter top-level NavNodes by a headerNav categoryMatch value.
 * - `"!"` means everything NOT claimed by explicit matchers
 * - `"claude"` means nodes owned by `"claude"` per `resolveCategoryOwner`
 *   (`claude`, `claude/…`, and dash satellites such as `claude-md`)
 * - `undefined` means all nodes
 *
 * Parameterized version of the host's `getNavSubtree()` — receives the
 * headerNav array instead of reading `settings.headerNav` directly.
 *
 * Generic so callers can pass their concrete node type (e.g. the host's
 * `NavNode` which extends this shape) and get back the same type without
 * an unsafe cast.
 */
export function getNavSubtree<T extends NavScopeNode>(
  tree: T[],
  categoryMatch: string | undefined,
  headerNav: NavScopeHeaderNavItem[],
): T[] {
  if (!categoryMatch) return tree;

  const explicitMatches = getCategoryOrder(headerNav);
  if (categoryMatch === "!") {
    return tree.filter((node) => resolveCategoryOwner(node.slug, explicitMatches) === undefined);
  }

  // Include the requested matcher even when the headerNav does not list it.
  const candidates = explicitMatches.includes(categoryMatch)
    ? explicitMatches
    : [...explicitMatches, categoryMatch];
  return tree.filter((node) => resolveCategoryOwner(node.slug, candidates) === categoryMatch);
}
