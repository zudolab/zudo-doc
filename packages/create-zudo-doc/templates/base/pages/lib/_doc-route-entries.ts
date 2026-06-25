// Thin stub — doc-route-entries moved to the package (epic #2344, S6).
// Calls `createDocRouteEntries(ctx)` from @takazudo/zudo-doc/doc-route-entries
// with the host utilities injected, then re-exports the resulting builder
// function so all existing call sites continue to work unchanged.

import { createDocRouteEntries } from "@takazudo/zudo-doc/doc-route-entries";
export type { DocRouteEntry, BuildDocRouteEntriesArgs } from "@takazudo/zudo-doc/doc-route-entries";
import { buildNavTree, buildBreadcrumbs, collectAutoIndexNodes } from "@/utils/docs";
import { getNavSectionForSlug, getNavSubtree } from "@/utils/nav-scope";
import { toRouteSlug, toSlugParams } from "@/utils/slug";
import { extractHeadings } from "./_extract-headings";

export const { buildDocRouteEntries } = createDocRouteEntries({
  buildNavTree,
  buildBreadcrumbs,
  collectAutoIndexNodes,
  getNavSectionForSlug,
  getNavSubtree,
  toRouteSlug,
  toSlugParams,
  extractHeadings,
});
