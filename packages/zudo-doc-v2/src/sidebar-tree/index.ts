/**
 * Public entry for the framework-agnostic sidebar tree builder.
 *
 * Consumers import from `@zudo-doc/zudo-doc-v2/sidebar-tree`:
 *
 *   import {
 *     buildSidebarTree,
 *     loadCategoryMeta,
 *     type SidebarNode,
 *   } from "@zudo-doc/zudo-doc-v2/sidebar-tree";
 *
 * The builder takes a flat list of content collection entries (in either
 * Astro or zfb shape) plus a locale, and emits a recursive `SidebarNode[]`
 * suitable for rendering or for further sidebar-config processing.
 */

export {
  buildSidebarTree,
  findSidebarNode,
  flattenSidebarTree,
} from "./build-tree.ts";
export { loadCategoryMeta, clearCategoryMetaCache } from "./category-meta.ts";
export type {
  BuildHref,
  BuildSidebarTreeOptions,
  CategoryMeta,
  CollectionEntryLike,
  SidebarFrontmatter,
  SidebarNode,
} from "./types.ts";
