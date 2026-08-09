/**
 * The tree the outline surface renders, derived from a project snapshot.
 *
 * Both panes read from ONE projection: `buildSiteMap` (core `site-map.ts`)
 * already resolves every page's effective title, draft flag and published
 * path from the outline plus the composed frontmatter, so the tree rows and
 * the consequence preview can never disagree about what a page is called or
 * where it would live. The tree model adds only what a *tree* needs on top of
 * that: per-row move affordances and the cross-parent move targets.
 *
 * Everything here is pure and synchronous — no store, no DOM.
 */

import {
  buildSiteMap,
  DEFAULT_SITE_MAP_BASE_PATH,
  type PageMeta,
  type SiteMapModel,
} from "../../core/outline/site-map.js";
import type { ProjectSnapshot } from "../../store/contract.js";

export interface OutlinePageRow {
  id: string;
  slug: string;
  title: string;
  path: string;
  draft: boolean;
  /** True for the category's landing page (`index`), which owns its path. */
  isIndex: boolean;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export interface OutlineCategoryRow {
  id: string;
  slug: string;
  title: string;
  path: string;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  pageCount: number;
  draftCount: number;
  pages: OutlinePageRow[];
}

export interface OutlineTopPageRow {
  title: string;
  path: string;
  categoryCount: number;
  pageCount: number;
}

export interface OutlineTreeModel {
  projectTitle: string;
  basePath: string;
  /** The derived top page — never an outline node, always a consequence. */
  topPage: OutlineTopPageRow;
  categories: OutlineCategoryRow[];
  /** The same projection the consequence preview renders. */
  siteMap: SiteMapModel;
}

export interface BuildOutlineTreeOptions {
  basePath?: string;
}

/**
 * The frontmatter side of the projection. A snapshot's `pages` array already
 * carries exactly the fields `PageMeta` wants — this only drops the
 * structural `categoryId`/`slug` and omits absent optionals rather than
 * writing `undefined` into them.
 */
export function pageMetaFromSnapshot(snapshot: ProjectSnapshot): PageMeta[] {
  return snapshot.pages.map((page) => ({
    id: page.id,
    title: page.title,
    ...(page.description === undefined ? {} : { description: page.description }),
    ...(page.draft === undefined ? {} : { draft: page.draft }),
  }));
}

export function buildOutlineTree(
  snapshot: ProjectSnapshot,
  options: BuildOutlineTreeOptions = {},
): OutlineTreeModel {
  const siteMap = buildSiteMap(snapshot.outline, pageMetaFromSnapshot(snapshot), {
    basePath: options.basePath ?? DEFAULT_SITE_MAP_BASE_PATH,
  });

  const categories: OutlineCategoryRow[] = siteMap.categories.map(
    (category, index) => ({
      id: category.id,
      slug: category.slug,
      title: category.title,
      path: category.path,
      index,
      canMoveUp: index > 0,
      canMoveDown: index < siteMap.categories.length - 1,
      pageCount: category.pageCount,
      draftCount: category.draftCount,
      pages: category.pages.map((page, pageIndex) => ({
        id: page.id,
        slug: page.slug,
        title: page.title,
        path: page.path,
        draft: page.draft,
        isIndex: page.isIndex,
        index: pageIndex,
        canMoveUp: pageIndex > 0,
        canMoveDown: pageIndex < category.pages.length - 1,
      })),
    }),
  );

  return {
    projectTitle: siteMap.projectTitle,
    basePath: siteMap.basePath,
    topPage: {
      title: siteMap.topPage.title,
      path: siteMap.topPage.path,
      categoryCount: categories.length,
      pageCount: categories.reduce((total, category) => total + category.pageCount, 0),
    },
    categories,
    siteMap,
  };
}

export interface MoveTarget {
  categoryId: string;
  title: string;
  slug: string;
  /** Non-null when the move would be rejected — shown, not hidden. */
  disabledReason: string | null;
}

/**
 * The categories a page may be moved into, current parent excluded.
 *
 * A target that already holds a page with this slug is listed but disabled:
 * `move-page` rejects it with `slug-conflict`, and saying so up front beats
 * an error banner after the click. This is common in practice — every
 * category tends to have an `index` page.
 */
export function listMoveTargets(
  snapshot: ProjectSnapshot,
  pageId: string,
): MoveTarget[] {
  const owner = snapshot.outline.categories.find((category) =>
    category.pages.some((page) => page.id === pageId),
  );
  if (owner === undefined) return [];

  const slug = owner.pages.find((page) => page.id === pageId)?.slug;
  if (slug === undefined) return [];

  return snapshot.outline.categories
    .filter((category) => category.id !== owner.id)
    .map((category) => ({
      categoryId: category.id,
      title: category.title,
      slug: category.slug,
      disabledReason: category.pages.some((page) => page.slug === slug)
        ? `Already has a page at “${slug}”`
        : null,
    }));
}

export function findCategoryRow(
  model: OutlineTreeModel,
  categoryId: string | null,
): OutlineCategoryRow | null {
  if (categoryId === null) return null;
  return model.categories.find((category) => category.id === categoryId) ?? null;
}
