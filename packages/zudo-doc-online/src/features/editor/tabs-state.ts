/**
 * The tab strip's state, as pure transitions.
 *
 * The route (`#/editor/:pageId`) — not this module — owns which tab is
 * active: every transition here is applied to local state and the ACTIVE id
 * it produces is what the workspace then pushes back into the hash. Keeping
 * the derivation pure is what makes the two directions agree; the "deep link
 * opens that tab" requirement is just `syncTabsToRoute` running on mount.
 *
 * Every function returns the SAME state object when nothing changed. The
 * workspace runs these inside effects that also call `onNavigate`, so
 * reference equality is what stops a sync effect from looping.
 *
 * `knownIds` (the page ids the current project snapshot actually has) is a
 * required argument on both sync paths rather than an optional filter: a tab
 * for a page that no longer exists would be pruned on the next snapshot and
 * re-opened by the next route sync, forever.
 */

import {
  OPEN_TABS_STORAGE_KEY,
  readStoredValue,
  writeStoredValue,
  type KeyValueStorage,
} from "./persistence";

export interface TabsState {
  readonly openIds: readonly string[];
  readonly activeId: string | null;
}

export const EMPTY_TABS: TabsState = { openIds: [], activeId: null };

/** Opens `pageId` (appending it at the end) without activating it. */
export function openTab(state: TabsState, pageId: string): TabsState {
  if (state.openIds.includes(pageId)) return state;
  return { openIds: [...state.openIds, pageId], activeId: state.activeId };
}

/** Activates an already-open tab, or opens then activates it. */
export function activateTab(state: TabsState, pageId: string): TabsState {
  const alreadyOpen = state.openIds.includes(pageId);
  if (alreadyOpen && state.activeId === pageId) return state;
  return {
    openIds: alreadyOpen ? state.openIds : [...state.openIds, pageId],
    activeId: pageId,
  };
}

/**
 * Closes a tab. When the closed tab was active, focus falls to the tab that
 * slid into its index (the one on its right), and to the new last tab when it
 * was the rightmost — the behavior every tabbed editor has trained users to
 * expect. Closing the last remaining tab yields a null active id, which the
 * workspace reads as "leave the editor".
 */
export function closeTab(state: TabsState, pageId: string): TabsState {
  const index = state.openIds.indexOf(pageId);
  if (index === -1) return state;

  const openIds = state.openIds.filter((id) => id !== pageId);
  if (state.activeId !== pageId) return { openIds, activeId: state.activeId };

  return { openIds, activeId: openIds[index] ?? openIds[openIds.length - 1] ?? null };
}

/**
 * Brings tab state in line with the route. A route pointing at a page the
 * snapshot does not have is left alone entirely — the workspace renders a
 * "page not found" pane instead, which is honest and, unlike opening a
 * phantom tab, cannot fight `pruneTabs`.
 */
export function syncTabsToRoute(
  state: TabsState,
  pageId: string,
  knownIds: ReadonlySet<string>,
): TabsState {
  if (!knownIds.has(pageId)) return state;
  return activateTab(state, pageId);
}

/** Drops tabs whose page has disappeared (deleted here or by another client). */
export function pruneTabs(state: TabsState, knownIds: ReadonlySet<string>): TabsState {
  const openIds = state.openIds.filter((id) => knownIds.has(id));
  if (openIds.length === state.openIds.length) return state;

  if (state.activeId !== null && knownIds.has(state.activeId)) {
    return { openIds, activeId: state.activeId };
  }
  const index = state.activeId === null ? -1 : state.openIds.indexOf(state.activeId);
  const fallback =
    index === -1
      ? openIds[0]
      : (state.openIds.slice(index + 1).find((id) => knownIds.has(id)) ??
        [...state.openIds.slice(0, index)].reverse().find((id) => knownIds.has(id)));

  return { openIds, activeId: fallback ?? null };
}

/** The tab to move to for a left/right arrow press on the strip. */
export function neighbourTab(
  state: TabsState,
  direction: "previous" | "next",
): string | null {
  if (state.activeId === null) return state.openIds[0] ?? null;
  const index = state.openIds.indexOf(state.activeId);
  if (index === -1) return state.openIds[0] ?? null;
  const step = direction === "next" ? 1 : -1;
  const wrapped = (index + step + state.openIds.length) % state.openIds.length;
  return state.openIds[wrapped] ?? null;
}

/**
 * Rebuilds tab state on mount: the persisted set, filtered to pages that
 * still exist and de-duplicated, with the route's page opened and active.
 */
export function restoreTabs(
  storedIds: readonly string[],
  routePageId: string,
  knownIds: ReadonlySet<string>,
): TabsState {
  const openIds: string[] = [];
  for (const id of storedIds) {
    if (knownIds.has(id) && !openIds.includes(id)) openIds.push(id);
  }
  return syncTabsToRoute({ openIds, activeId: null }, routePageId, knownIds);
}

export function readOpenTabIds(storage?: KeyValueStorage | null): string[] {
  const raw = readStoredValue(OPEN_TABS_STORAGE_KEY, storage);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

export function writeOpenTabIds(
  ids: readonly string[],
  storage?: KeyValueStorage | null,
): void {
  writeStoredValue(OPEN_TABS_STORAGE_KEY, JSON.stringify(ids), storage);
}
