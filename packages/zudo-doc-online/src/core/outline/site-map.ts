/**
 * Pure projection from an outline to the site it would produce.
 *
 * This is what the outline surface's consequence preview and the board view
 * render: header nav, per-category sidebar lists, and the top page's category
 * grid. It is a *preview* rather than the published site, so drafts are kept
 * and flagged instead of dropped — the point is to show the author what their
 * structure means, including the parts that are not live yet.
 *
 * Titles arrive from the caller (contract 1: they live in page frontmatter,
 * not the outline). When a page has no meta the projection falls back to a
 * humanized slug and marks it `hasMeta: false` rather than inventing a title.
 */

import type { Category, OutlineDoc, PageRef } from "./types";

/** Supplied by the caller from the composed page frontmatter. */
export interface PageMeta {
  id: string;
  title: string;
  description?: string;
  draft?: boolean;
}

export const DEFAULT_SITE_MAP_BASE_PATH = "/docs";

/** A page with this slug is the category's landing page, not a child of it. */
export const CATEGORY_INDEX_SLUG = "index";

export interface SiteMapPage {
  id: string;
  slug: string;
  title: string;
  description?: string;
  draft: boolean;
  /** False when the caller supplied no meta and `title` is slug-derived. */
  hasMeta: boolean;
  isIndex: boolean;
  path: string;
}

export interface SiteMapCategory {
  id: string;
  slug: string;
  title: string;
  path: string;
  /** The `index` page, when the category has one. */
  indexPage: SiteMapPage | null;
  /** Sidebar order — outline order, index page included. */
  pages: SiteMapPage[];
  pageCount: number;
  draftCount: number;
}

export interface SiteMapNavItem {
  categoryId: string;
  title: string;
  path: string;
}

export interface SiteMapTopCard {
  categoryId: string;
  title: string;
  path: string;
  /** Taken from the category's index page description, when there is one. */
  description?: string;
  pageCount: number;
  draftCount: number;
}

export interface SiteMapTopPage {
  title: string;
  path: string;
  cards: SiteMapTopCard[];
}

export interface SiteMapModel {
  projectTitle: string;
  basePath: string;
  nav: SiteMapNavItem[];
  categories: SiteMapCategory[];
  /** Derived from the categories — the top page is never an outline node. */
  topPage: SiteMapTopPage;
  /** Pages in the outline with no supplied meta. */
  missingMetaPageIds: string[];
  /** Supplied meta whose page is not in the outline. */
  unusedMetaIds: string[];
}

export interface SiteMapOptions {
  basePath?: string;
}

export function buildSiteMap(
  doc: OutlineDoc,
  pageMeta: PageMeta[] = [],
  options: SiteMapOptions = {},
): SiteMapModel {
  const basePath = normalizeBasePath(
    options.basePath ?? DEFAULT_SITE_MAP_BASE_PATH,
  );
  const metaById = new Map(pageMeta.map((meta) => [meta.id, meta]));
  const seenMetaIds = new Set<string>();
  const missingMetaPageIds: string[] = [];

  const categories = doc.categories.map((category) =>
    buildCategory(category, basePath, metaById, seenMetaIds, missingMetaPageIds),
  );

  return {
    projectTitle: doc.projectTitle,
    basePath,
    nav: categories.map((category) => ({
      categoryId: category.id,
      title: category.title,
      path: category.path,
    })),
    categories,
    topPage: {
      title: doc.projectTitle,
      path: basePath,
      cards: categories.map(toTopCard),
    },
    missingMetaPageIds,
    unusedMetaIds: pageMeta
      .filter((meta) => !seenMetaIds.has(meta.id))
      .map((meta) => meta.id),
  };
}

function buildCategory(
  category: Category,
  basePath: string,
  metaById: Map<string, PageMeta>,
  seenMetaIds: Set<string>,
  missingMetaPageIds: string[],
): SiteMapCategory {
  const path = joinPath(basePath, category.slug);
  const pages = category.pages.map((page) => {
    const meta = metaById.get(page.id);
    if (meta) {
      seenMetaIds.add(page.id);
    } else {
      missingMetaPageIds.push(page.id);
    }
    return buildPage(page, path, meta);
  });

  return {
    id: category.id,
    slug: category.slug,
    title: category.title,
    path,
    indexPage: pages.find((page) => page.isIndex) ?? null,
    pages,
    pageCount: pages.length,
    draftCount: pages.filter((page) => page.draft).length,
  };
}

function buildPage(
  page: PageRef,
  categoryPath: string,
  meta: PageMeta | undefined,
): SiteMapPage {
  const isIndex = page.slug === CATEGORY_INDEX_SLUG;
  const description = meta?.description;
  return {
    id: page.id,
    slug: page.slug,
    title: meta?.title ?? humanizeSlug(page.slug),
    ...(description === undefined ? {} : { description }),
    draft: meta?.draft === true,
    hasMeta: meta !== undefined,
    isIndex,
    path: isIndex ? categoryPath : joinPath(categoryPath, page.slug),
  };
}

function toTopCard(category: SiteMapCategory): SiteMapTopCard {
  const description = category.indexPage?.description;
  return {
    categoryId: category.id,
    title: category.title,
    path: category.path,
    ...(description === undefined ? {} : { description }),
    pageCount: category.pageCount,
    draftCount: category.draftCount,
  };
}

/** "quick-start" -> "Quick start". Non-cased scripts pass through unchanged. */
export function humanizeSlug(slug: string): string {
  const words = slug.split("-").filter((word) => word.length > 0);
  const first = words[0];
  if (first === undefined) return slug;
  const head = first.charAt(0).toUpperCase() + first.slice(1);
  return [head, ...words.slice(1)].join(" ");
}

function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.trim().replace(/\/+$/, "");
  if (trimmed.length === 0) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function joinPath(base: string, segment: string): string {
  return base === "/" ? `/${segment}` : `${base}/${segment}`;
}
