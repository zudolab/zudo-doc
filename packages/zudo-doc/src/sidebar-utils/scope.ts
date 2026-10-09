import type { SidebarNavNode, SidebarNavigationContext } from "../sidebar/types.js";

export const SIDEBAR_FOREST_SCOPE = "@forest";
export function indexSidebarOccurrences(roots: SidebarNavNode[]): Map<string, SidebarNavNode> {
  const result = new Map<string, SidebarNavNode>();
  const visit = (nodes: SidebarNavNode[]) => nodes.forEach((node) => {
    if (node.occurrenceId) result.set(node.occurrenceId, node);
    visit(node.children);
  });
  visit(roots);
  return result;
}

export function sidebarScopeNodes(context: SidebarNavigationContext, baseline: SidebarNavNode[], selected: string | null): SidebarNavNode[] {
  if (selected === null) return baseline;
  if (selected === SIDEBAR_FOREST_SCOPE) return context.roots;
  const node = indexSidebarOccurrences(context.roots).get(selected);
  return node ? [node] : baseline;
}

/** Only an actual shared parent can enclose a configured forest. */
export function broaderSidebarScope(context: SidebarNavigationContext, baseline: SidebarNavNode[], selected: string | null): string | null {
  if (selected === SIDEBAR_FOREST_SCOPE) return null;
  if (selected !== null) return context.parents[selected] ?? SIDEBAR_FOREST_SCOPE;
  if (!baseline.length) return null;
  const parents = baseline.map((node) => node.occurrenceId ? context.parents[node.occurrenceId] : undefined);
  if (parents.some((parent) => parent === undefined || parent !== parents[0])) return context.localParentId ?? null;
  if (parents[0]) return parents[0];
  const rootIds = context.roots.map((node) => node.occurrenceId);
  return baseline.length === rootIds.length && baseline.every((node, i) => node.occurrenceId === rootIds[i]) ? null : SIDEBAR_FOREST_SCOPE;
}

/** On navigation, widen only to the nearest common editorial ancestor. */
export function reconcileSidebarScope(context: SidebarNavigationContext, baseline: SidebarNavNode[], selected: string | null, slug?: string): string | null {
  if (selected === null || slug === undefined) return selected;
  const index = indexSidebarOccurrences(context.roots);
  if (selected !== SIDEBAR_FOREST_SCOPE && !index.has(selected)) return null;
  const contains = (nodes: SidebarNavNode[]): boolean => nodes.some((node) => node.slug === slug || contains(node.children));
  if (!contains(context.roots)) return null;
  let candidate: string | null = selected;
  while (candidate !== null) {
    if (contains(sidebarScopeNodes(context, baseline, candidate))) return candidate;
    candidate = broaderSidebarScope(context, baseline, candidate);
  }
  return null;
}
