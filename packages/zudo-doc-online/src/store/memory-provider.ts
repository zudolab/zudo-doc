/**
 * An in-memory `ProjectStore`, for tests today and a future offline mode.
 *
 * Reuses the outline core's own `applyCommand` so outline-command behavior
 * (validation, id minting, selection repair) can never drift from the real
 * server — only the persistence layer underneath is faked. This module never
 * imports from `server/`: the store stays usable outside Node, and the server
 * package is Node-only.
 *
 * Two extra methods, `applyExternalOutlineCommand` and
 * `applyExternalPageWrite`, exist ONLY for tests: they commit a change while
 * bypassing the revision check, standing in for "another tab (or another
 * process) already saved this." That is the only way to deterministically
 * produce a 409 or a same-origin-mismatch SSE event in a test.
 */

import {
  applyCommand,
  type CreatedPageMeta,
  type IdFactory,
  type OutlineCommand,
  type OutlineDoc,
  type OutlineErrorCode,
} from "../core/outline/index";
import {
  RevisionConflictError,
  StoreRequestError,
  type OutlineCommandResult,
  type PageFrontmatter,
  type PagePayload,
  type PageSaveResult,
  type PageSummary,
  type PageWriteInput,
  type ProjectSnapshot,
  type ProjectStore,
} from "./contract";

/**
 * Mirrors the server's `COMMAND_STATUS` table (`server/store/file-store.ts`).
 * Duplicated rather than imported: that table lives in the Node-only server
 * package, and this module must stay usable without it.
 */
const COMMAND_STATUS: Record<OutlineErrorCode, number> = {
  "category-not-found": 404,
  "page-not-found": 404,
  "invalid-title": 400,
  "invalid-page-id": 400,
  "page-id-conflict": 422,
  "slug-empty": 400,
  "slug-too-long": 400,
  "slug-not-normalized": 400,
  "slug-not-lowercase": 400,
  "slug-invalid-characters": 400,
  "slug-conflict": 422,
  "index-out-of-range": 422,
  "invalid-page-order": 422,
  "invalid-doc": 422,
  "id-generation-failed": 422,
  "unknown-command": 400,
};

interface MemoryPage {
  frontmatter: PageFrontmatter;
  markdown: string;
}

export interface MemoryProjectStoreOptions {
  slug: string;
  title: string;
  outline: OutlineDoc;
  /** Keyed by page id. A page with no entry reads as an empty draft. */
  pages?: Record<string, MemoryPage>;
  /** Defaults to 1, matching a freshly created project. */
  revision?: number;
  /** Injectable so tests get deterministic ids from outline commands. */
  createId?: IdFactory;
}

export class MemoryProjectStore implements ProjectStore {
  private outline: OutlineDoc;
  private readonly pages: Map<string, MemoryPage>;
  private revision: number;
  private readonly slug: string;
  private readonly title: string;
  private readonly createId: IdFactory | undefined;

  constructor(options: MemoryProjectStoreOptions) {
    this.slug = options.slug;
    this.title = options.title;
    this.outline = options.outline;
    this.pages = new Map(Object.entries(options.pages ?? {}));
    this.revision = options.revision ?? 1;
    this.createId = options.createId;
  }

  async loadSnapshot(): Promise<ProjectSnapshot> {
    return this.compose();
  }

  async applyOutlineCommand(
    expectedRevision: number,
    command: OutlineCommand,
  ): Promise<OutlineCommandResult> {
    this.assertRevision(expectedRevision);

    const result = applyCommand(this.outline, command, {
      ...(this.createId ? { createId: this.createId } : {}),
    });
    if (!result.ok) {
      throw new StoreRequestError(result.code, result.message, COMMAND_STATUS[result.code]);
    }
    if (!result.changed) {
      return {
        revision: this.revision,
        changed: false,
        selectedId: result.selectedId,
        snapshot: this.compose(),
      };
    }

    this.outline = result.doc;
    this.revision += 1;
    this.applyPageLifecycle(command, result.meta?.createdPage);

    return {
      revision: this.revision,
      changed: true,
      selectedId: result.selectedId,
      ...(result.meta?.createdPage ? { createdPage: result.meta.createdPage } : {}),
      snapshot: this.compose(),
    };
  }

  async loadPage(id: string): Promise<PagePayload> {
    const placement = this.locate(id);
    if (!placement) {
      throw new StoreRequestError("page-not-found", `No page with id "${id}".`, 404);
    }
    const stored = this.pages.get(id);
    return {
      id,
      slug: placement.slug,
      categoryId: placement.categoryId,
      revision: this.revision,
      frontmatter: stored?.frontmatter ?? { title: placement.slug },
      markdown: stored?.markdown ?? "",
      warnings: [],
    };
  }

  async savePage(
    id: string,
    expectedRevision: number,
    input: PageWriteInput,
  ): Promise<PageSaveResult> {
    this.assertRevision(expectedRevision);

    const placement = this.locate(id);
    if (!placement) {
      throw new StoreRequestError("page-not-found", `No page with id "${id}".`, 404);
    }

    const stored = this.pages.get(id);
    const frontmatter = input.frontmatter ?? stored?.frontmatter ?? { title: placement.slug };
    const markdown = input.markdown ?? stored?.markdown ?? "";

    // Both fields omitted, or a write that reproduces exactly what is already
    // stored, must not burn a revision — mirrors the file store's autosave
    // no-op rule.
    const noFieldsSent = input.frontmatter === undefined && input.markdown === undefined;
    const reproducesStored =
      stored !== undefined &&
      frontmatterEquals(stored.frontmatter, frontmatter) &&
      stored.markdown === markdown;
    if (noFieldsSent || reproducesStored) {
      return {
        id,
        slug: placement.slug,
        categoryId: placement.categoryId,
        revision: this.revision,
        frontmatter,
        markdown,
        warnings: [],
        changed: false,
      };
    }

    this.pages.set(id, { frontmatter, markdown });
    this.revision += 1;

    return {
      id,
      slug: placement.slug,
      categoryId: placement.categoryId,
      revision: this.revision,
      frontmatter,
      markdown,
      warnings: [],
      changed: true,
    };
  }

  /** Test-only: commits an outline command as if another client had already saved it. */
  applyExternalOutlineCommand(command: OutlineCommand): void {
    const result = applyCommand(this.outline, command, {
      ...(this.createId ? { createId: this.createId } : {}),
    });
    if (!result.ok) {
      throw new Error(`applyExternalOutlineCommand: ${result.code} — ${result.message}`);
    }
    if (!result.changed) return;
    this.outline = result.doc;
    this.revision += 1;
    this.applyPageLifecycle(command, result.meta?.createdPage);
  }

  /** Test-only: commits a page write as if another client had already saved it. */
  applyExternalPageWrite(id: string, input: PageWriteInput): void {
    const placement = this.locate(id);
    if (!placement) throw new Error(`applyExternalPageWrite: no page with id "${id}".`);
    const stored = this.pages.get(id);
    const frontmatter = input.frontmatter ?? stored?.frontmatter ?? { title: placement.slug };
    const markdown = input.markdown ?? stored?.markdown ?? "";
    this.pages.set(id, { frontmatter, markdown });
    this.revision += 1;
  }

  getRevision(): number {
    return this.revision;
  }

  private assertRevision(expected: number): void {
    if (expected === this.revision) return;
    throw new RevisionConflictError(
      `Project is at revision ${this.revision}, but the request expected ${expected}.`,
      this.compose(),
    );
  }

  private locate(pageId: string): { slug: string; categoryId: string } | null {
    for (const category of this.outline.categories) {
      const page = category.pages.find((candidate) => candidate.id === pageId);
      if (page) return { slug: page.slug, categoryId: category.id };
    }
    return null;
  }

  private compose(): ProjectSnapshot {
    const pages: PageSummary[] = [];
    for (const category of this.outline.categories) {
      for (const page of category.pages) {
        const stored = this.pages.get(page.id);
        const frontmatter = stored?.frontmatter ?? { title: page.slug };
        pages.push({
          id: page.id,
          slug: page.slug,
          categoryId: category.id,
          title: frontmatter.title,
          ...(frontmatter.description !== undefined
            ? { description: frontmatter.description }
            : {}),
          ...(frontmatter.draft !== undefined ? { draft: frontmatter.draft } : {}),
        });
      }
    }
    return {
      slug: this.slug,
      title: this.title,
      revision: this.revision,
      outline: this.outline,
      pages,
    };
  }

  /** Keeps the in-memory page map consistent with add/remove outline commands. */
  private applyPageLifecycle(
    command: OutlineCommand,
    createdPage: CreatedPageMeta | undefined,
  ): void {
    switch (command.type) {
      case "add-page": {
        if (!createdPage || this.pages.has(createdPage.id)) return;
        this.pages.set(createdPage.id, { frontmatter: { title: createdPage.title }, markdown: "" });
        return;
      }
      case "remove-page": {
        this.pages.delete(command.pageId);
        return;
      }
      default:
        return;
    }
  }
}

export function createMemoryProjectStore(
  options: MemoryProjectStoreOptions,
): MemoryProjectStore {
  return new MemoryProjectStore(options);
}

function frontmatterEquals(a: PageFrontmatter, b: PageFrontmatter): boolean {
  return a.title === b.title && a.description === b.description && a.draft === b.draft;
}
