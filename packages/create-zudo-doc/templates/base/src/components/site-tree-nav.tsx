// Thin re-export shim. SiteTreeNav moved into the package
// (`@takazudo/zudo-doc/site-tree-nav-island`) as part of the package-first
// migration (#2344, S2). Host code using `@/components/site-tree-nav`
// still resolves correctly; the implementation lives in the package.
export { SiteTreeNav } from "@takazudo/zudo-doc/site-tree-nav-island";
export type { SiteTreeNavProps } from "@takazudo/zudo-doc/site-tree-nav-island";
