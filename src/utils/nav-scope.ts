import { settings } from "@/config/settings";
import type { NavNode } from "@/utils/docs";
export type { HeaderNavItem } from "@/config/settings";

/** Collect all categoryMatch values from headerNav, including children. */
function allCategoryMatches(): Array<{ categoryMatch: string }> {
  return settings.headerNav.flatMap((item) => {
    const matches: Array<{ categoryMatch: string }> = [];
    if (item.categoryMatch) matches.push({ categoryMatch: item.categoryMatch });
    if (item.children) {
      for (const child of item.children) {
        if (child.categoryMatch) matches.push({ categoryMatch: child.categoryMatch });
      }
    }
    return matches;
  });
}

/**
 * Given a doc's slug (e.g. "getting-started/introduction" or "claude-agents/doc-reviewer"),
 * return the categoryMatch value of the headerNav item it belongs to.
 */
export function getNavSectionForSlug(slug: string): string | undefined {
  const topCategory = slug.split("/")[0] ?? "";

  // First pass: find explicit matchers (not "!") from all items including children
  const all = allCategoryMatches();
  const explicitMatches = all.filter(
    (item) =>
      item.categoryMatch !== "!" &&
      topCategory.startsWith(item.categoryMatch),
  );
  if (explicitMatches.length > 0) {
    // Longest prefix match wins
    const best = explicitMatches.sort(
      (a, b) => b.categoryMatch.length - a.categoryMatch.length,
    )[0];
    return best.categoryMatch;
  }

  // Second pass: return the default ("!") matcher
  const defaultItem = settings.headerNav.find(
    (item) => item.categoryMatch === "!",
  );
  return defaultItem?.categoryMatch;
}

/**
 * Filter top-level NavNodes by a headerNav categoryMatch value.
 * - "!" means everything NOT claimed by explicit matchers
 * - "claude" means nodes whose slug starts with "claude"
 * - undefined means all nodes
 */
export function getNavSubtree(
  tree: NavNode[],
  categoryMatch?: string,
): NavNode[] {
  if (!categoryMatch) return tree;

  if (categoryMatch === "!") {
    const explicitPrefixes = allCategoryMatches()
      .filter((item) => item.categoryMatch !== "!")
      .map((item) => item.categoryMatch);
    return tree.filter(
      (node) => !explicitPrefixes.some((prefix) => node.slug.startsWith(prefix)),
    );
  }

  return tree.filter((node) => node.slug.startsWith(categoryMatch));
}
