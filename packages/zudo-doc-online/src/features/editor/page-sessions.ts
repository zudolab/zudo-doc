/**
 * One editing session per OPEN TAB — not per visible pane.
 *
 * The tab strip has to show a dirty dot for every open page, and switching
 * tabs must not throw away an unsaved draft or a pending conflict. Both fall
 * out of keeping the `PageSaveMachine` alive for as long as the tab is open,
 * which is what this registry owns: `open()` loads the page and builds its
 * machine, `close()` disposes it, and nothing in between depends on which tab
 * happens to be rendered.
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

  close(pageId: string): void {
    if (!this.records.has(pageId)) return;
    this.teardown(pageId);
    this.publish();
  }

  dispose(): void {
    for (const pageId of [...this.records.keys()]) this.teardown(pageId);
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

  private publish(): void {
    this.snapshot = new Map(
      [...this.records].map(([pageId, record]) => [pageId, record.session]),
    );
    for (const listener of [...this.listeners]) listener();
  }
}
