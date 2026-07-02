import type { SidebarNavNode } from "../sidebar/types.js";

/**
 * Filter a sidebar nav tree by a case-insensitive label match.
 *
 * When a node's own label matches the query, ALL of its descendants are kept
 * (typing a category name should reveal its whole sub-tree). When only a
 * descendant matches, the node is kept with just the matching descendants —
 * siblings with no matching descendants are dropped entirely.
 */
export function filterTree(nodes: SidebarNavNode[], query: string): SidebarNavNode[] {
  return nodes.reduce<SidebarNavNode[]>((acc, node) => {
    const matchesLabel = node.label.toLowerCase().includes(query.toLowerCase());
    const filteredChildren = node.children.length > 0
      ? filterTree(node.children, query)
      : [];

    if (matchesLabel || filteredChildren.length > 0) {
      acc.push({
        ...node,
        children: matchesLabel ? node.children : filteredChildren,
      });
    }
    return acc;
  }, []);
}
