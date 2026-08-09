/**
 * Command builders and the copy that goes with them.
 *
 * Rows call these instead of assembling command objects inline, so the index
 * arithmetic behind "move up" / "move down" — the classic off-by-one in any
 * reorder UI — lives in one tested place rather than in six event handlers.
 *
 * The index convention matters and is easy to get wrong: `move-page` removes
 * the page from its slot BEFORE inserting it at `toIndex`, so within a single
 * category `toIndex` is simply `fromIndex ± 1`, while an append into a
 * different category is `target.pages.length` (one past the last slot,
 * because nothing was removed there). `move-category` never removes-then-
 * inserts across containers, so its `toIndex` is the plain neighbour index.
 */

import type {
  AddCategoryCommand,
  AddPageCommand,
  MoveCategoryCommand,
  MovePageCommand,
  OutlineCommand,
  OutlineCommandType,
  RemoveCategoryCommand,
  RemovePageCommand,
  RenameCategoryCommand,
  SetPageSlugCommand,
} from "../../core/outline/index.js";
import type {
  PageFrontmatter,
  PageSummary,
  ProjectSnapshot,
} from "../../store/contract.js";
import type { OutlineCategoryRow, OutlinePageRow } from "./outline-model.js";

export type MoveDirection = "up" | "down";

/** Null when the row is already at that end — the button is disabled there. */
export function moveCategoryCommand(
  category: OutlineCategoryRow,
  direction: MoveDirection,
): MoveCategoryCommand | null {
  if (direction === "up" && !category.canMoveUp) return null;
  if (direction === "down" && !category.canMoveDown) return null;
  return {
    type: "move-category",
    categoryId: category.id,
    toIndex: direction === "up" ? category.index - 1 : category.index + 1,
  };
}

export function movePageCommand(
  category: OutlineCategoryRow,
  page: OutlinePageRow,
  direction: MoveDirection,
): MovePageCommand | null {
  if (direction === "up" && !page.canMoveUp) return null;
  if (direction === "down" && !page.canMoveDown) return null;
  return {
    type: "move-page",
    pageId: page.id,
    toCategoryId: category.id,
    toIndex: direction === "up" ? page.index - 1 : page.index + 1,
  };
}

/** Appends the page to the end of another category. */
export function movePageToCategoryCommand(
  snapshot: ProjectSnapshot,
  pageId: string,
  toCategoryId: string,
): MovePageCommand | null {
  const target = snapshot.outline.categories.find(
    (category) => category.id === toCategoryId,
  );
  if (target === undefined) return null;
  return {
    type: "move-page",
    pageId,
    toCategoryId,
    toIndex: target.pages.length,
  };
}

export function addPageCommand(
  categoryId: string,
  title: string,
): AddPageCommand {
  return { type: "add-page", categoryId, title };
}

export function addCategoryCommand(title: string): AddCategoryCommand {
  return { type: "add-category", title };
}

export function renameCategoryCommand(
  categoryId: string,
  title: string,
): RenameCategoryCommand {
  return { type: "rename-category", categoryId, title };
}

export function removeCategoryCommand(
  categoryId: string,
): RemoveCategoryCommand {
  return { type: "remove-category", categoryId };
}

export function removePageCommand(pageId: string): RemovePageCommand {
  return { type: "remove-page", pageId };
}

export function setPageSlugCommand(
  pageId: string,
  slug: string,
): SetPageSlugCommand {
  return { type: "set-page-slug", pageId, slug };
}

/**
 * Human-readable names for the conflict banner, which has to say WHICH change
 * failed. Deliberately command-type-level rather than per-node: the node it
 * named may no longer exist in the outline the server sent back with the 409.
 */
const COMMAND_LABELS: Record<OutlineCommandType, string> = {
  "add-category": "Add category",
  "rename-category": "Rename category",
  "remove-category": "Delete category",
  "move-category": "Move category",
  "add-page": "Add page",
  "set-page-slug": "Change page slug",
  "remove-page": "Delete page",
  "move-page": "Move page",
  "reorder-pages": "Reorder pages",
  "replace-doc": "Replace outline",
};

export function describeCommand(command: OutlineCommand): string {
  return COMMAND_LABELS[command.type];
}

/**
 * A category delete takes its pages with it, so the confirm names the count
 * rather than asking a bare "are you sure?".
 */
export function describeCategoryDelete(category: OutlineCategoryRow): string {
  if (category.pageCount === 0) {
    return `Delete “${category.title}”? It holds no pages.`;
  }
  const pages = category.pageCount === 1 ? "page" : "pages";
  return `Delete “${category.title}” and the ${category.pageCount} ${pages} inside it?`;
}

export function describePageDelete(page: OutlinePageRow): string {
  return `Delete “${page.title}”?`;
}

/**
 * Frontmatter for a page rename (epic #3327 contract 1: a title is page
 * frontmatter, not outline structure — there is no `rename-page` command).
 *
 * `savePage` REPLACES the frontmatter block wholesale, so `current` must be
 * the page's freshest known frontmatter: anything missing from it is not
 * "left alone", it is deleted. Callers read that from the server immediately
 * before the write rather than from a snapshot they captured earlier — see
 * `use-outline-surface.ts`'s `applyMutation`.
 */
export function renamedFrontmatter(
  current: PageFrontmatter,
  title: string,
): PageFrontmatter {
  return {
    title,
    ...(current.description === undefined
      ? {}
      : { description: current.description }),
    ...(current.draft === undefined ? {} : { draft: current.draft }),
  };
}

export function findPageSummary(
  snapshot: ProjectSnapshot,
  pageId: string,
): PageSummary | null {
  return snapshot.pages.find((page) => page.id === pageId) ?? null;
}

/**
 * Applies a committed page write to the composed snapshot.
 *
 * A page write returns the saved page, not a new project snapshot, so the
 * surface patches the one page it just changed instead of re-fetching the
 * whole project. `revision` is the value the server reported for the write,
 * which keeps the snapshot's revision honest for anything reading it.
 */
export function withPageFrontmatter(
  snapshot: ProjectSnapshot,
  pageId: string,
  frontmatter: PageFrontmatter,
  revision: number,
): ProjectSnapshot {
  return {
    ...snapshot,
    revision,
    pages: snapshot.pages.map((page) =>
      page.id === pageId
        ? {
            id: page.id,
            slug: page.slug,
            categoryId: page.categoryId,
            title: frontmatter.title,
            ...(frontmatter.description === undefined
              ? {}
              : { description: frontmatter.description }),
            ...(frontmatter.draft === undefined ? {} : { draft: frontmatter.draft }),
          }
        : page,
    ),
  };
}
