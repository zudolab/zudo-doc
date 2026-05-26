/**
 * Public entry for the framework-agnostic sidebar shell.
 *
 * Consumers import from `@takazudo/zudo-doc/sidebar`:
 *
 *   import {
 *     Sidebar,
 *     type SidebarProps,
 *     type SidebarNavNode,
 *     type SidebarRootMenuItem,
 *     type SidebarLocaleLink,
 *     type SidebarTreeIslandProps,
 *   } from "@takazudo/zudo-doc/sidebar";
 *
 * The shell does NOT include the SidebarTree island itself — the host
 * project's existing Preact island is plugged in via the
 * `treeComponent` prop (or rendered as `children`).
 */

export { Sidebar } from "./sidebar.js";
export type { SidebarProps } from "./sidebar.js";
export type {
  SidebarLocaleLink,
  SidebarNavNode,
  SidebarRootMenuItem,
  SidebarTreeIslandProps,
} from "./types.js";
