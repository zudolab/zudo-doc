/**
 * The SSE client for a project's change stream
 * (`GET /api/projects/:project/events`, `server/routes/projects.ts`).
 *
 * Three responsibilities, all transport-level:
 *
 * 1. **Reconnect with backoff.** The browser's native `EventSource` retries on
 *    its own, but on a fixed interval we do not control and with no signal we
 *    can hook cleanly. Instead this client closes the source itself on every
 *    error and opens a fresh one after an exponential backoff (capped), so a
 *    flaky connection does not hammer the server.
 * 2. **Own-origin classification.** Every event is tagged `"own"` (this tab's
 *    `clientId` caused it) or `"remote"` (anyone else's) before it reaches a
 *    listener — see `ChangeEvent.origin` in `server/events.ts`.
 * 3. **Reconnect-refetch signal.** Events can be missed while disconnected, so
 *    every RE-connect (not the first connect) fires `onReconnect` — the
 *    consumer's job is to treat that as "assume state moved and refetch,"
 *    which is exactly what `revision-coordinator.ts`'s and `save-machine.ts`'s
 *    binder helpers below do.
 *
 * This module does not know what a page or an outline is, and does not decide
 * whether a remote change is safe to apply — that is `save-machine.ts`'s
 * dirty-guard, wired in via `bindPageSaveMachine`.
 */

import { RevisionCoordinator } from "./revision-coordinator";

export type ChangeEventType = "outline-changed" | "page-changed";

export interface ChangeEvent {
  type: ChangeEventType;
  /** Present on `page-changed` only. */
  pageId?: string;
  revision: number;
  /** The `clientId` of the mutation that caused this event, when supplied. */
  origin?: string;
}

export type EventOrigin = "own" | "remote";

export interface ProjectEventEnvelope {
  event: ChangeEvent;
  origin: EventOrigin;
}

/**
 * The slice of the DOM `EventSource` this client actually uses. Kept minimal
 * and structural (not `typeof EventSource`) so a test's fake object needs no
 * relation to the real browser class.
 */
export interface EventSourceLike {
  onopen: ((this: EventSourceLike, ev: Event) => unknown) | null;
  onmessage: ((this: EventSourceLike, ev: MessageEvent) => unknown) | null;
  onerror: ((this: EventSourceLike, ev: Event) => unknown) | null;
  close(): void;
}

export type EventSourceFactory = (url: string) => EventSourceLike;

export type ProjectEventsListener = (envelope: ProjectEventEnvelope) => void;
export type ReconnectListener = () => void;

export interface ProjectEventsClientOptions {
  projectSlug: string;
  /** This tab's id — compared against each event's `origin`. */
  clientId: string;
  /** Defaults to `/api`. */
  baseUrl?: string;
  /** Defaults to `(url) => new EventSource(url)`; tests always inject a fake. */
  createEventSource?: EventSourceFactory;
  /** First reconnect delay. Defaults to 500ms. */
  reconnectBaseMs?: number;
  /** Backoff ceiling. Defaults to 10s. */
  reconnectMaxMs?: number;
}

export type ConnectionState = "connecting" | "open" | "closed";

export class ProjectEventsClient {
  private readonly url: string;
  private readonly clientId: string;
  private readonly createEventSource: EventSourceFactory;
  private readonly reconnectBaseMs: number;
  private readonly reconnectMaxMs: number;

  private source: EventSourceLike | null = null;
  private state: ConnectionState = "closed";
  private everConnected = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly eventListeners = new Set<ProjectEventsListener>();
  private readonly reconnectListeners = new Set<ReconnectListener>();
  private readonly openListeners = new Set<() => void>();

  constructor(options: ProjectEventsClientOptions) {
    const baseUrl = options.baseUrl ?? "/api";
    this.url = `${baseUrl}/projects/${options.projectSlug}/events`;
    this.clientId = options.clientId;
    this.createEventSource =
      options.createEventSource ??
      ((url) => new EventSource(url) as unknown as EventSourceLike);
    this.reconnectBaseMs = options.reconnectBaseMs ?? 500;
    this.reconnectMaxMs = options.reconnectMaxMs ?? 10_000;
  }

  get connectionState(): ConnectionState {
    return this.state;
  }

  connect(): void {
    if (this.source !== null) return;
    clearTimeout(this.reconnectTimer);
    this.state = "connecting";

    const source = this.createEventSource(this.url);
    this.source = source;

    source.onopen = () => {
      this.reconnectAttempt = 0;
      this.state = "open";
      for (const listener of [...this.openListeners]) listener();
      const isReconnect = this.everConnected;
      this.everConnected = true;
      if (isReconnect) {
        for (const listener of [...this.reconnectListeners]) listener();
      }
    };

    source.onmessage = (event) => {
      const parsed = parseChangeEvent(event.data);
      if (parsed === null) return;
      const origin: EventOrigin = parsed.origin === this.clientId ? "own" : "remote";
      for (const listener of [...this.eventListeners]) {
        listener({ event: parsed, origin });
      }
    };

    source.onerror = () => {
      this.teardownSource();
      this.scheduleReconnect();
    };
  }

  /** Permanently closes the connection; no further reconnect is scheduled. */
  close(): void {
    clearTimeout(this.reconnectTimer);
    this.teardownSource();
    this.state = "closed";
  }

  onEvent(listener: ProjectEventsListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /** Fires after every RE-connect (never after the first connect). */
  onReconnect(listener: ReconnectListener): () => void {
    this.reconnectListeners.add(listener);
    return () => this.reconnectListeners.delete(listener);
  }

  /**
   * Fires after EVERY successful connection, including the first — a
   * superset of `onReconnect`. Exists for a consumer that has no separate
   * "initial state" read to rely on being current (unlike `revision-
   * coordinator.ts`'s binder, which adopts a snapshot revision before
   * `connect()` is even called): subscribing only after the first `loadPage`
   * / `loadSnapshot` call already resolved leaves a gap between that read
   * and the stream actually opening, during which a change is silently
   * missed (no replay). A consumer that refetches on `onOpen` closes that
   * gap the moment the connection is confirmed live, first connect or not.
   */
  onOpen(listener: () => void): () => void {
    this.openListeners.add(listener);
    return () => this.openListeners.delete(listener);
  }

  private teardownSource(): void {
    this.source?.close();
    this.source = null;
  }

  private scheduleReconnect(): void {
    this.state = "connecting";
    const delay = Math.min(
      this.reconnectBaseMs * 2 ** this.reconnectAttempt,
      this.reconnectMaxMs,
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.source = null; // allow connect() to run again
      this.connect();
    }, delay);
  }
}

function parseChangeEvent(raw: string): ChangeEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as Partial<ChangeEvent>;
  if (candidate.type !== "outline-changed" && candidate.type !== "page-changed") return null;
  if (typeof candidate.revision !== "number") return null;
  return {
    type: candidate.type,
    revision: candidate.revision,
    ...(typeof candidate.pageId === "string" ? { pageId: candidate.pageId } : {}),
    ...(typeof candidate.origin === "string" ? { origin: candidate.origin } : {}),
  };
}

/**
 * Keeps a `RevisionCoordinator` current with every commit this tab hears
 * about, own or remote — cheap and always safe (`adoptRevision` only ever
 * moves forward), and it is what lets a queued mutation dispatch with the
 * post-event revision instead of 409ing needlessly.
 */
export function bindCoordinatorToEvents(
  coordinator: RevisionCoordinator,
  events: ProjectEventsClient,
): () => void {
  return events.onEvent(({ event }) => coordinator.adoptRevision(event.revision));
}
