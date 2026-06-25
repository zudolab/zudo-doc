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
  const topCategory = slug.split("/")[0] ?? "";
  const all = getCategoryOrder(headerNav);

  // First pass: find explicit matchers (not "!")
  const explicitMatches = all.filter(
    (cm) => cm !== "!" && topCategory.startsWith(cm),
  );
  if (explicitMatches.length > 0) {
    // Longest prefix match wins
    return explicitMatches.sort((a, b) => b.length - a.length)[0];
  }

  // Second pass: return the default ("!") matcher
  const defaultItem = headerNav.find(
    (item) => item.categoryMatch === "!",
  );
  return defaultItem?.categoryMatch;
}

/**
 * Filter top-level NavNodes by a headerNav categoryMatch value.
 * - `"!"` means everything NOT claimed by explicit matchers
 * - `"claude"` means nodes whose slug starts with `"claude"`
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

  if (categoryMatch === "!") {
    const explicitPrefixes = getCategoryOrder(headerNav).filter((cm) => cm !== "!");
    return tree.filter(
      (node) => !explicitPrefixes.some((prefix) => node.slug.startsWith(prefix)),
    );
  }

  return tree.filter((node) => node.slug.startsWith(categoryMatch));
}
