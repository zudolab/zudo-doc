/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Thin stub — category-tree-nav moved to the package (epic #2344, S8).
// Calls `createCategoryTreeNavWrapper(deps)` from
// @takazudo/zudo-doc/category-tree-nav with host singletons injected,
// then re-exports the resulting component so all existing call sites continue
// to work unchanged.

import { createCategoryTreeNavWrapper } from "@takazudo/zudo-doc/category-tree-nav";
import { buildNavTree, groupSatelliteNodes, findNode } from "@/utils/docs";
import { defaultLocale } from "@/config/i18n";
import { resolveNavSource } from "./_nav-source-docs";

export type { CategoryTreeNavWrapperProps } from "@takazudo/zudo-doc/category-tree-nav";

export const CategoryTreeNavWrapper = createCategoryTreeNavWrapper({
  defaultLocale,
  resolveNavSource: resolveNavSource as (
    lang: string,
    currentVersion: string | undefined,
    options?: { applyDefaultLocaleOnlyFilter?: boolean; keepUnlisted?: boolean },
  ) => import("@takazudo/zudo-doc/category-tree-nav").CategoryTreeNavSource,
  buildNavTree: buildNavTree as (
    docs: unknown[],
    locale: string,
    categoryMeta: Map<string, unknown>,
  ) => import("@takazudo/zudo-doc/category-tree-nav").CategoryTreeNavNode[],
  groupSatelliteNodes: groupSatelliteNodes as (
    tree: import("@takazudo/zudo-doc/category-tree-nav").CategoryTreeNavNode[],
    prefixes: string[],
  ) => import("@takazudo/zudo-doc/category-tree-nav").CategoryTreeNavNode[],
  findNode: findNode as (
    tree: import("@takazudo/zudo-doc/category-tree-nav").CategoryTreeNavNode[],
    slug: string,
  ) => import("@takazudo/zudo-doc/category-tree-nav").CategoryTreeNavNode | undefined,
});
