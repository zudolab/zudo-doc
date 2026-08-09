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

/**
 * The slug the local API server seeds on first boot (`seedIfEmpty` derives it
 * from the sample project's title). Multi-project selection is out of scope
 * for this epic — see #3327's non-goals — so the editor opens the one project
 * that exists.
 */
const PROJECT_SLUG = "aurora-docs";

interface Bootstrap {
  store: ProjectStore;
  events: ProjectEventsClient;
}

export interface EditorRouteProps {
  pageId: string;
}

export default function EditorRoute({ pageId }: EditorRouteProps) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const refreshing = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let events: ProjectEventsClient | null = null;

    async function boot(): Promise<void> {
      try {
        const provider = createHttpProjectStore({ projectSlug: PROJECT_SLUG });
        const initial = await provider.loadSnapshot();
        if (cancelled) return;

        const { store, coordinator } = createCoordinatedStore(provider, initial.revision);
        events = new ProjectEventsClient({
          projectSlug: PROJECT_SLUG,
          clientId: getClientId(),
        });
        const unbindCoordinator = bindCoordinatorToEvents(coordinator, events);

        const refresh = async (): Promise<void> => {
          if (refreshing.current) return;
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
        };

        const unsubscribe = events.onEvent(({ event, origin }) => {
          if (event.type === "outline-changed" || origin === "remote") void refresh();
        });
        const unsubscribeReconnect = events.onReconnect(() => void refresh());
        events.connect();

        setSnapshot(initial);
        setBootstrap({ store, events });

        cleanup = () => {
          unsubscribe();
          unsubscribeReconnect();
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
  }, [attempt]);

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
        if (nextPageId === null) navigateTo({ name: "outline" });
        else navigateTo({ name: "editor", pageId: nextPageId });
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
