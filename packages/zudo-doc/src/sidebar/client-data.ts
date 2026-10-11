import { normalizeIslandData } from "../chrome/island-data.js";
import type { SidebarNavNode, SidebarNavigationContext } from "./types.js";

/** Navigation data needed by the native sidebar islands, without server prose. */
export type SidebarClientNode = Omit<SidebarNavNode, "description" | "children"> & {
  children: SidebarClientNode[];
};

export type SidebarClientNavigation = Omit<SidebarNavigationContext, "roots"> & {
  roots: SidebarClientNode[];
};

// Exhaustive policy: new server fields require an explicit transport decision.
const nodeFields = {
  occurrenceId: true,
  slug: true,
  label: true,
  description: false,
  position: true,
  href: true,
  hasPage: true,
  children: true,
  sortOrder: true,
  collapsed: true,
  shape: true,
  noteTrayDated: true,
  noteTraySidebar: true,
  date: true,
  updated: true,
  rank: true,
} as const satisfies Record<keyof SidebarNavNode, boolean>;

/**
 * Copy navigation for SSR and hydration at an island boundary. Server builders
 * retain descriptions; custom island hosts can opt into this same projection.
 * Validate before selecting fields so discarded data cannot conceal invalid
 * transport values. Preserve the opaque scope ID and editorial topology.
 */
export function toSidebarClientData(
  nodes: SidebarNavNode[],
  navigation?: SidebarNavigationContext,
): { nodes: SidebarClientNode[]; navigation?: SidebarClientNavigation } {
  const source = normalizeIslandData({ nodes, navigation });
  function project(node: SidebarNavNode): SidebarClientNode {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(nodeFields) as Array<keyof SidebarNavNode>) {
      if (nodeFields[key] && key !== "children" && node[key] !== undefined) {
        result[key] = node[key];
      }
    }
    result.children = node.children.map(project);
    return result as SidebarClientNode;
  }
  return {
    nodes: source.nodes.map(project),
    ...(source.navigation ? {
      navigation: {
        id: source.navigation.id,
        roots: source.navigation.roots.map(project),
        parents: source.navigation.parents,
        ...(source.navigation.initialExpansion !== undefined
          ? { initialExpansion: source.navigation.initialExpansion } : {}),
        ...(source.navigation.localParentId !== undefined
          ? { localParentId: source.navigation.localParentId } : {}),
      },
    } : {}),
  };
}
