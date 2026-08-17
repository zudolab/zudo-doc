// routes/_docs-helpers — the content bridge for the package-owned route
// entrypoints (epic Package-First Finale #2356, A1 #2361).
//
// WHAT IS LEFT HERE: `stableDocs`, and only `stableDocs`. It is the one piece
// of this module that cannot be browser-safe — it imports `@takazudo/zfb/content`
// directly (NOT the host `zfb/content` tsconfig alias — Decision 2) to anchor
// the bridged + draft-filtered array on the build snapshot, so repeat callers
// within a build get the SAME instance and the nav-tree / doc-route memos
// short-circuit (the content bridge — Decision 5).
//
// WHAT MOVED: every pure nav helper this file used to define — `buildNavTree`,
// `groupSatelliteNodes`, `findNode`, `firstRoutedHref`, `collectAutoIndexNodes`,
// `buildBreadcrumbs`, `isNavVisible` — now lives in `../site-schema/nav-tree.js`
// and is re-exported below unchanged (#3395). Cutting them loose is what lets
// `createDocRouteEntries` reach `buildBreadcrumbs` without dragging
// `@takazudo/zfb/content` into an otherwise browser-safe graph.

import {
  getCollection,
  getContentSnapshot,
} from "@takazudo/zfb/content";
import type { CategoryMeta } from "../sidebar-tree/types.js";
import type { DocNavNode, DocPageEntry, DocPageFrontmatter } from "../doc-page-props/index.js";

export type { CategoryMeta, DocNavNode, DocPageEntry };
export type { BreadcrumbItem } from "../site-schema/types.js";
export type { BuildHref, BuildNavTreeOptions } from "../site-schema/nav-tree.js";

export {
  buildBreadcrumbs,
  buildNavTree,
  collectAutoIndexNodes,
  findNode,
  firstRoutedHref,
  groupSatelliteNodes,
  isNavVisible,
} from "../site-schema/nav-tree.js";

// ---------------------------------------------------------------------------
// Content bridge — snapshot-anchored stable docs (Decision 5)
// ---------------------------------------------------------------------------

/** The stable per-build anchor array for a collection — the raw readonly
 *  snapshot array zfb installs once. `undefined` on the fs-fallback path. */
function snapshotAnchor(name: string): readonly unknown[] | undefined {
  return getContentSnapshot()?.collections[name];
}

const docsByAnchor = new WeakMap<object, DocPageEntry[]>();

function buildDocs(collectionName: string): DocPageEntry[] {
  return getCollection<DocPageFrontmatter>(collectionName).filter((entry) => !entry.data.draft);
}

/**
 * Identity-stable, draft-filtered `DocPageEntry[]` for a collection. Returns the
 * SAME array instance on every call within one build (anchored on the snapshot
 * array); the no-snapshot (fs-fallback / unit-test) path computes fresh and is
 * deliberately unmemoized. Passed as `stableDocs` to `createNavSourceDocs`.
 */
export function stableDocs(collectionName: string): DocPageEntry[] {
  const anchor = snapshotAnchor(collectionName);
  if (anchor === undefined) return buildDocs(collectionName);
  const cached = docsByAnchor.get(anchor);
  if (cached) return cached;
  const built = buildDocs(collectionName);
  docsByAnchor.set(anchor, built);
  return built;
}
