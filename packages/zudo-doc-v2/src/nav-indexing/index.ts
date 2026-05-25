/**
 * Public entry for the nav-indexing v2 primitives.
 *
 * Consumers import from `@zudo-doc/zudo-doc-v2/nav-indexing`:
 *
 *   import {
 *     CategoryNav,
 *     CategoryTreeNav,
 *     SiteTreeNavDemo,
 *     TagNav,
 *     DocsSitemap,
 *     NavCardGrid,
 *     DocCardGrid,
 *     VersionsPageContent,
 *   } from "@zudo-doc/zudo-doc-v2/nav-indexing";
 *
 * All components are purely presentational — the host project assembles the
 * collection data (navtrees, tag lists, version entries) before rendering.
 * No `getCollection()` calls, no `@/` host-project imports, no Astro APIs.
 */

export { CategoryNav } from "./category-nav";
export type { CategoryNavProps } from "./category-nav";

export { CategoryTreeNav } from "./category-tree-nav";
export type { CategoryTreeNavProps } from "./category-tree-nav";

export { SiteTreeNavDemo } from "./site-tree-nav-demo";
export type { SiteTreeNavDemoProps } from "./site-tree-nav-demo";

export { TagNav } from "./tag-nav";
export type {
  TagNavProps,
  TagNavAllProps,
  TagNavPageProps,
} from "./tag-nav";

export { DocsSitemap } from "./docs-sitemap";
export type { DocsSitemapProps } from "./docs-sitemap";

export { NavCardGrid } from "./nav-card-grid";
export type { NavCardGridProps } from "./nav-card-grid";

export { DocCardGrid } from "./doc-card-grid";
export type { DocCardGridProps, DocCardItem } from "./doc-card-grid";

export { VersionsPageContent } from "./versions-page-content";
export type { VersionsPageContentProps } from "./versions-page-content";

export type {
  NavNode,
  TagItem,
  TagLink,
  TagNavLabels,
  VersionPageEntry,
  VersionsPageLabels,
} from "./types";
