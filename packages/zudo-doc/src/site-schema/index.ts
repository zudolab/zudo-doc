// @takazudo/zudo-doc/site-schema — the browser-safe nav / breadcrumb / pager
// domain (zudolab/zudo-doc#3395).
//
// Everything here answers "what is the shape of this documentation site?":
// which routes exist, how they nest, what the previous/next page is, and what
// trail leads to a given slug. It is deliberately free of rendering, of disk
// access, and of the zfb engine, so a browser bundle, a Worker, or a non-zfb
// tool can compute the same answers the SSG build computes.
//
// THREE GUARDS keep that promise (all must stay green):
//   1. `src/__tests__/site-schema.test.ts` bundles this barrel with esbuild
//      `platform: "neutral"` and fails on any reachable `node:*`, `preact`,
//      `.css`, `virtual:`, or `@takazudo/zfb*` specifier — and walks the
//      emitted TRANSITIVE `.d.ts` graph for the same.
//   2. `scripts/check-site-schema.mjs` repeats the bundle check against the
//      built `dist/site-schema/index.js` in the `prepack` chain, so a publish
//      cannot ship a graph the source-level guard would have rejected.
//   3. The `package.json#exports` keyset snapshot in
//      `src/__tests__/public-api-snapshot.test.ts`.
//
// NOT exported, on purpose: the component-side `findPath` / `buildBreadcrumbItems`
// pair in `../breadcrumb` is presentation detail. The blessed breadcrumb
// contract is the route-time `buildBreadcrumbs` below — the slug-split walk over
// `DocNavNode` that produces `props.breadcrumbs`.

/**
 * Contract version of this module's shape. Bump on any breaking change to the
 * exported types or functions so a consumer can fail closed rather than
 * silently mis-read a newer schema (`@takazudo/zudo-doc/catalog` precedent).
 */
export const schemaVersion = 1;

// ── Types ───────────────────────────────────────────────────────────────────

export type {
  AutoIndexNode,
  BreadcrumbItem,
  CategoryMeta,
  CollectionEntryLike,
  DocEntryLike,
  DocNavNode,
  DocPageAutoIndexProps,
  DocPageBaseProps,
  DocPageEntryProps,
  DocPageFrontmatter,
  HeadingItem,
  NavSourceDocs,
  SidebarFrontmatter,
  SidebarNode,
} from "./types.js";

export type {
  BuildDocRouteEntriesArgs,
  DocRouteEntriesAPI,
  DocRouteEntriesContext,
  DocRouteEntry,
} from "./doc-route-entries.js";

export type { BuildHref, BuildNavTreeOptions } from "./nav-tree.js";

export type { PaginationOverrides } from "../doc-route-paths/index.js";

// ── Nav tree, breadcrumbs, auto-index ───────────────────────────────────────

export {
  buildBreadcrumbs,
  buildNavTree,
  collectAutoIndexNodes,
  findNode,
  firstRoutedHref,
  groupSatelliteNodes,
  isNavVisible,
} from "./nav-tree.js";

// ── Prev/next and href remapping ────────────────────────────────────────────
//
// `findNode` is exported from `./nav-tree.js` above; `doc-route-paths` carries
// a structurally identical copy that this barrel deliberately does not
// re-export a second time under the same name.

export {
  flattenSubtree,
  flattenTree,
  remapNavChildHrefs,
  resolveDocPrevNext,
  rewriteNavHref,
} from "../doc-route-paths/index.js";

// ── Nav scoping (headerNav categoryMatch) ───────────────────────────────────

export {
  getCategoryOrder,
  getNavSectionForSlug,
  getNavSubtree,
} from "../nav-scope/index.js";

export type { NavScopeHeaderNavItem, NavScopeNode } from "../nav-scope/index.js";

// ── Sidebar tree primitive ──────────────────────────────────────────────────
//
// From `build-tree.js`, NOT the `sidebar-tree` barrel: the barrel also exports
// `loadCategoryMeta`, which reads sidecar files through `node:fs`.

export { buildSidebarTree } from "../sidebar-tree/build-tree.js";

// ── Headings ────────────────────────────────────────────────────────────────

export { extractHeadings } from "../extract-headings/index.js";

// ── Route enumeration ───────────────────────────────────────────────────────

export { createDocRouteEntries } from "./doc-route-entries.js";
