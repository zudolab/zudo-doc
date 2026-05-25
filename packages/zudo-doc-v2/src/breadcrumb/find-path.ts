import type { BreadcrumbNode, SidebarNode } from "./types";

/**
 * Walk the sidebar tree and return the chain of nodes from the root
 * level down to (and including) the node whose `id` matches `targetId`.
 *
 * Returns an empty array when no node matches. Pure: never mutates the
 * input tree, never reads anything outside of it.
 *
 * Used by the breadcrumb component to derive the current page's
 * ancestry. The home/root crumb is the renderer's responsibility — this
 * helper deals strictly with the tree itself.
 */
export function findPath<T extends BreadcrumbNode = SidebarNode>(
  nodes: readonly T[],
  targetId: string,
): T[] {
  for (const node of nodes) {
    if (node.id === targetId) return [node];
    if (node.children && node.children.length > 0) {
      const sub = findPath(node.children as readonly T[], targetId);
      if (sub.length > 0) return [node, ...sub];
    }
  }
  return [];
}
