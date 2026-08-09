/**
 * Pure outline commands.
 *
 * Every command is `(doc, command, context) -> CommandResult`. Nothing throws:
 * failures come back as `{ ok: false, code }` with a stable code, because these
 * results are serialized straight onto REST responses and MCP tool output.
 *
 * The input outline is never mutated. A command that changes something clones
 * the outline through JSON and mutates the copy; a command that changes nothing
 * returns the input reference with `changed: false`, so a caller may treat
 * reference identity as "nothing happened".
 *
 * Explicit slugs are validated but never auto-deduped — a caller that names a
 * slug gets that slug or an error, never a silently renamed one. Slugs derived
 * from a title do dedupe, because there the caller expressed no preference.
 */

import { outlinesEqual } from "./revision";
import {
  deriveUniqueSlug,
  validateSlug,
  type SlugIssue,
} from "./slugs";
import {
  OUTLINE_SCHEMA_VERSION,
  type AddCategoryCommand,
  type AddPageCommand,
  type Category,
  type CommandContext,
  type CommandFailure,
  type CommandResult,
  type IdFactory,
  type MoveCategoryCommand,
  type MovePageCommand,
  type OutlineCommand,
  type OutlineDoc,
  type OutlineErrorCode,
  type PageRef,
  type RemoveCategoryCommand,
  type RemovePageCommand,
  type RenameCategoryCommand,
  type ReorderPagesCommand,
  type ReplaceDocCommand,
  type SetPageSlugCommand,
} from "./types";

export const defaultIdFactory: IdFactory = (kind) =>
  `${kind}-${globalThis.crypto.randomUUID()}`;

const SLUG_ISSUE_CODES: Record<SlugIssue, OutlineErrorCode> = {
  empty: "slug-empty",
  "too-long": "slug-too-long",
  "not-normalized": "slug-not-normalized",
  "not-lowercase": "slug-not-lowercase",
  "invalid-characters": "slug-invalid-characters",
};

export function applyCommand(
  doc: OutlineDoc,
  command: OutlineCommand,
  context: CommandContext = {},
): CommandResult {
  const selectedId = context.selectedId ?? null;
  const createId = context.createId ?? defaultIdFactory;

  if (typeof command !== "object" || command === null) {
    return fail("unknown-command", "An outline command object is required.");
  }

  try {
    switch (command.type) {
      case "add-category":
        return addCategory(doc, command, createId);
      case "rename-category":
        return renameCategory(doc, command, selectedId);
      case "remove-category":
        return removeCategory(doc, command, selectedId);
      case "move-category":
        return moveCategory(doc, command, selectedId);
      case "add-page":
        return addPage(doc, command, createId);
      case "set-page-slug":
        return setPageSlug(doc, command, selectedId);
      case "remove-page":
        return removePage(doc, command, selectedId);
      case "move-page":
        return movePage(doc, command, selectedId);
      case "reorder-pages":
        return reorderPages(doc, command, selectedId);
      case "replace-doc":
        return replaceDoc(doc, command, selectedId);
      default:
        return fail(
          "unknown-command",
          `Unknown outline command: ${JSON.stringify(
            (command as { type?: unknown }).type,
          )}.`,
        );
    }
  } catch (error) {
    // The only realistic source is a non-JSON-safe input outline (a cycle
    // defeats the clone). Surfacing it as a result keeps the never-throw
    // contract intact for callers that forward these straight to a client.
    return fail(
      "invalid-doc",
      `Outline command failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function addCategory(
  doc: OutlineDoc,
  command: AddCategoryCommand,
  createId: IdFactory,
): CommandResult {
  const title = normalizeTitle(command.title);
  if (title === null) {
    return fail("invalid-title", "A category needs a non-empty title.");
  }

  const slug = resolveSlug(
    command.slug,
    title,
    doc.categories.map((category) => category.slug),
    "outline",
  );
  if (!slug.ok) return slug;

  const id = createId("category");
  const next = cloneDoc(doc);
  next.categories.push({ id, slug: slug.slug, title, pages: [] });
  return { ok: true, doc: next, selectedId: id, changed: true };
}

function renameCategory(
  doc: OutlineDoc,
  command: RenameCategoryCommand,
  selectedId: string | null,
): CommandResult {
  const current = findCategory(doc, command.categoryId);
  if (!current) return categoryNotFound(command.categoryId);

  const title = normalizeTitle(command.title);
  if (title === null) {
    return fail("invalid-title", "A category needs a non-empty title.");
  }
  if (current.title === title) return unchanged(doc, selectedId);

  // The slug is left alone on purpose: it is a published URL segment, and
  // there is no `set-category-slug` command precisely because changing it is
  // a migration, not a rename.
  const next = cloneDoc(doc);
  const target = findCategory(next, command.categoryId);
  if (!target) return categoryNotFound(command.categoryId);
  target.title = title;
  return { ok: true, doc: next, selectedId, changed: true };
}

function removeCategory(
  doc: OutlineDoc,
  command: RemoveCategoryCommand,
  selectedId: string | null,
): CommandResult {
  const category = findCategory(doc, command.categoryId);
  if (!category) return categoryNotFound(command.categoryId);

  const index = doc.categories.indexOf(category);
  const selectionRemoved =
    selectedId !== null &&
    (selectedId === category.id ||
      category.pages.some((page) => page.id === selectedId));

  const next = cloneDoc(doc);
  next.categories.splice(index, 1);

  const repaired = selectionRemoved
    ? ((next.categories[index] ?? next.categories[index - 1])?.id ?? null)
    : selectedId;

  return { ok: true, doc: next, selectedId: repaired, changed: true };
}

function moveCategory(
  doc: OutlineDoc,
  command: MoveCategoryCommand,
  selectedId: string | null,
): CommandResult {
  const category = findCategory(doc, command.categoryId);
  if (!category) return categoryNotFound(command.categoryId);

  const fromIndex = doc.categories.indexOf(category);
  if (!isIndexInRange(command.toIndex, doc.categories.length - 1)) {
    return indexOutOfRange(command.toIndex, doc.categories.length - 1);
  }
  if (command.toIndex === fromIndex) return unchanged(doc, selectedId);

  const next = cloneDoc(doc);
  const [moved] = next.categories.splice(fromIndex, 1);
  if (!moved) return categoryNotFound(command.categoryId);
  next.categories.splice(command.toIndex, 0, moved);
  return { ok: true, doc: next, selectedId, changed: true };
}

function addPage(
  doc: OutlineDoc,
  command: AddPageCommand,
  createId: IdFactory,
): CommandResult {
  const category = findCategory(doc, command.categoryId);
  if (!category) return categoryNotFound(command.categoryId);

  const title = normalizeTitle(command.title);
  if (title === null) {
    return fail("invalid-title", "A page needs a non-empty title.");
  }

  let id: string;
  if (command.pageId === undefined) {
    id = createId("page");
  } else {
    const explicit =
      typeof command.pageId === "string" ? command.pageId.trim() : "";
    if (explicit.length === 0) {
      return fail("invalid-page-id", "pageId must be a non-empty string.");
    }
    if (collectIds(doc).has(explicit)) {
      return fail("page-id-conflict", `Id "${explicit}" is already in use.`);
    }
    id = explicit;
  }

  const slug = resolveSlug(
    command.slug,
    title,
    category.pages.map((page) => page.slug),
    "category",
  );
  if (!slug.ok) return slug;

  const next = cloneDoc(doc);
  const target = findCategory(next, command.categoryId);
  if (!target) return categoryNotFound(command.categoryId);
  target.pages.push({ id, slug: slug.slug });

  return {
    ok: true,
    doc: next,
    selectedId: id,
    changed: true,
    meta: { createdPage: { id, slug: slug.slug, title } },
  };
}

function setPageSlug(
  doc: OutlineDoc,
  command: SetPageSlugCommand,
  selectedId: string | null,
): CommandResult {
  const owner = findPageOwner(doc, command.pageId);
  if (!owner) return pageNotFound(command.pageId);

  const issue = validateSlug(command.slug);
  if (issue) return slugFailure(issue, command.slug);

  const page = owner.pages.find((candidate) => candidate.id === command.pageId);
  if (!page) return pageNotFound(command.pageId);
  if (page.slug === command.slug) return unchanged(doc, selectedId);

  const conflict = owner.pages.some(
    (candidate) =>
      candidate.id !== command.pageId && candidate.slug === command.slug,
  );
  if (conflict) {
    return fail(
      "slug-conflict",
      `Slug "${command.slug}" is already used in category "${owner.slug}".`,
    );
  }

  const next = cloneDoc(doc);
  const target = findPage(next, command.pageId);
  if (!target) return pageNotFound(command.pageId);
  target.slug = command.slug;
  return { ok: true, doc: next, selectedId, changed: true };
}

function removePage(
  doc: OutlineDoc,
  command: RemovePageCommand,
  selectedId: string | null,
): CommandResult {
  const owner = findPageOwner(doc, command.pageId);
  if (!owner) return pageNotFound(command.pageId);

  const next = cloneDoc(doc);
  const target = findCategory(next, owner.id);
  if (!target) return pageNotFound(command.pageId);

  const index = target.pages.findIndex((page) => page.id === command.pageId);
  target.pages.splice(index, 1);

  const repaired =
    selectedId === command.pageId
      ? ((target.pages[index] ?? target.pages[index - 1])?.id ?? target.id)
      : selectedId;

  return { ok: true, doc: next, selectedId: repaired, changed: true };
}

function movePage(
  doc: OutlineDoc,
  command: MovePageCommand,
  selectedId: string | null,
): CommandResult {
  const owner = findPageOwner(doc, command.pageId);
  if (!owner) return pageNotFound(command.pageId);

  const target = findCategory(doc, command.toCategoryId);
  if (!target) return categoryNotFound(command.toCategoryId);

  const page = owner.pages.find((candidate) => candidate.id === command.pageId);
  if (!page) return pageNotFound(command.pageId);

  const sameCategory = owner.id === target.id;
  const fromIndex = owner.pages.indexOf(page);
  // Within a category the page vacates its slot first, so the last valid
  // index is one lower than when appending into a different category.
  const maxIndex = sameCategory ? owner.pages.length - 1 : target.pages.length;
  if (!isIndexInRange(command.toIndex, maxIndex)) {
    return indexOutOfRange(command.toIndex, maxIndex);
  }

  if (
    !sameCategory &&
    target.pages.some((candidate) => candidate.slug === page.slug)
  ) {
    return fail(
      "slug-conflict",
      `Slug "${page.slug}" is already used in category "${target.slug}".`,
    );
  }

  if (sameCategory && command.toIndex === fromIndex) {
    return unchanged(doc, selectedId);
  }

  const next = cloneDoc(doc);
  const nextOwner = findCategory(next, owner.id);
  const nextTarget = findCategory(next, target.id);
  if (!nextOwner || !nextTarget) return pageNotFound(command.pageId);

  const [moved] = nextOwner.pages.splice(fromIndex, 1);
  if (!moved) return pageNotFound(command.pageId);
  nextTarget.pages.splice(command.toIndex, 0, moved);

  return { ok: true, doc: next, selectedId, changed: true };
}

function reorderPages(
  doc: OutlineDoc,
  command: ReorderPagesCommand,
  selectedId: string | null,
): CommandResult {
  const category = findCategory(doc, command.categoryId);
  if (!category) return categoryNotFound(command.categoryId);

  const currentIds = category.pages.map((page) => page.id);
  const ordered = command.orderedPageIds;
  if (!isPermutationOf(currentIds, ordered)) {
    return fail(
      "invalid-page-order",
      `orderedPageIds must list every page of category "${category.slug}" exactly once.`,
    );
  }
  if (currentIds.every((id, index) => ordered[index] === id)) {
    return unchanged(doc, selectedId);
  }

  const next = cloneDoc(doc);
  const target = findCategory(next, command.categoryId);
  if (!target) return categoryNotFound(command.categoryId);

  const byId = new Map(target.pages.map((page) => [page.id, page]));
  const reordered: PageRef[] = [];
  for (const id of ordered) {
    const page = byId.get(id);
    if (page) reordered.push(page);
  }
  target.pages = reordered;

  return { ok: true, doc: next, selectedId, changed: true };
}

function replaceDoc(
  doc: OutlineDoc,
  command: ReplaceDocCommand,
  selectedId: string | null,
): CommandResult {
  const problem = validateOutlineDoc(command.doc);
  if (problem !== null) return fail("invalid-doc", problem);

  const normalized = normalizeDoc(command.doc);
  if (outlinesEqual(doc, normalized)) return unchanged(doc, selectedId);

  const ids = collectIds(normalized);
  const repaired = selectedId !== null && ids.has(selectedId) ? selectedId : null;
  return { ok: true, doc: normalized, selectedId: repaired, changed: true };
}

/**
 * Checks a candidate outline field by field. Returns a human-readable reason,
 * or null when the value is a well-formed outline.
 */
export function validateOutlineDoc(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "An outline must be an object.";
  }

  const candidate = value as Partial<OutlineDoc>;
  if (candidate.schemaVersion !== OUTLINE_SCHEMA_VERSION) {
    return `Unsupported schemaVersion: expected ${OUTLINE_SCHEMA_VERSION}, received ${JSON.stringify(candidate.schemaVersion)}.`;
  }
  if (normalizeTitle(candidate.projectTitle) === null) {
    return "projectTitle must be a non-empty string.";
  }
  if (!Array.isArray(candidate.categories)) {
    return "categories must be an array.";
  }

  const ids = new Set<string>();
  const categorySlugs = new Set<string>();

  for (const rawCategory of candidate.categories) {
    if (
      typeof rawCategory !== "object" ||
      rawCategory === null ||
      Array.isArray(rawCategory)
    ) {
      return "Every category must be an object.";
    }
    const category = rawCategory as Partial<Category>;

    const categoryId =
      typeof category.id === "string" ? category.id.trim() : "";
    if (categoryId.length === 0) {
      return "Every category needs a non-empty id.";
    }
    if (ids.has(categoryId)) return `Duplicate id "${categoryId}".`;
    ids.add(categoryId);

    if (normalizeTitle(category.title) === null) {
      return `Category "${categoryId}" needs a non-empty title.`;
    }

    const categorySlugIssue = validateSlug(category.slug);
    if (categorySlugIssue !== null) {
      return `Category "${categoryId}" has an invalid slug (${categorySlugIssue}).`;
    }
    const categorySlug = category.slug as string;
    if (categorySlugs.has(categorySlug)) {
      return `Duplicate category slug "${categorySlug}".`;
    }
    categorySlugs.add(categorySlug);

    if (!Array.isArray(category.pages)) {
      return `Category "${categoryId}" needs a pages array.`;
    }

    const pageSlugs = new Set<string>();
    for (const rawPage of category.pages) {
      if (
        typeof rawPage !== "object" ||
        rawPage === null ||
        Array.isArray(rawPage)
      ) {
        return `Every page of category "${categoryId}" must be an object.`;
      }
      const page = rawPage as Partial<PageRef>;

      const pageId = typeof page.id === "string" ? page.id.trim() : "";
      if (pageId.length === 0) {
        return `Every page of category "${categoryId}" needs a non-empty id.`;
      }
      // Categories and pages share one id namespace so a selection id is
      // never ambiguous.
      if (ids.has(pageId)) return `Duplicate id "${pageId}".`;
      ids.add(pageId);

      const pageSlugIssue = validateSlug(page.slug);
      if (pageSlugIssue !== null) {
        return `Page "${pageId}" has an invalid slug (${pageSlugIssue}).`;
      }
      const pageSlug = page.slug as string;
      if (pageSlugs.has(pageSlug)) {
        return `Duplicate page slug "${pageSlug}" in category "${categoryId}".`;
      }
      pageSlugs.add(pageSlug);
    }
  }

  return null;
}

/** Rebuilds a validated outline into canonical shape, dropping stray fields. */
export function normalizeDoc(doc: OutlineDoc): OutlineDoc {
  return {
    schemaVersion: OUTLINE_SCHEMA_VERSION,
    projectTitle: doc.projectTitle.trim(),
    categories: doc.categories.map((category) => ({
      id: category.id.trim(),
      slug: category.slug,
      title: category.title.trim(),
      pages: category.pages.map((page) => ({
        id: page.id.trim(),
        slug: page.slug,
      })),
    })),
  };
}

/** Every category and page id in the outline. */
export function collectIds(doc: OutlineDoc): Set<string> {
  const ids = new Set<string>();
  for (const category of doc.categories) {
    ids.add(category.id);
    for (const page of category.pages) ids.add(page.id);
  }
  return ids;
}

export function findCategory(
  doc: OutlineDoc,
  categoryId: string,
): Category | undefined {
  return doc.categories.find((category) => category.id === categoryId);
}

export function findPageOwner(
  doc: OutlineDoc,
  pageId: string,
): Category | undefined {
  return doc.categories.find((category) =>
    category.pages.some((page) => page.id === pageId),
  );
}

export function findPage(doc: OutlineDoc, pageId: string): PageRef | undefined {
  return findPageOwner(doc, pageId)?.pages.find((page) => page.id === pageId);
}

type SlugResolution = { ok: true; slug: string } | CommandFailure;

function resolveSlug(
  explicit: string | undefined,
  title: string,
  taken: string[],
  scope: "outline" | "category",
): SlugResolution {
  if (explicit === undefined) {
    return { ok: true, slug: deriveUniqueSlug(title, taken) };
  }

  const issue = validateSlug(explicit);
  if (issue !== null) return slugFailure(issue, explicit);
  if (taken.includes(explicit)) {
    return fail(
      "slug-conflict",
      `Slug "${explicit}" is already used in this ${scope}.`,
    );
  }
  return { ok: true, slug: explicit };
}

function slugFailure(issue: SlugIssue, slug: unknown): CommandFailure {
  return fail(
    SLUG_ISSUE_CODES[issue],
    `Invalid slug ${JSON.stringify(slug)} (${issue}).`,
  );
}

function normalizeTitle(title: unknown): string | null {
  if (typeof title !== "string") return null;
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isIndexInRange(value: unknown, maxIndex: number): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= maxIndex
  );
}

function isPermutationOf(current: string[], candidate: unknown): boolean {
  if (!Array.isArray(candidate)) return false;
  if (candidate.length !== current.length) return false;
  const remaining = new Set(current);
  for (const id of candidate) {
    if (typeof id !== "string" || !remaining.delete(id)) return false;
  }
  return remaining.size === 0;
}

/** JSON round-trip: enforces JSON-safety and detaches every nested object. */
function cloneDoc(doc: OutlineDoc): OutlineDoc {
  return JSON.parse(JSON.stringify(doc)) as OutlineDoc;
}

function unchanged(doc: OutlineDoc, selectedId: string | null): CommandResult {
  return { ok: true, doc, selectedId, changed: false };
}

function fail(code: OutlineErrorCode, message: string): CommandFailure {
  return { ok: false, code, message };
}

function categoryNotFound(categoryId: string): CommandFailure {
  return fail("category-not-found", `No category with id "${categoryId}".`);
}

function pageNotFound(pageId: string): CommandFailure {
  return fail("page-not-found", `No page with id "${pageId}".`);
}

function indexOutOfRange(value: unknown, maxIndex: number): CommandFailure {
  return fail(
    "index-out-of-range",
    `toIndex must be an integer between 0 and ${maxIndex}, received ${JSON.stringify(value)}.`,
  );
}
