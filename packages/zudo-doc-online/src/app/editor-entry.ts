/**
 * Which page the shell's "Editor" nav link opens.
 *
 * The link needs a page ID, not a URL path: `#/editor/:pageId` is matched
 * against ids like `page-getting-started-installation`, so a slug-shaped guess
 * (`getting-started/installation`) resolves to nothing and lands the user on
 * the workspace's page-not-found pane. The id therefore has to come from real
 * project state, in this order:
 *
 * 1. The page the editor route is already showing — while the user is editing,
 *    the nav item must point at where they are, not somewhere else.
 * 2. The most recently opened tab that still exists. The editor persists its
 *    open-tab list (`features/editor/tabs-state.ts`), and its last entry is
 *    the newest tab `openTab()` appended — the closest thing to "last opened"
 *    the app tracks, since the active tab itself lives in the route, not in
 *    storage.
 * 3. The project's first page.
 * 4. Nothing — no snapshot yet, no project, or a project with no pages. The
 *    shell renders the item as disabled instead of linking to a page that does
 *    not exist.
 */

import { useEffect, useState } from "preact/hooks";
import type { ProjectSnapshot, ProjectStore } from "../store/contract.js";
import type { KeyValueStorage } from "../features/editor/persistence.js";
import { readOpenTabIds } from "../features/editor/tabs-state.js";
import type { Route } from "./router.js";

export function resolveEditorEntryPageId(
  route: Route,
  snapshot: ProjectSnapshot | null,
  storedTabIds: readonly string[],
): string | null {
  if (route.name === "editor") return route.pageId;
  if (snapshot === null) return null;

  const known = new Set(snapshot.pages.map((page) => page.id));
  for (let index = storedTabIds.length - 1; index >= 0; index -= 1) {
    const id = storedTabIds[index];
    if (id !== undefined && known.has(id)) return id;
  }
  return snapshot.pages[0]?.id ?? null;
}

export interface UseEditorEntryPageIdOptions {
  /** `null` means "no snapshot to consult" — the item stays disabled. */
  store: ProjectStore | null;
  /** Test seam; defaults to the ambient `localStorage` when there is one. */
  storage?: KeyValueStorage | null;
}

export function useEditorEntryPageId(
  route: Route,
  { store, storage }: UseEditorEntryPageIdOptions,
): string | null {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);

  useEffect(() => {
    if (store === null) return undefined;
    let cancelled = false;
    void store.loadSnapshot().then(
      (next) => {
        if (!cancelled) setSnapshot(next);
      },
      () => {
        // A nav link is not the place to report a dead server: the surface
        // being navigated to says so itself, with a retry. The item simply
        // stays disabled until a snapshot arrives.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [store]);

  return resolveEditorEntryPageId(route, snapshot, readOpenTabIds(storage));
}
