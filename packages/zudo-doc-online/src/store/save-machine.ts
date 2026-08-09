/**
 * Per-page save state machine: `idle | dirty | saving | saved | error | conflict`.
 *
 * One instance owns exactly one page's editing session. `store` should be a
 * *coordinated* `ProjectStore` (`revision-coordinator.ts`) — the machine
 * tracks its own last-known revision and sends it, but a coordinated store is
 * what makes that send immune to spurious same-tab races.
 *
 * `edit()` always replaces `content` wholesale, never mutates a field of it in
 * place. That is what makes the ~500ms trailing-debounce autosave safe: the
 * timer callback captures `this.content` into one atomic local (`dispatched`)
 * at the instant it fires, so a burst of keystrokes between two debounce
 * windows can never be observed as a torn read — either the whole edit made
 * it into the snapshot the timer captured, or none of it did.
 *
 * Conflict handling (epic #3327 contract 2: no auto-retry, ever): a 409 while
 * `content` still equals what was last sent means nothing NEW is at risk, so
 * the machine quietly refetches and adopts the server's page — no banner. A
 * 409 while `content` has since moved on (the user kept typing after the
 * failed send) enters `conflict` and keeps that newer draft; only an explicit
 * `retry()` or `discard()` resolves it.
 */

import {
  RevisionConflictError,
  StoreRequestError,
  type PageFrontmatter,
  type PagePayload,
  type PageWriteInput,
  type ProjectStore,
} from "./contract";
import type { ProjectEventsClient } from "./events";

export type SaveMachineStatus = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

export interface PageDraft {
  frontmatter: PageFrontmatter;
  markdown: string;
}

export interface SaveMachineSnapshot {
  status: SaveMachineStatus;
  content: PageDraft;
  warnings: string[];
  /**
   * Set when a remote `page-changed` (or a reconnect refetch) arrived while
   * this machine held unsaved work — the UI's cue for a "remote changed"
   * chip. `content` is never touched when this is set; only `discard()` or a
   * successful save clears it.
   */
  remoteChanged: boolean;
  error?: { code: string; message: string };
}

export type SaveMachineListener = (snapshot: SaveMachineSnapshot) => void;
export type Scheduler = (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
export type Canceller = (handle: ReturnType<typeof setTimeout>) => void;

export interface PageSaveMachineOptions {
  pageId: string;
  store: ProjectStore;
  initial: PagePayload;
  /** Trailing debounce window for `edit()`. Defaults to 500ms. */
  debounceMs?: number;
  /** Injectable so tests can use fake timers without patching globals. */
  scheduleTimeout?: Scheduler;
  clearTimeoutImpl?: Canceller;
}

const PROTECTED_STATUSES: ReadonlySet<SaveMachineStatus> = new Set([
  "dirty",
  "saving",
  "error",
  "conflict",
]);

export class PageSaveMachine {
  readonly pageId: string;

  private readonly store: ProjectStore;
  private readonly debounceMs: number;
  private readonly scheduleTimeout: Scheduler;
  private readonly clearTimeoutImpl: Canceller;
  private readonly listeners = new Set<SaveMachineListener>();

  private status: SaveMachineStatus;
  private content: PageDraft;
  private warnings: string[];
  private revision: number;
  private remoteChanged = false;
  private error: { code: string; message: string } | undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: PageSaveMachineOptions) {
    this.pageId = options.pageId;
    this.store = options.store;
    this.debounceMs = options.debounceMs ?? 500;
    this.scheduleTimeout = options.scheduleTimeout ?? setTimeout;
    this.clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;

    this.status = "idle";
    this.content = { frontmatter: options.initial.frontmatter, markdown: options.initial.markdown };
    this.warnings = options.initial.warnings;
    this.revision = options.initial.revision;
  }

  getSnapshot(): SaveMachineSnapshot {
    return {
      status: this.status,
      content: this.content,
      warnings: this.warnings,
      remoteChanged: this.remoteChanged,
      ...(this.error ? { error: this.error } : {}),
    };
  }

  subscribe(listener: SaveMachineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** User-driven edit. Marks the resource dirty and (re)arms the autosave debounce. */
  edit(patch: PageWriteInput): void {
    this.content = {
      frontmatter: patch.frontmatter ?? this.content.frontmatter,
      markdown: patch.markdown ?? this.content.markdown,
    };
    this.error = undefined;

    if (this.status === "saving") {
      // A save already in flight stays "saving" — its own resolution decides
      // whether this newer content still needs a follow-up save.
    } else if (this.remoteChanged) {
      // An unresolved remote change is still flagged: the coordinator has
      // likely already adopted that event's revision, so an unguarded
      // autosave here would succeed and silently overwrite it. Route through
      // conflict instead of auto-arming — only an explicit retry()/discard()
      // may resume saving.
      this.status = "conflict";
    } else {
      this.status = "dirty";
      this.armDebounce();
    }
    this.emit();
  }

  /** Re-submits the retained draft. Valid from `error` or `conflict` only. */
  retry(): void {
    if (this.status !== "error" && this.status !== "conflict") return;
    this.dispatchSave();
  }

  /** Drops the retained draft and adopts the server's current page. Valid from `conflict` only. */
  discard(): void {
    if (this.status !== "conflict") return;
    void this.refetchFromServer();
  }

  /** Transitions a transient `saved` display state back to `idle`. */
  acknowledgeSaved(): void {
    if (this.status !== "saved") return;
    this.status = "idle";
    this.emit();
  }

  /**
   * Called by the events wiring (`bindPageSaveMachine`) for a remote
   * `page-changed` naming this page. A clean machine (nothing to lose)
   * refetches silently; a protected one raises the `remoteChanged` flag.
   *
   * A `dirty` machine additionally moves to `conflict` and disarms its
   * pending debounce timer: `bindCoordinatorToEvents` adopts this same
   * event's revision into the coordinator, so an unguarded autosave that
   * fires afterward would be accepted by the server (its expectedRevision
   * now matches) and silently overwrite the remote edit instead of 409ing.
   * Routing through `conflict` reuses the existing retry()/discard()
   * resolution instead of a save nobody asked for.
   */
  handleRemoteChange(): void {
    if (PROTECTED_STATUSES.has(this.status)) {
      this.remoteChanged = true;
      if (this.status === "dirty") {
        this.clearTimeoutImpl(this.debounceTimer as ReturnType<typeof setTimeout>);
        this.status = "conflict";
      }
      this.emit();
      return;
    }
    void this.refetchFromServer();
  }

  /**
   * Called after the events client signals a reconnect (events may have been
   * missed while disconnected). Same rule as a targeted remote change: refetch
   * when there is nothing local to lose, otherwise just flag it.
   */
  handleReconnectRefetch(): void {
    this.handleRemoteChange();
  }

  dispose(): void {
    this.clearTimeoutImpl(this.debounceTimer as ReturnType<typeof setTimeout>);
  }

  // ---------------------------------------------------------------- internals

  private armDebounce(): void {
    this.clearTimeoutImpl(this.debounceTimer as ReturnType<typeof setTimeout>);
    this.debounceTimer = this.scheduleTimeout(() => this.dispatchSave(), this.debounceMs);
  }

  private dispatchSave(): void {
    if (this.status === "saving") return;

    // Atomic capture (see module comment): the in-flight save always saves
    // exactly the object `edit()` last installed, never a partially-updated
    // view of it.
    const dispatched = this.content;
    this.status = "saving";
    this.emit();
    void this.performSave(dispatched);
  }

  private async performSave(dispatched: PageDraft): Promise<void> {
    try {
      const result = await this.store.savePage(this.pageId, this.revision, {
        frontmatter: dispatched.frontmatter,
        markdown: dispatched.markdown,
      });
      this.revision = result.revision;
      this.warnings = result.warnings;
      this.error = undefined;

      if (draftEquals(this.content, dispatched)) {
        // A successful commit at the coordinator's live revision is proof
        // this page's content is now the definitive server state — any
        // remote change this machine had been flagging is superseded.
        this.remoteChanged = false;
        this.status = "saved";
        this.emit();
      } else if (this.remoteChanged) {
        // More local edits landed during the flight, AND a remote change was
        // flagged too — require an explicit retry()/discard() rather than
        // silently resuming autosave over content that may itself be stale.
        this.status = "conflict";
        this.emit();
      } else {
        // More edits landed while this save was in flight — still dirty.
        this.status = "dirty";
        this.armDebounce();
        this.emit();
      }
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        this.revision = error.snapshot.revision;
        if (draftEquals(this.content, dispatched)) {
          await this.refetchFromServer();
        } else {
          this.status = "conflict";
          this.emit();
        }
        return;
      }

      this.error =
        error instanceof StoreRequestError
          ? { code: error.code, message: error.message }
          : { code: "network-error", message: error instanceof Error ? error.message : String(error) };
      this.status = "error";
      this.emit();
    }
  }

  private async refetchFromServer(): Promise<void> {
    try {
      const payload = await this.store.loadPage(this.pageId);
      // Concurrent refetches (a conflict-triggered one racing a reconnect- or
      // remote-change-triggered one) can resolve out of order over the
      // network; drop a response that is no longer the freshest state this
      // machine has already adopted rather than regressing onto it.
      if (payload.revision < this.revision) return;
      this.applyLoad(payload);
    } catch (error) {
      this.error =
        error instanceof StoreRequestError
          ? { code: error.code, message: error.message }
          : { code: "network-error", message: "Could not refresh this page." };
      this.status = "error";
      this.emit();
    }
  }

  private applyLoad(payload: PagePayload): void {
    this.clearTimeoutImpl(this.debounceTimer as ReturnType<typeof setTimeout>);
    this.content = { frontmatter: payload.frontmatter, markdown: payload.markdown };
    this.warnings = payload.warnings;
    this.revision = payload.revision;
    this.remoteChanged = false;
    this.error = undefined;
    this.status = "idle";
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of [...this.listeners]) listener(snapshot);
  }
}

function draftEquals(a: PageDraft, b: PageDraft): boolean {
  return (
    a.markdown === b.markdown &&
    a.frontmatter.title === b.frontmatter.title &&
    a.frontmatter.description === b.frontmatter.description &&
    a.frontmatter.draft === b.frontmatter.draft
  );
}

/**
 * Wires a machine to a project's SSE stream: a remote `page-changed` naming
 * this page runs the dirty-guard; a reconnect runs the same check (events may
 * have been missed). An "own" event is skipped here — the coordinator binder
 * (`bindCoordinatorToEvents`, `events.ts`) already advanced the revision, and
 * this machine's own save response is what will update its content.
 */
export function bindPageSaveMachine(
  machine: PageSaveMachine,
  events: ProjectEventsClient,
): () => void {
  const unsubscribeEvent = events.onEvent(({ event, origin }) => {
    if (event.type !== "page-changed" || event.pageId !== machine.pageId) return;
    if (origin === "own") return;
    machine.handleRemoteChange();
  });
  const unsubscribeReconnect = events.onReconnect(() => machine.handleReconnectRefetch());

  return () => {
    unsubscribeEvent();
    unsubscribeReconnect();
  };
}
