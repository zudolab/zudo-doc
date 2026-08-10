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
import { scopeStorage, type KeyValueStorage } from "../features/editor/persistence.js";
import { readOpenTabIds } from "../features/editor/tabs-state.js";
import { LEGACY_FALLBACK_SLUG } from "./project.js";
import { routeProjectSlug, type Route } from "./router.js";

export function resolveEditorEntryPageId(
  route: Route,
  snapshot: ProjectSnapshot | null,
  storedTabIds: readonly string[],
): string | null {
  if (snapshot === null) {
    // Nothing to validate against yet. The route the user is on is the only
    // information available, and it is better than disabling the item.
    return route.name === "editor" ? route.pageId : null;
  }

  const known = new Set(snapshot.pages.map((page) => page.id));
  // Where the user actually is wins — but only while that page still exists.
  // A page deleted underneath them (by another tab or an MCP agent) must fall
  // through to a real fallback rather than pinning the item to the
  // page-not-found route the user is already stuck on.
  if (route.name === "editor" && known.has(route.pageId)) return route.pageId;

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

export interface EditorEntryResult {
  pageId: string | null;
  /** The active project's snapshot title, or `null` outside project context
   * or before the first snapshot arrives — the shell hides its label then. */
  projectTitle: string | null;
}

export function useEditorEntryPageId(
  route: Route,
  { store, events, storage }: UseEditorEntryPageIdOptions,
): EditorEntryResult {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);

  useEffect(() => {
    // A new `store` means a new project (route slug changed) — drop the
    // previous project's snapshot immediately. Without this, the "older
    // response is dropped" guard below would compare revisions ACROSS two
    // unrelated projects' independent counters and could keep the old
    // project's snapshot on screen indefinitely.
    setSnapshot(null);
    if (store === null) return undefined;
    let cancelled = false;

    const read = (): void => {
      void store.loadSnapshot().then(
        (next) => {
          if (cancelled) return;
          // Two reads can be in flight at once (the stream opening while an
          // outline event lands, or two events in quick succession) and they
          // settle in whatever order the network decides. The server's
          // revision is the only ordering both agree on, so an older response
          // arriving last is dropped rather than restoring a stale page list —
          // the same rule `use-outline-surface.ts` applies to its snapshot.
          setSnapshot((current) =>
            current !== null && next.revision < current.revision ? current : next,
          );
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
    // `onOpen` alone, never paired with `onReconnect`: it fires on EVERY
    // successful connection, so subscribing both would run two full snapshot
    // reads per reconnect.
    const releaseOpen = events.onOpen(() => read());
    return () => {
      cancelled = true;
      releaseEvent();
      releaseOpen();
    };
  }, [store, events]);

  const projectSlug = routeProjectSlug(route);
  if (projectSlug === null) return { pageId: null, projectTitle: null };

  const scopedStorage = scopeStorage(projectSlug, LEGACY_FALLBACK_SLUG, storage);
  const pageId = resolveEditorEntryPageId(route, snapshot, readOpenTabIds(scopedStorage));
  return { pageId, projectTitle: snapshot?.title ?? null };
}
