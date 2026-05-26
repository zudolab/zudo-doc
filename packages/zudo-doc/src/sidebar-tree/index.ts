/**
 * Public entry for the framework-agnostic sidebar tree builder.
 *
 * Consumers import from `@takazudo/zudo-doc/sidebar-tree`:
 *
 *   import {
 *     buildSidebarTree,
 *     loadCategoryMeta,
 *     type SidebarNode,
 *   } from "@takazudo/zudo-doc/sidebar-tree";
 *
 * The builder takes a flat list of content collection entries (in either
 * Astro or zfb shape) plus a locale, and emits a recursive `SidebarNode[]`
 * suitable for rendering or for further sidebar-config processing.
 */

export {
  buildSidebarTree,
  findSidebarNode,
  flattenSidebarTree,
} from "./build-tree.js";
export { loadCategoryMeta, clearCategoryMetaCache } from "./category-meta.js";
export type {
  BuildHref,
  BuildSidebarTreeOptions,
  CategoryMeta,
  CollectionEntryLike,
  SidebarFrontmatter,
  SidebarNode,
} from "./types.js";
