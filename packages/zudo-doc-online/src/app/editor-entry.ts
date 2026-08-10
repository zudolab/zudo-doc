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
import type { ProjectEventsClient } from "../store/events.js";
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
  /**
   * Keeps the target current. The shell outlives every surface, so a one-shot
   * read would go stale the moment the outline changed underneath it — the
   * target page could be deleted (a link that 404s again) or the first page
   * could be added (an item stuck disabled) with no route change to notice
   * either. Omit to read once and never refresh.
   */
  events?: ProjectEventsClient | null;
  /** Test seam; defaults to the ambient `localStorage` when there is one. */
  storage?: KeyValueStorage | null;
}

export function useEditorEntryPageId(
  route: Route,
  { store, events, storage }: UseEditorEntryPageIdOptions,
): string | null {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);

  useEffect(() => {
    if (store === null) return undefined;
    let cancelled = false;

    const read = (): void => {
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
    };

    read();
    if (!events) {
      return () => {
        cancelled = true;
      };
    }

    // `outline-changed` only — that is the one event class that adds or
    // removes pages. Re-reading on `page-changed` too would mean a full
    // snapshot GET per autosave burst for information this link never uses.
    // Origin is deliberately ignored: a page THIS tab just deleted moves the
    // target exactly as much as a remote agent's deletion does.
    const releaseEvent = events.onEvent(({ event }) => {
      if (event.type === "outline-changed") read();
    });
    const releaseOpen = events.onOpen(() => read());
    return () => {
      cancelled = true;
      releaseEvent();
      releaseOpen();
    };
  }, [store, events]);

  return resolveEditorEntryPageId(route, snapshot, readOpenTabIds(storage));
}
