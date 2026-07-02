import type { SidebarNavNode } from "../sidebar/types.js";

export function normalizePath(p: string): string {
  return p.replace(/\/$/, "") || "/";
}

/** Find the slug of the node whose href matches the given pathname. */
export function findActiveSlug(nodes: SidebarNavNode[], pathname: string): string | undefined {
  for (const node of nodes) {
    if (node.href && normalizePath(node.href) === pathname) return node.slug;
    const found = findActiveSlug(node.children, pathname);
    // "" is the canonical root-index slug (#1891) — a truthiness check
    // would discard a legitimate root match.
    if (found !== undefined) return found;
  }
  return undefined;
}
