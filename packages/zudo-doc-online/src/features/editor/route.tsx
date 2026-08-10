/**
 * The `#/editor/:pageId` route: bootstraps the project store and hands the
 * workspace chrome everything it needs.
 *
 * Route-file ownership contract (epic #3327): this is the editor feature's
 * OWN stub file — `src/app/routes.tsx` and `src/app/router.ts` stay untouched.
 *
 * The bootstrap order below is the only one that is correct, and each step
 * depends on the previous one's result:
 *
 * 1. Build an HTTP provider for the project.
 * 2. `loadSnapshot()` — the first read is also how we learn the project's
 *    current revision.
 * 3. Wrap the provider in a coordinated store seeded with that revision, so
 *    every mutation the workspace makes is serialized behind one always-fresh
 *    `expectedRevision` (`revision-coordinator.ts`).
 * 4. Open the SSE stream and bind the coordinator to it, so a commit by
 *    another client (or the MCP agent surface) moves this tab's revision
 *    forward instead of manufacturing a 409 on the next save.
 *
 * The snapshot is refetched on an `outline-changed` event from anyone, and on
 * a REMOTE `page-changed`. It is deliberately NOT refetched on our own
 * `page-changed`: every autosave fires one, and the open page's own title
 * already reaches the rail through the live save machine
 * (`overlayPageMeta`) — refetching there would mean a snapshot GET per
 * keystroke burst for information this tab already has.
 */

import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { navigateTo } from "../../app/router";
import {
  ProjectEventsClient,
  StoreRequestError,
  bindCoordinatorToEvents,
  createCoordinatedStore,
  createHttpProjectStore,
  getClientId,
  type ProjectSnapshot,
  type ProjectStore,
} from "../../store/index";
import { EditorWorkspace } from "./workspace";

interface Bootstrap {
  store: ProjectStore;
  events: ProjectEventsClient;
}

export interface EditorRouteProps {
  projectSlug: string;
  pageId: string;
  /**
   * Test seams, mirroring `features/popout/popout-window.tsx`. Factories
   * rather than instances because `boot()` re-runs per retry attempt and must
   * get a fresh provider/stream each time. Read once at boot, so changing
   * either after mount has no effect until "Try again".
   */
  createStore?: () => ProjectStore;
  createEvents?: () => ProjectEventsClient;
}

export default function EditorRoute({
  projectSlug,
  pageId,
  createStore,
  createEvents,
}: EditorRouteProps) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const refreshing = useRef(false);
  const refreshQueued = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let events: ProjectEventsClient | null = null;

    async function boot(): Promise<void> {
      try {
        const provider =
          createStore?.() ?? createHttpProjectStore({ projectSlug });
        const initial = await provider.loadSnapshot();
        if (cancelled) return;

        const { store, coordinator } = createCoordinatedStore(provider, initial.revision);
        events =
          createEvents?.() ??
          new ProjectEventsClient({
            projectSlug,
            clientId: getClientId(),
          });
        const unbindCoordinator = bindCoordinatorToEvents(coordinator, events);

        const refresh = async (): Promise<void> => {
          // An event that lands mid-refresh is REMEMBERED, not dropped: the
          // in-flight read may have been issued before that mutation
          // committed, so finishing it would leave the UI permanently one
          // revision behind until some unrelated event happened along.
          if (refreshing.current) {
            refreshQueued.current = true;
            return;
          }
          refreshing.current = true;
          try {
            const next = await store.loadSnapshot();
            if (!cancelled) setSnapshot(next);
          } catch {
            // A failed refresh leaves the last good snapshot on screen; the
            // events client's own reconnect will trigger another one.
          } finally {
            refreshing.current = false;
          }
          if (refreshQueued.current && !cancelled) {
            refreshQueued.current = false;
            await refresh();
          }
        };

        const unsubscribe = events.onEvent(({ event, origin }) => {
          if (event.type === "outline-changed" || origin === "remote") void refresh();
        });
        // Step 2's snapshot was read BEFORE the stream existed, and SSE has no
        // replay: a commit landing in that gap would otherwise never reach
        // this tab. `onOpen` closes it the moment the connection is confirmed
        // live — and because it fires on EVERY successful connection, it also
        // covers the reconnect case, which is why `onReconnect` is deliberately
        // NOT subscribed alongside it (that would refetch twice per reconnect).
        const unsubscribeOpen = events.onOpen(() => void refresh());
        events.connect();

        setSnapshot(initial);
        setBootstrap({ store, events });

        cleanup = () => {
          unsubscribe();
          unsubscribeOpen();
          unbindCoordinator();
        };
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof StoreRequestError
            ? caught.message
            : "The editing server could not be reached. Start it with `pnpm dev:server`.",
        );
      }
    }

    let cleanup: (() => void) | undefined;
    void boot();

    return () => {
      cancelled = true;
      cleanup?.();
      events?.close();
    };
  }, [projectSlug, attempt]);

  if (error !== null) {
    return (
      <StatusPane title="The project could not be loaded">
        <p className="text-body text-muted">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setAttempt((value) => value + 1);
          }}
          className="rounded-sm border border-border-strong px-hsp-md py-vsp-2xs text-small font-semibold text-fg-mild hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        >
          Try again
        </button>
      </StatusPane>
    );
  }

  if (bootstrap === null || snapshot === null) {
    return (
      <StatusPane title="Opening the project…">
        <p className="text-body text-muted">Loading the outline and page index.</p>
      </StatusPane>
    );
  }

  return (
    <EditorWorkspace
      snapshot={snapshot}
      store={bootstrap.store}
      events={bootstrap.events}
      routePageId={pageId}
      onNavigate={(nextPageId) => {
        // No page left to show: the outline is the only other surface that
        // makes sense to land on, and it is where a new page gets created.
        if (nextPageId === null) navigateTo({ name: "outline", projectSlug });
        else navigateTo({ name: "editor", projectSlug, pageId: nextPageId });
      }}
      onSnapshotChanged={setSnapshot}
    />
  );
}

function StatusPane({
  title,
  children,
}: {
  title: string;
  children: ComponentChildren;
}) {
  return (
    <section className="flex h-full flex-col items-center justify-center gap-vsp-xs p-hsp-xl text-center">
      <h1 className="text-title font-semibold">{title}</h1>
      {children}
    </section>
  );
}
