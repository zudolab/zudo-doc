/**
 * Public entry for the nav-indexing v2 primitives.
 *
 * Consumers import from `@takazudo/zudo-doc/nav-indexing`:
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
 *   } from "@takazudo/zudo-doc/nav-indexing";
 *
 * All components are purely presentational — the host project assembles the
 * collection data (navtrees, tag lists, version entries) before rendering.
 * No `getCollection()` calls, no `@/` host-project imports, no Astro APIs.
 */

export { CategoryNav } from "./category-nav.js";
export type { CategoryNavProps } from "./category-nav.js";

export { CategoryTreeNav } from "./category-tree-nav.js";
export type { CategoryTreeNavProps } from "./category-tree-nav.js";

export { SiteTreeNavDemo } from "./site-tree-nav-demo.js";
export type { SiteTreeNavDemoProps } from "./site-tree-nav-demo.js";

export { TagNav } from "./tag-nav.js";
export type {
  TagNavProps,
  TagNavAllProps,
  TagNavPageProps,
} from "./tag-nav.js";

export { DocsSitemap } from "./docs-sitemap.js";
export type { DocsSitemapProps } from "./docs-sitemap.js";

export { NavCardGrid } from "./nav-card-grid.js";
export type { NavCardGridProps } from "./nav-card-grid.js";

export { DocCardGrid } from "./doc-card-grid.js";
export type { DocCardGridProps, DocCardItem } from "./doc-card-grid.js";

export { VersionsPageContent } from "./versions-page-content.js";
export type { VersionsPageContentProps } from "./versions-page-content.js";

export type {
  NavNode,
  TagItem,
  TagLink,
  TagNavLabels,
  VersionPageEntry,
  VersionsPageLabels,
} from "./types.js";
