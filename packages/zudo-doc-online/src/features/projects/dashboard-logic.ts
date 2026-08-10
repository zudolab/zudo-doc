/**
 * Pure helpers for the D3 master-detail dashboard (#3350) — kept free of
 * Preact so the ordering/filtering/entry-resolution rules are unit-testable
 * without mounting the surface.
 */

import type { PageSummary } from "../../store/contract";
import type { ProjectDirectorySnapshot, ProjectListEntry } from "../../store/projects-directory";
import { readOpenTabIds } from "../editor/tabs-state";
import { scopeStorage, type KeyValueStorage } from "../editor/persistence";
import { LEGACY_FALLBACK_SLUG } from "../../app/project";

/** Case-insensitive name match — the rail's live search rule (#3350 spec). */
export function filterProjects(
  projects: readonly ProjectListEntry[],
  query: string,
): ProjectListEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [...projects];
  return projects.filter((project) => project.title.toLowerCase().includes(needle));
}

export interface OrderedPage extends PageSummary {
  /** The owning category's title, for the row's secondary line. */
  categoryTitle: string;
}

/**
 * The detail pane's pages list, in OUTLINE order — never "recent by edit
 * time" (epic #3345: no per-page timestamps exist to sort by). Walks the
 * outline's categories and joins each `PageRef` with its `PageSummary` by id;
 * a summary the outline does not reference (should not happen, but the two
 * arrive as separate arrays) is appended at the end rather than dropped.
 */
export function outlineOrderedPages(
  snapshot: ProjectDirectorySnapshot,
): OrderedPage[] {
  const byId = new Map(snapshot.pages.map((page) => [page.id, page]));
  const ordered: OrderedPage[] = [];
  const seen = new Set<string>();

  for (const category of snapshot.outline.categories) {
    for (const ref of category.pages) {
      const summary = byId.get(ref.id);
      if (summary === undefined) continue;
      ordered.push({ ...summary, categoryTitle: category.title });
      seen.add(ref.id);
    }
  }

  for (const summary of snapshot.pages) {
    if (seen.has(summary.id)) continue;
    const category = snapshot.outline.categories.find(
      (candidate) => candidate.id === summary.categoryId,
    );
    ordered.push({ ...summary, categoryTitle: category?.title ?? "" });
  }

  return ordered;
}

/**
 * The page the detail pane's "Open editor" button lands on: the remembered
 * tab via the project-scoped persistence, else the first page in outline
 * order, else `null` (no pages — the button renders disabled).
 *
 * "Remembered" reuses `app/editor-entry.ts`'s rule verbatim: the LAST entry
 * of the persisted open-tab list that still exists is the newest tab
 * `openTab()` appended — the closest thing to "last opened" the app tracks
 * (the active tab itself lives in the route, not in storage).
 */
export function resolveOpenEditorPageId(
  snapshot: ProjectDirectorySnapshot,
  storage?: KeyValueStorage | null,
): string | null {
  const ordered = outlineOrderedPages(snapshot);
  const known = new Set(ordered.map((page) => page.id));
  const scoped = scopeStorage(snapshot.slug, LEGACY_FALLBACK_SLUG, storage);
  const storedIds = readOpenTabIds(scoped);

  for (let index = storedIds.length - 1; index >= 0; index -= 1) {
    const id = storedIds[index];
    if (id !== undefined && known.has(id)) return id;
  }
  return ordered[0]?.id ?? null;
}

/**
 * A human-readable date for `createdAt`/`updatedAt`, or `null` when the
 * value is absent or unparsable — old projects have no timestamps, and the
 * spec is explicit: show nothing rather than a fake value.
 */
export function formatTimestamp(iso: string | undefined): string | null {
  if (iso === undefined) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}
