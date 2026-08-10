/**
 * The outline surface's one piece of state: a project snapshot, the mutation
 * path that keeps it current, and the two things that can go wrong.
 *
 * Three behaviours are worth reading before changing anything here.
 *
 * **Every mutation goes through the coordinator.** `store` is expected to be
 * the coordinated store (`revision-coordinator.ts`), so callers never pass a
 * revision they captured earlier — `coordinator.currentRevision` is handed
 * over at dispatch time and the coordinator substitutes its own tracked value
 * anyway. That is what stops two quick clicks in this tab from manufacturing
 * a conflict against each other.
 *
 * **A 409 is a decision, never a retry.** Epic #3327 contract 2 forbids
 * auto-retry: the losing mutation is held with the banner, and the user picks
 * "adopt latest" (take the server's outline, drop my change) or "retry"
 * (re-send my change on top of theirs). The snapshot is rebased immediately
 * ONLY when nothing is being edited — with an inline editor open, rebasing
 * would pull the row out from under the user mid-keystroke, so the tree is
 * left alone and the refresh is deferred.
 *
 * **A live refresh never clobbers an open editor.** An MCP agent or a second
 * tab restructuring the project fires SSE events; on a clean surface those
 * refresh straight away, but while `beginEditing()` is outstanding the
 * refresh is queued and the "changed elsewhere" banner goes up instead. The
 * queued refresh runs the moment the last editor closes. This is the surface
 * half of the same dirty-guard the page save machine implements for bodies.
 */

import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { OutlineCommand } from "../../core/outline/index.js";
import {
  RevisionConflictError,
  StoreRequestError,
  type ProjectSnapshot,
  type ProjectStore,
} from "../../store/contract.js";
import {
  bindCoordinatorToEvents,
  type ProjectEventsClient,
} from "../../store/events.js";
import type { RevisionCoordinator } from "../../store/revision-coordinator.js";
import {
  describeCommand,
  findPageSummary,
  renamedFrontmatter,
  withPageFrontmatter,
} from "./outline-actions.js";
import type { OutlineDispatch, OutlineDispatchResult } from "./view-props.js";

export type OutlineStatus = "loading" | "ready" | "error";

/**
 * What the structure save chip reports. `no-change` is its own state on
 * purpose: a command the server accepted but that changed nothing burned no
 * revision, and claiming "Saved" for it would be a small lie the chip is
 * specifically there not to tell.
 */
export type OutlineSaveState =
  | "idle"
  | "saving"
  | "saved"
  | "no-change"
  | "error"
  | "conflict";

export interface OutlineProblem {
  code: string;
  message: string;
}

/**
 * A mutation the surface can send — and, after a 409, re-send.
 *
 * The page variant carries the user's INTENT (a new title), never a baked
 * frontmatter block: a re-send has to be rebuilt against whatever the server
 * holds at retry time, or it would revert the very remote edit that caused
 * the conflict.
 */
export type PendingMutation =
  | { kind: "outline"; label: string; command: OutlineCommand }
  | { kind: "page-title"; label: string; pageId: string; title: string };

export interface OutlineConflictState {
  mutation: PendingMutation;
  message: string;
  /**
   * The server state the 409 carried. A retry rebuilds its payload from this
   * rather than from the pre-conflict copy, which is what stops "retry my
   * change" from reverting whatever the other client just wrote.
   */
  latest: ProjectSnapshot;
  /**
   * True when an editor was open at the moment of the 409, so the displayed
   * outline was deliberately NOT rebased onto the server's.
   */
  keptDraft: boolean;
}

export interface OutlineSurface {
  status: OutlineStatus;
  snapshot: ProjectSnapshot | null;
  /** A load or refresh failure. Non-fatal once a snapshot is on screen. */
  problem: OutlineProblem | null;
  saveState: OutlineSaveState;
  saveError: OutlineProblem | null;
  conflict: OutlineConflictState | null;
  /** Someone else changed the project while an editor was open here. */
  remoteChanged: boolean;
  dispatch: OutlineDispatch;
  /** Page titles are frontmatter, not outline structure (contract 1). */
  renamePage(pageId: string, title: string): Promise<OutlineDispatchResult>;
  refresh(): Promise<void>;
  /** Opens a dirty-guard lease; call the returned function to release it. */
  beginEditing(): () => void;
  adoptLatest(): void;
  retryConflict(): Promise<void>;
}

export interface UseOutlineSurfaceOptions {
  /** Expected to be the coordinated store, not a raw provider. */
  store: ProjectStore;
  coordinator: RevisionCoordinator;
  /** Omit to run without a live change stream (tests, offline). */
  events?: ProjectEventsClient | null;
}

export function useOutlineSurface({
  store,
  coordinator,
  events = null,
}: UseOutlineSurfaceOptions): OutlineSurface {
  const [snapshot, setSnapshotState] = useState<ProjectSnapshot | null>(null);
  const [status, setStatus] = useState<OutlineStatus>("loading");
  const [problem, setProblem] = useState<OutlineProblem | null>(null);
  const [saveState, setSaveState] = useState<OutlineSaveState>("idle");
  const [saveError, setSaveError] = useState<OutlineProblem | null>(null);
  const [conflict, setConflict] = useState<OutlineConflictState | null>(null);
  const [remoteChanged, setRemoteChanged] = useState(false);

  const mountedRef = useRef(true);
  const snapshotRef = useRef<ProjectSnapshot | null>(null);
  const editingRef = useRef(0);
  const pendingRefreshRef = useRef(false);
  /** Guards against an older in-flight load overwriting a newer one. */
  const refreshTokenRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * The one gate every writer goes through — initial load, refresh, mutation
   * response, conflict rebase. Responses settle out of order (a refresh that
   * started before a mutation can land after it, and an SSE-triggered refetch
   * races both), and an older snapshot arriving last would pin the surface to
   * stale state until the next change happened to arrive. The server's
   * revision is the only ordering the two channels agree on, so it decides.
   */
  const setSnapshot = useCallback((next: ProjectSnapshot) => {
    const current = snapshotRef.current;
    if (current !== null && next.revision < current.revision) return;
    snapshotRef.current = next;
    setSnapshotState(next);
  }, []);

  const refresh = useCallback(async () => {
    const token = (refreshTokenRef.current += 1);
    try {
      const next = await store.loadSnapshot();
      if (!mountedRef.current || token !== refreshTokenRef.current) return;
      pendingRefreshRef.current = false;
      setSnapshot(next);
      setStatus("ready");
      setProblem(null);
      setRemoteChanged(false);
    } catch (error) {
      if (!mountedRef.current || token !== refreshTokenRef.current) return;
      setProblem(describeStoreError(error));
      // A failed refresh must not blank a tree that is already on screen.
      setStatus(snapshotRef.current === null ? "error" : "ready");
    }
  }, [store, setSnapshot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRemoteChange = useCallback(() => {
    if (editingRef.current > 0) {
      pendingRefreshRef.current = true;
      setRemoteChanged(true);
      return;
    }
    void refresh();
  }, [refresh]);

  // Held in a ref so the SSE subscription below never re-subscribes (which
  // would tear down and reopen the connection) just because a callback
  // identity changed.
  const remoteChangeRef = useRef(handleRemoteChange);
  useEffect(() => {
    remoteChangeRef.current = handleRemoteChange;
  }, [handleRemoteChange]);

  useEffect(() => {
    if (events === null) return undefined;
    const releaseCoordinator = bindCoordinatorToEvents(coordinator, events);
    const releaseEvents = events.onEvent(({ origin }) => {
      if (origin === "remote") remoteChangeRef.current();
    });
    // A reconnect means events were missed while disconnected, so the local
    // snapshot has to be treated as stale even without an event to prove it.
    const releaseReconnect = events.onReconnect(() => remoteChangeRef.current());
    // The same reasoning applies to the FIRST connection, which `onReconnect`
    // deliberately skips: the initial `loadSnapshot()` above runs before the
    // stream is open, and SSE replays nothing, so a commit landing in that gap
    // is missed forever. `onOpen` covers every successful connection.
    const releaseOpen = events.onOpen(() => remoteChangeRef.current());
    events.connect();
    return () => {
      releaseCoordinator();
      releaseEvents();
      releaseReconnect();
      releaseOpen();
      events.close();
    };
  }, [events, coordinator]);

  const beginEditing = useCallback(() => {
    editingRef.current += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      editingRef.current = Math.max(0, editingRef.current - 1);
      if (editingRef.current === 0 && pendingRefreshRef.current) {
        void refresh();
      }
    };
  }, [refresh]);

  const runMutation = useCallback(
    async (
      mutation: PendingMutation,
      /** Set on a retry: the server state the 409 carried. */
      rebaseFrom: ProjectSnapshot | null,
    ): Promise<OutlineDispatchResult> => {
      setSaveState("saving");
      setSaveError(null);
      try {
        // The ref, not its current value: a queued mutation must patch the
        // snapshot that exists when it RESOLVES, not the one that existed
        // when it was enqueued.
        const applied = await applyMutation(
          store,
          coordinator,
          () => snapshotRef.current,
          mutation,
          rebaseFrom,
        );
        if (!mountedRef.current) return applied.result;
        setSnapshot(applied.snapshot);
        setSaveState(
          applied.result.ok && applied.result.changed ? "saved" : "no-change",
        );
        // A retry that lands clears the banner it was launched from; an
        // unrelated success leaves it up, because the failed change is still
        // unapplied and still needs a decision.
        if (rebaseFrom !== null) setConflict(null);
        return applied.result;
      } catch (error) {
        const described = describeStoreError(error);
        const isConflict = error instanceof RevisionConflictError;
        const failure: OutlineDispatchResult = {
          ok: false,
          code: described.code,
          message: described.message,
          conflict: isConflict,
        };
        if (!mountedRef.current) return failure;

        if (isConflict) {
          const clean = editingRef.current === 0;
          if (clean) {
            setSnapshot(error.snapshot);
          } else {
            // Rebase later, once the editor that is holding the guard closes.
            pendingRefreshRef.current = true;
            setRemoteChanged(true);
          }
          setConflict({
            mutation,
            message: described.message,
            latest: error.snapshot,
            keptDraft: !clean,
          });
          setSaveState("conflict");
        } else {
          setSaveError(described);
          setSaveState("error");
        }
        return failure;
      }
    },
    [store, coordinator, setSnapshot],
  );

  const dispatch = useCallback<OutlineDispatch>(
    (command) =>
      runMutation(
        { kind: "outline", label: describeCommand(command), command },
        null,
      ),
    [runMutation],
  );

  const renamePage = useCallback(
    async (pageId: string, title: string): Promise<OutlineDispatchResult> => {
      const current = snapshotRef.current;
      const page = current === null ? null : findPageSummary(current, pageId);
      if (page === null) {
        const described: OutlineProblem = {
          code: "page-not-found",
          message: `No page with id "${pageId}".`,
        };
        setSaveError(described);
        setSaveState("error");
        return { ok: false, ...described, conflict: false };
      }
      return runMutation(
        { kind: "page-title", label: `Rename “${page.title}”`, pageId, title },
        null,
      );
    },
    [runMutation],
  );

  const adoptLatest = useCallback(() => {
    setConflict(null);
    setSaveState("idle");
    pendingRefreshRef.current = false;
    void refresh();
  }, [refresh]);

  const retryConflict = useCallback(async () => {
    if (conflict === null) return;
    await runMutation(conflict.mutation, conflict.latest);
  }, [conflict, runMutation]);

  return {
    status,
    snapshot,
    problem,
    saveState,
    saveError,
    conflict,
    remoteChanged,
    dispatch,
    renamePage,
    refresh,
    beginEditing,
    adoptLatest,
    retryConflict,
  };
}

interface AppliedMutation {
  snapshot: ProjectSnapshot;
  result: OutlineDispatchResult;
}

async function applyMutation(
  store: ProjectStore,
  coordinator: RevisionCoordinator,
  readSnapshot: () => ProjectSnapshot | null,
  mutation: PendingMutation,
  rebaseFrom: ProjectSnapshot | null,
): Promise<AppliedMutation> {
  if (mutation.kind === "outline") {
    const outcome = await store.applyOutlineCommand(
      coordinator.currentRevision,
      mutation.command,
    );
    return {
      snapshot: outcome.snapshot,
      result: {
        ok: true,
        changed: outcome.changed,
        selectedId: outcome.selectedId,
        ...(outcome.createdPage === undefined
          ? {}
          : { createdPageId: outcome.createdPage.id }),
      },
    };
  }

  // `savePage` replaces the frontmatter block wholesale, so the other fields
  // have to be re-read from the freshest state available at SEND time. On a
  // retry that is the snapshot the 409 carried (`rebaseFrom`), not the
  // pre-conflict copy the first attempt used — otherwise accepting "retry my
  // change" would quietly revert the remote description or draft edit that
  // caused the conflict in the first place.
  const rebaseBase = rebaseFrom ?? readSnapshot();
  const page = rebaseBase === null ? null : findPageSummary(rebaseBase, mutation.pageId);
  if (page === null) {
    throw new StoreRequestError(
      "page-not-found",
      `No page with id "${mutation.pageId}".`,
      404,
    );
  }
  const frontmatter = renamedFrontmatter(page, mutation.title);
  const saved = await store.savePage(mutation.pageId, coordinator.currentRevision, {
    frontmatter,
  });

  // A page write returns the page, not the project, so patch the one page
  // that changed rather than refetching everything — reading the snapshot
  // here (after the write settled) rather than before it was queued, so an
  // earlier queued mutation's result is not discarded.
  const base = readSnapshot();
  const next =
    base === null
      ? await store.loadSnapshot()
      : withPageFrontmatter(
          base,
          mutation.pageId,
          frontmatter,
          Math.max(base.revision, saved.revision),
        );
  return { snapshot: next, result: { ok: true, changed: saved.changed } };
}

export function describeStoreError(error: unknown): OutlineProblem {
  if (error instanceof StoreRequestError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "internal-error",
    message: error instanceof Error ? error.message : String(error),
  };
}
