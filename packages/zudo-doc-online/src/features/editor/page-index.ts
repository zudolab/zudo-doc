/**
 * The snapshot → tree view-model the rail, the flyout and the metadata row
 * all read from.
 *
 * Titles are joined here rather than stored in the outline (epic #3327
 * contract 1: the outline holds `PageRef { id, slug }` and nothing else, and
 * every title/description/draft flag lives in page frontmatter). The composed
 * `ProjectSnapshot` carries both halves, so this module is the single place
 * that pairs them — and the single place that decides what to show when the
 * two disagree (a `PageRef` with no matching summary falls back to its slug
 * rather than rendering an empty row).
 *
 * `position` is 1-based because it is a user-facing field in the metadata
 * row; every outline command speaks 0-based indices, so `buildMovePageCommand`
 * owns that conversion rather than leaving it to a call site.
 */

import type { MovePageCommand } from "../../core/outline/index";
import type { PageFrontmatter, PageSummary, ProjectSnapshot } from "../../store/index";

export interface EditorTreePage {
  id: string;
  slug: string;
  title: string;
  description: string;
  draft: boolean;
  categoryId: string;
  categorySlug: string;
  /** 1-based rank inside the owning category. */
  position: number;
  /** How many pages the owning category holds — the position field's max. */
  categorySize: number;
}

export interface EditorTreeCategory {
  id: string;
  slug: string;
  title: string;
  pages: EditorTreePage[];
}

export function buildEditorTree(snapshot: ProjectSnapshot): EditorTreeCategory[] {
  const summaries = new Map<string, PageSummary>(
    snapshot.pages.map((page) => [page.id, page]),
  );

  return snapshot.outline.categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    title: category.title,
    pages: category.pages.map((ref, index) => {
      const summary = summaries.get(ref.id);
      return {
        id: ref.id,
        slug: ref.slug,
        title: summary?.title ?? ref.slug,
        description: summary?.description ?? "",
        draft: summary?.draft === true,
        categoryId: category.id,
        categorySlug: category.slug,
        position: index + 1,
        categorySize: category.pages.length,
      };
    }),
  }));
}

/**
 * Overlays the live frontmatter of every OPEN page onto the snapshot-derived
 * tree.
 *
 * Without this, retitling a page would leave the rail (and the flyout)
 * showing the old title until the next snapshot refresh, while the tab strip
 * — which reads the same save machine the field writes to — showed the new
 * one. Two components disagreeing about a page's name is worse than either
 * one lagging, so the open session's draft wins everywhere.
 */
export function overlayPageMeta(
  tree: readonly EditorTreeCategory[],
  overrides: ReadonlyMap<string, PageFrontmatter>,
): EditorTreeCategory[] {
  if (overrides.size === 0) return tree as EditorTreeCategory[];
  return tree.map((category) => ({
    ...category,
    pages: category.pages.map((page) => {
      const override = overrides.get(page.id);
      if (!override) return page;
      return {
        ...page,
        title: override.title,
        description: override.description ?? "",
        draft: override.draft === true,
      };
    }),
  }));
}

export function findTreePage(
  tree: readonly EditorTreeCategory[],
  pageId: string,
): EditorTreePage | undefined {
  for (const category of tree) {
    const page = category.pages.find((entry) => entry.id === pageId);
    if (page) return page;
  }
  return undefined;
}

export function knownPageIds(tree: readonly EditorTreeCategory[]): Set<string> {
  const ids = new Set<string>();
  for (const category of tree) {
    for (const page of category.pages) ids.add(page.id);
  }
  return ids;
}

export function countTreePages(tree: readonly EditorTreeCategory[]): number {
  return tree.reduce((total, category) => total + category.pages.length, 0);
}

/** `getting-started/installation` — the page's URL path, as the chrome shows it. */
export function pagePath(page: EditorTreePage): string {
  return `${page.categorySlug}/${page.slug}`;
}

/** `installation.mdx` — the on-disk file name, as the pane header shows it. */
export function pageFileName(page: EditorTreePage): string {
  return `${page.slug}.mdx`;
}

/**
 * Translates a Position-field edit into an outline command, or `null` when
 * the request is a no-op. Out-of-range input is clamped rather than rejected:
 * typing "99" into a 4-page category plainly means "put it last", and an
 * error toast for that would be theatre.
 */
export function buildMovePageCommand(
  page: EditorTreePage,
  requestedPosition: number,
): MovePageCommand | null {
  if (!Number.isFinite(requestedPosition)) return null;
  const clamped = Math.min(
    page.categorySize,
    Math.max(1, Math.round(requestedPosition)),
  );
  if (clamped === page.position) return null;
  return {
    type: "move-page",
    pageId: page.id,
    toCategoryId: page.categoryId,
    toIndex: clamped - 1,
  };
}
