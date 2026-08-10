/**
 * One editing session per OPEN TAB — not per visible pane.
 *
 * The tab strip has to show a dirty dot for every open page, and switching
 * tabs must not throw away an unsaved draft or a pending conflict. Both fall
 * out of keeping the `PageSaveMachine` alive for as long as the tab is open,
 * which is what this registry owns: `open()` loads the page and builds its
 * machine, `close()` retires it (see that method — a pending write outlives
 * the tab), and nothing in between depends on which tab happens to be
 * rendered.
 *
 * It deliberately holds no Preact state. The workspace subscribes with
 * `useSyncExternalStore`, so `getSnapshot()` must return a stable reference
 * while nothing changed — hence the cached `sessions` map, rebuilt only on a
 * real transition rather than on every call.
 *
 * The `generation` counter guards the one race that matters here: a tab
 * closed (or closed and reopened) while its `loadPage` was still in flight.
 * Without it, the stale response would resurrect a session the user already
 * dismissed, or clobber the newer one.
 */

import {
  StoreRequestError,
  PageSaveMachine,
  bindPageSaveMachine,
  type PagePayload,
  type ProjectEventsClient,
  type ProjectStore,
  type SaveMachineSnapshot,
} from "../../store/index";
import { hasPendingWrite } from "./save-status";

/** Leak guard for a closed tab whose write neither succeeds nor fails. */
const RETIRE_TIMEOUT_MS = 10_000;

export type PageSessionStatus = "loading" | "ready" | "error";

export interface PageSessionError {
  code: string;
  message: string;
}

export interface PageSession {
  pageId: string;
  status: PageSessionStatus;
  /** Present once the page loaded; the UI edits exclusively through it. */
  machine?: PageSaveMachine;
  /** The machine's latest snapshot, mirrored so rendering never polls. */
  save?: SaveMachineSnapshot;
  /** Set when the initial load failed — `reload()` is the way out. */
  error?: PageSessionError;
  slug?: string;
  categoryId?: string;
}

export type PageSessionsListener = () => void;

export interface PageSessionRegistryOptions {
  store: ProjectStore;
  /** Omitted in tests and whenever the SSE stream is not connected. */
  events?: ProjectEventsClient | null;
  /** Forwarded to every machine; the machine's own default is 500ms. */
  debounceMs?: number;
}

interface SessionRecord {
  session: PageSession;
  generation: number;
  unbind?: () => void;
  unsubscribe?: () => void;
}

export class PageSessionRegistry {
  private readonly store: ProjectStore;
  private readonly events: ProjectEventsClient | null;
  private readonly debounceMs: number | undefined;
  private readonly records = new Map<string, SessionRecord>();
  private readonly listeners = new Set<PageSessionsListener>();
  /** Closed sessions still finishing a write; each entry abandons one. */
  private readonly retiring = new Set<() => void>();

  private snapshot: ReadonlyMap<string, PageSession> = new Map();
  private generation = 0;

  constructor(options: PageSessionRegistryOptions) {
    this.store = options.store;
    this.events = options.events ?? null;
    this.debounceMs = options.debounceMs;
  }

  getSnapshot(): ReadonlyMap<string, PageSession> {
    return this.snapshot;
  }

  get(pageId: string): PageSession | undefined {
    return this.snapshot.get(pageId);
  }

  subscribe(listener: PageSessionsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Idempotent: re-opening an already-open tab must not restart its load. */
  open(pageId: string): void {
    if (this.records.has(pageId)) return;
    this.startLoad(pageId);
  }

  /** Retries a failed initial load. A ready session is left untouched. */
  reload(pageId: string): void {
    const record = this.records.get(pageId);
    if (record && record.session.status !== "error") return;
    this.teardown(pageId);
    this.startLoad(pageId);
  }

  /**
   * Closes a tab. A machine still holding a pending write is NOT disposed
   * immediately: `dispose()` clears the debounce timer, so closing a tab
   * inside the ~500ms autosave window would silently swallow the edit. The
   * session leaves the published snapshot at once (the tab disappears) while
   * the machine keeps running just long enough for its write to land.
   *
   * Only `dirty`/`saving` are waited on — `error` and `conflict` never settle
   * without an explicit retry/discard, so the caller is expected to have
   * confirmed the discard before closing one of those.
   */
  close(pageId: string): void {
    const record = this.records.get(pageId);
    if (!record) return;
    this.records.delete(pageId);
    this.publish();
    this.retire(record);
  }

  /**
   * Tears the whole registry down — the workspace unmounted (navigating to
   * the outline, say). Every session is RETIRED rather than disposed, for the
   * same reason `close()` retires one: disposing clears the debounce timer, so
   * an edit made inside the ~500ms autosave window would vanish silently just
   * because the user changed surface. Sessions already retiring from an
   * earlier `close()` are left to finish too — `retire()`'s own timeout is the
   * leak guard, so nothing here has to cut them short.
   */
  dispose(): void {
    for (const [pageId, record] of [...this.records]) {
      this.records.delete(pageId);
      this.retire(record);
    }
    this.listeners.clear();
    this.publish();
  }

  // ---------------------------------------------------------------- internals

  private startLoad(pageId: string): void {
    this.generation += 1;
    const generation = this.generation;
    this.records.set(pageId, {
      session: { pageId, status: "loading" },
      generation,
    });
    this.publish();

    void this.load(pageId, generation);
  }

  private async load(pageId: string, generation: number): Promise<void> {
    try {
      const payload = await this.store.loadPage(pageId);
      if (!this.isCurrent(pageId, generation)) return;
      this.installMachine(pageId, generation, payload);
    } catch (error) {
      if (!this.isCurrent(pageId, generation)) return;
      this.update(pageId, {
        pageId,
        status: "error",
        error:
          error instanceof StoreRequestError
            ? { code: error.code, message: error.message }
            : {
                code: "network-error",
                message: error instanceof Error ? error.message : String(error),
              },
      });
    }
  }

  private installMachine(
    pageId: string,
    generation: number,
    payload: PagePayload,
  ): void {
    const machine = new PageSaveMachine({
      pageId,
      store: this.store,
      initial: payload,
      ...(this.debounceMs === undefined ? {} : { debounceMs: this.debounceMs }),
    });

    const record: SessionRecord = {
      generation,
      session: {
        pageId,
        status: "ready",
        machine,
        save: machine.getSnapshot(),
        slug: payload.slug,
        categoryId: payload.categoryId,
      },
    };
    record.unsubscribe = machine.subscribe((save) => {
      const current = this.records.get(pageId);
      if (!current || current.generation !== generation) return;
      this.update(pageId, { ...current.session, save });
    });
    if (this.events) record.unbind = bindPageSaveMachine(machine, this.events);

    this.records.set(pageId, record);
    this.publish();
  }

  private isCurrent(pageId: string, generation: number): boolean {
    return this.records.get(pageId)?.generation === generation;
  }

  private update(pageId: string, session: PageSession): void {
    const record = this.records.get(pageId);
    if (!record) return;
    record.session = session;
    this.publish();
  }

  private teardown(pageId: string): void {
    const record = this.records.get(pageId);
    if (!record) return;
    record.unbind?.();
    record.unsubscribe?.();
    record.session.machine?.dispose();
    // Deleting the record is itself what strands an in-flight load: its
    // `isCurrent` check can no longer find a matching generation.
    this.records.delete(pageId);
  }

  /**
   * Detaches a closed session, letting a pending write finish first. The
   * timeout is a leak guard, not a policy: a write that has neither succeeded
   * nor failed within it is not going to, and holding the machine open
   * forever would keep an unreachable page's timer alive.
   */
  private retire(record: SessionRecord): void {
    record.unbind?.();
    record.unsubscribe?.();

    const machine = record.session.machine;
    if (!machine || !hasPendingWrite(record.session.save?.status)) {
      machine?.dispose();
      return;
    }

    // Send the debounced draft NOW. The surface that owned this machine is
    // gone, so there are no further keystrokes to coalesce, and leaving the
    // write to a timer only widens the window in which it could be lost.
    // A no-op unless the machine is `dirty` — a save already in flight is
    // simply waited on below.
    machine.flush();

    let finish = (): void => undefined;
    const stopWatching = machine.subscribe((save) => {
      if (hasPendingWrite(save.status)) return;
      finish();
    });
    const timer = setTimeout(() => finish(), RETIRE_TIMEOUT_MS);

    finish = () => {
      clearTimeout(timer);
      stopWatching();
      machine.dispose();
      this.retiring.delete(finish);
    };
    this.retiring.add(finish);
  }

  private publish(): void {
    this.snapshot = new Map(
      [...this.records].map(([pageId, record]) => [pageId, record.session]),
    );
    for (const listener of [...this.listeners]) listener();
  }
}
