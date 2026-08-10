/**
 * The `#/` route: the D3 master-detail projects dashboard (epic #3345,
 * sub-issue #3350) — replaces the wave-1 placeholder wholesale.
 *
 * Route-file ownership contract (epic #3327 / #3345): `src/app/routes.tsx`
 * and `router.ts` stay the shell's — this is this feature's own file.
 *
 * Data + freshness rules (#3350 spec):
 * - Rail: `listProjects({summary: true})`; detail: `getProject(slug)` — both
 *   through the wave-1 projects-directory store seam (#3348).
 * - Refetch on REMOTE `projects-changed` SSE events (own-origin events are
 *   skipped — every own mutation below already refetches explicitly), on
 *   every SSE open/reconnect signal (`onOpen` fires on BOTH, closing the
 *   fetch-before-subscribe race — see `projects-events.ts`'s header), and on
 *   window focus.
 * - A selected project deleted remotely comes back from `getProject` as
 *   `project-not-found`: the handler refetches the list, and the selection
 *   maintenance in `refreshList` falls back to the first remaining project
 *   rather than erroring.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { formatRoute } from "../../app/router";
import {
  StoreRequestError,
  createHttpProjectsDirectoryStore,
  subscribeProjectsChanged,
  type ProjectDirectorySnapshot,
  type ProjectListEntry,
  type ProjectsDirectoryStore,
  type SubscribeProjectsChangedListener,
} from "../../store/index";
import type { KeyValueStorage } from "../editor/persistence";
import { filterProjects } from "./dashboard-logic";
import { useCurrentColorScheme } from "./pack-swatch";
import { ProjectsRail } from "./rail";
import { DetailPane } from "./detail-pane";
import "./projects-chrome.css";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; projects: ProjectListEntry[] };

type DetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: ProjectDirectorySnapshot };

const TRY_AGAIN_CLASSES =
  "rounded-sm border border-border-strong px-hsp-md py-vsp-2xs text-small font-semibold text-fg-mild hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const CTA_CLASSES =
  "inline-flex items-center gap-hsp-xs rounded-md bg-accent px-hsp-lg py-vsp-xs text-small font-semibold text-accent-fg shadow-1 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

export interface ProjectsRouteProps {
  /** Test seam: injectable so a spec never performs a real network call. */
  createStore?: () => ProjectsDirectoryStore;
  /** Test seam for the global projects SSE stream; defaults to the real client. */
  subscribeProjects?: (listener: SubscribeProjectsChangedListener) => () => void;
  /** Test seam for the remembered-tab lookup; defaults to `localStorage`. */
  storage?: KeyValueStorage | null;
}

export default function ProjectsRoute({
  createStore,
  subscribeProjects,
  storage,
}: ProjectsRouteProps = {}) {
  const store = useMemo<ProjectsDirectoryStore>(
    () => createStore?.() ?? createHttpProjectsDirectoryStore(),
    // The seam is read once at mount, mirroring EditorRoute's factories.
    [],
  );

  const [list, setList] = useState<ListState>({ status: "loading" });
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState>({ status: "idle" });
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<"duplicate" | "delete" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [detailTick, setDetailTick] = useState(0);
  const mode = useCurrentColorScheme();

  const selectedRef = useRef(selectedSlug);
  selectedRef.current = selectedSlug;
  const listEpoch = useRef(0);
  const detailEpoch = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refreshList = useCallback(async (): Promise<void> => {
    const epoch = ++listEpoch.current;
    try {
      const projects = await store.listProjects({ summary: true });
      if (!mounted.current || epoch !== listEpoch.current) return;
      setList({ status: "ready", projects });
      const current = selectedRef.current;
      if (current === null || !projects.some((entry) => entry.slug === current)) {
        // Nothing selected yet, or the selection vanished (deleted remotely):
        // fall back to the first project — or none, which renders the
        // zero-projects call-to-action.
        setSelectedSlug(projects[0]?.slug ?? null);
      }
    } catch (error) {
      if (!mounted.current || epoch !== listEpoch.current) return;
      // A failed REFRESH keeps the last good list on screen (mirrors
      // EditorRoute's refresh); only a never-loaded list shows the error pane.
      setList((current) =>
        current.status === "ready" ? current : { status: "error", message: messageOf(error) },
      );
    }
  }, [store]);

  const refreshAll = useCallback((): void => {
    void refreshList();
    setDetailTick((tick) => tick + 1);
  }, [refreshList]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  // Detail fetch — re-runs on selection change and on every freshness tick.
  useEffect(() => {
    if (selectedSlug === null) {
      setDetail({ status: "idle" });
      return undefined;
    }
    let cancelled = false;
    const epoch = ++detailEpoch.current;
    // Keep the current snapshot on screen during a same-project refresh;
    // switching projects shows the loading state immediately.
    setDetail((current) =>
      current.status === "ready" && current.snapshot.slug === selectedSlug
        ? current
        : { status: "loading" },
    );
    store.getProject(selectedSlug).then(
      (snapshot) => {
        if (cancelled || epoch !== detailEpoch.current) return;
        setDetail({ status: "ready", snapshot });
      },
      (error: unknown) => {
        if (cancelled || epoch !== detailEpoch.current) return;
        if (error instanceof StoreRequestError && error.code === "project-not-found") {
          // Deleted underneath us — refetch the list; its selection
          // maintenance moves us to a project that still exists.
          void refreshList();
          return;
        }
        setDetail({ status: "error", message: messageOf(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedSlug, detailTick, store, refreshList]);

  // Global projects SSE stream: refetch on remote changes and on every
  // open/reconnect. Own-origin events are skipped — the mutation handlers
  // below already refetch, and refetching twice per action is just noise.
  useEffect(() => {
    const subscribe =
      subscribeProjects ?? ((listener) => subscribeProjectsChanged(listener));
    return subscribe({
      onEvent: ({ origin }) => {
        if (origin === "remote") refreshAll();
      },
      onOpen: () => refreshAll(),
    });
  }, [refreshAll]);

  useEffect(() => {
    const onFocus = (): void => refreshAll();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshAll]);

  // Selection change resets transient per-project UI state.
  useEffect(() => {
    setConfirmingDelete(false);
    setActionError(null);
  }, [selectedSlug]);

  const handleSelect = useCallback((slug: string): void => {
    setSelectedSlug(slug);
  }, []);

  const handleDuplicate = useCallback(async (): Promise<void> => {
    const slug = selectedRef.current;
    if (slug === null) return;
    setBusy("duplicate");
    setActionError(null);
    try {
      const created = await store.duplicateProject(slug);
      if (!mounted.current) return;
      // Select the new project (spec: duplicate-then-select), then refresh
      // the rail so the new row exists to show as selected.
      setSelectedSlug(created.slug);
      selectedRef.current = created.slug;
      await refreshList();
    } catch (error) {
      if (mounted.current) setActionError(messageOf(error));
    } finally {
      if (mounted.current) setBusy(null);
    }
  }, [store, refreshList]);

  const handleConfirmDelete = useCallback(async (): Promise<void> => {
    const slug = selectedRef.current;
    if (slug === null) return;
    setBusy("delete");
    setActionError(null);
    try {
      await store.deleteProject(slug);
      if (!mounted.current) return;
      setConfirmingDelete(false);
      setSelectedSlug(null);
      selectedRef.current = null;
      await refreshList();
    } catch (error) {
      if (mounted.current) setActionError(messageOf(error));
    } finally {
      if (mounted.current) setBusy(null);
    }
  }, [store, refreshList]);

  if (list.status === "loading") {
    return (
      <StatusPane title="Loading projects…">
        <p className="text-body text-muted">Fetching the project directory.</p>
      </StatusPane>
    );
  }

  if (list.status === "error") {
    return (
      <StatusPane title="The projects could not be loaded">
        <p className="text-body text-muted">{list.message}</p>
        <button
          type="button"
          onClick={() => {
            setList({ status: "loading" });
            refreshAll();
          }}
          className={TRY_AGAIN_CLASSES}
        >
          Try again
        </button>
      </StatusPane>
    );
  }

  if (list.projects.length === 0) {
    return (
      <StatusPane title="Create your first project">
        <p className="text-body text-muted">
          There are no projects yet. The wizard sets up a name and a theme — everything
          else is editable later.
        </p>
        <a href={formatRoute({ name: "new-project" })} className={CTA_CLASSES}>
          New project
        </a>
      </StatusPane>
    );
  }

  return (
    <div className="zdo-projects flex h-full min-h-0">
      <ProjectsRail
        projects={list.projects}
        visible={filterProjects(list.projects, query)}
        query={query}
        onQueryChange={setQuery}
        selectedSlug={selectedSlug}
        onSelect={handleSelect}
        mode={mode}
      />
      {detail.status === "ready" ? (
        <DetailPane
          snapshot={detail.snapshot}
          mode={mode}
          busy={busy}
          confirmingDelete={confirmingDelete}
          onRequestDelete={() => setConfirmingDelete(true)}
          onCancelDelete={() => setConfirmingDelete(false)}
          onConfirmDelete={() => void handleConfirmDelete()}
          onDuplicate={() => void handleDuplicate()}
          actionError={actionError}
          storage={storage}
        />
      ) : detail.status === "error" ? (
        <div className="min-w-0 flex-1 overflow-y-auto bg-bg">
          <StatusPane title="The project could not be loaded">
            <p className="text-body text-muted">{detail.message}</p>
            <button
              type="button"
              onClick={() => setDetailTick((tick) => tick + 1)}
              className={TRY_AGAIN_CLASSES}
            >
              Try again
            </button>
          </StatusPane>
        </div>
      ) : (
        <div className="min-w-0 flex-1 overflow-y-auto bg-bg">
          <StatusPane title="Opening the project…">
            <p className="text-body text-muted">Loading the outline and page index.</p>
          </StatusPane>
        </div>
      )}
    </div>
  );
}

function messageOf(error: unknown): string {
  return error instanceof StoreRequestError
    ? error.message
    : "The editing server could not be reached. Start it with `pnpm dev:server`.";
}

/** Mirrors EditorRoute's boot-error pane — the #3350 spec's named precedent. */
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
