/**
 * Headless outline model for zudo-doc online.
 *
 * Everything in this module is JSON-safe and rendering-agnostic: the same
 * types back the SPA, the local API server, and the MCP agent surface.
 *
 * Title ownership (epic #3327 contract 1): page titles, descriptions and draft
 * flags live ONLY in page frontmatter, so a page is a `{ id, slug }` reference
 * and nothing more. Category titles are outline-owned because a category has
 * no frontmatter file of its own. There is deliberately no `rename-page`
 * command — retitling a page is a frontmatter write, not an outline edit.
 */

/** Bumped only when the persisted shape changes incompatibly. */
export const OUTLINE_SCHEMA_VERSION = 1;

export type OutlineSchemaVersion = typeof OUTLINE_SCHEMA_VERSION;

/** A page as the outline knows it: identity plus its URL segment. */
export interface PageRef {
  id: string;
  slug: string;
}

/** Array order IS the order — there is no separate order manifest. */
export interface Category {
  id: string;
  slug: string;
  title: string;
  pages: PageRef[];
}

/**
 * The whole outline. The site's top page is DERIVED from this (see
 * `site-map.ts`) and is never stored as a node.
 */
export interface OutlineDoc {
  schemaVersion: OutlineSchemaVersion;
  projectTitle: string;
  categories: Category[];
}

/**
 * Mints ids for newly created nodes. Injectable so tests (and seeded fixtures)
 * can be deterministic. Ids are minted once and never rewritten — renaming a
 * slug or title must never change an id.
 */
export type IdFactory = (kind: "category" | "page") => string;

export interface AddCategoryCommand {
  type: "add-category";
  title: string;
  /** Omit to derive (and auto-dedupe) the slug from `title`. */
  slug?: string;
}

export interface RenameCategoryCommand {
  type: "rename-category";
  categoryId: string;
  title: string;
}

export interface RemoveCategoryCommand {
  type: "remove-category";
  categoryId: string;
}

export interface MoveCategoryCommand {
  type: "move-category";
  categoryId: string;
  toIndex: number;
}

export interface AddPageCommand {
  type: "add-page";
  categoryId: string;
  /**
   * Used ONLY to derive a default slug and to echo back in
   * `meta.createdPage` so the caller can write the page's frontmatter. The
   * outline itself never stores it.
   */
  title: string;
  slug?: string;
  /** Supply to adopt an id minted elsewhere (e.g. an importer). */
  pageId?: string;
}

export interface SetPageSlugCommand {
  type: "set-page-slug";
  pageId: string;
  slug: string;
}

export interface RemovePageCommand {
  type: "remove-page";
  pageId: string;
}

/** Works across parents: `toCategoryId` may differ from the current parent. */
export interface MovePageCommand {
  type: "move-page";
  pageId: string;
  toCategoryId: string;
  toIndex: number;
}

export interface ReorderPagesCommand {
  type: "reorder-pages";
  categoryId: string;
  /** Must be an exact permutation of the category's current page ids. */
  orderedPageIds: string[];
}

/** Wholesale replacement — the payload is validated and normalized. */
export interface ReplaceDocCommand {
  type: "replace-doc";
  doc: OutlineDoc;
}

export type OutlineCommand =
  | AddCategoryCommand
  | RenameCategoryCommand
  | RemoveCategoryCommand
  | MoveCategoryCommand
  | AddPageCommand
  | SetPageSlugCommand
  | RemovePageCommand
  | MovePageCommand
  | ReorderPagesCommand
  | ReplaceDocCommand;

export type OutlineCommandType = OutlineCommand["type"];

/**
 * Stable error codes. These cross the REST and MCP boundaries, so treat them
 * as part of the public contract: add codes freely, never repurpose one.
 */
export type OutlineErrorCode =
  | "category-not-found"
  | "page-not-found"
  | "invalid-title"
  | "invalid-page-id"
  | "page-id-conflict"
  | "slug-empty"
  | "slug-too-long"
  | "slug-not-normalized"
  | "slug-not-lowercase"
  | "slug-invalid-characters"
  | "slug-conflict"
  | "index-out-of-range"
  | "invalid-page-order"
  | "invalid-doc"
  | "unknown-command";

/**
 * Echoed by `add-page` only. The outline stores `{ id, slug }`, so the title
 * the caller asked for would otherwise be lost — the server needs it to write
 * the new page's frontmatter.
 */
export interface CreatedPageMeta {
  id: string;
  slug: string;
  title: string;
}

export interface CommandMeta {
  createdPage?: CreatedPageMeta;
}

export interface CommandSuccess {
  ok: true;
  /**
   * The next outline. For a `changed: false` result this is the input doc
   * itself (untouched), so callers may compare by reference.
   */
  doc: OutlineDoc;
  /** Repaired selection: a category or page id, or null when nothing is left. */
  selectedId: string | null;
  changed: boolean;
  meta?: CommandMeta;
}

export interface CommandFailure {
  ok: false;
  code: OutlineErrorCode;
  message: string;
}

export type CommandResult = CommandSuccess | CommandFailure;

export interface CommandContext {
  /** Current selection, used to repair selection across removals. */
  selectedId?: string | null;
  createId?: IdFactory;
}
