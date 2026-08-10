/**
 * The **global** SSE client for the projects-directory change stream
 * (`GET /api/projects/_events`, per the epic's locked wire contract) — the
 * directory-level counterpart of `events.ts`'s per-project
 * `ProjectEventsClient`. Where that client listens for one project's
 * outline/page changes, this one listens for the directory itself changing
 * shape: a project created, deleted, or duplicated by ANY client, including
 * an MCP agent working headlessly.
 *
 * Same three responsibilities as `events.ts`, reused rather than
 * re-explained here:
 *
 * 1. **Reconnect with backoff** — see `events.ts`'s header for why we don't
 *    rely on `EventSource`'s own retry.
 * 2. **Own-origin classification** against this tab's `clientId`
 *    (`client-id.ts`), reusing `events.ts`'s `EventOrigin` type so "own" vs
 *    "remote" means the same thing across both streams.
 * 3. **Open/reconnect-refetch signal.** `onOpen` fires after EVERY
 *    successful connection, including the first, closing the
 *    fetch-before-subscribe race: a dashboard that calls `listProjects()`
 *    and only then subscribes has a window where a change lands in between
 *    and is never seen (no replay on this stream). Treating "just
 *    (re)connected" as "assume the list moved, refetch" closes that window
 *    the same way `events.ts`'s `onOpen` does for a single project.
 *
 * The parser tolerates unknown event types (forward-compat, per the epic's
 * "Server events become a discriminated union" note): today the stream only
 * ever emits `"projects-changed"`, but a future event type is silently
 * skipped rather than crashing the connection.
 */

import { getClientId } from "./client-id";
import type { EventOrigin, EventSourceFactory, EventSourceLike } from "./events";

export type ProjectsChangeAction = "created" | "deleted" | "duplicated";

export interface ProjectsChangeEvent {
  type: "projects-changed";
  slug: string;
  action: ProjectsChangeAction;
  /** The `clientId` of the mutation that caused this event, when supplied. */
  origin?: string;
}

export interface ProjectsEventEnvelope {
  event: ProjectsChangeEvent;
  origin: EventOrigin;
}

export type ProjectsEventsListener = (envelope: ProjectsEventEnvelope) => void;
export type ProjectsReconnectListener = () => void;

export interface ProjectsEventsClientOptions {
  /** This tab's id — compared against each event's `origin`. Defaults to `getClientId()`. */
  clientId?: string;
  /** Defaults to `/api`. */
  baseUrl?: string;
  /** Defaults to `(url) => new EventSource(url)`; tests always inject a fake. */
  createEventSource?: EventSourceFactory;
  /** First reconnect delay. Defaults to 500ms. */
  reconnectBaseMs?: number;
  /** Backoff ceiling. Defaults to 10s. */
  reconnectMaxMs?: number;
}

export type ProjectsConnectionState = "connecting" | "open" | "closed";

export class ProjectsEventsClient {
  private readonly url: string;
  private readonly clientId: string;
  private readonly createEventSource: EventSourceFactory;
  private readonly reconnectBaseMs: number;
  private readonly reconnectMaxMs: number;

  private source: EventSourceLike | null = null;
  private state: ProjectsConnectionState = "closed";
  private everConnected = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly eventListeners = new Set<ProjectsEventsListener>();
  private readonly reconnectListeners = new Set<ProjectsReconnectListener>();
  private readonly openListeners = new Set<() => void>();

  constructor(options: ProjectsEventsClientOptions = {}) {
    const baseUrl = options.baseUrl ?? "/api";
    this.url = `${baseUrl}/projects/_events`;
    this.clientId = options.clientId ?? getClientId();
    this.createEventSource =
      options.createEventSource ??
      ((url) => new EventSource(url) as unknown as EventSourceLike);
    this.reconnectBaseMs = options.reconnectBaseMs ?? 500;
    this.reconnectMaxMs = options.reconnectMaxMs ?? 10_000;
  }

  get connectionState(): ProjectsConnectionState {
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
      const parsed = parseProjectsChangeEvent(event.data);
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

  onEvent(listener: ProjectsEventsListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /** Fires after every RE-connect (never after the first connect). */
  onReconnect(listener: ProjectsReconnectListener): () => void {
    this.reconnectListeners.add(listener);
    return () => this.reconnectListeners.delete(listener);
  }

  /** Fires after EVERY successful connection, including the first — see the file header. */
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

function parseProjectsChangeEvent(raw: string): ProjectsChangeEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as Partial<ProjectsChangeEvent>;
  if (candidate.type !== "projects-changed") return null;
  if (typeof candidate.slug !== "string") return null;
  if (
    candidate.action !== "created" &&
    candidate.action !== "deleted" &&
    candidate.action !== "duplicated"
  ) {
    return null;
  }
  return {
    type: "projects-changed",
    slug: candidate.slug,
    action: candidate.action,
    ...(typeof candidate.origin === "string" ? { origin: candidate.origin } : {}),
  };
}

export interface SubscribeProjectsChangedListener {
  onEvent: ProjectsEventsListener;
  /**
   * Fires after every successful open/reconnect (`ProjectsEventsClient.onOpen`)
   * — the signal a consumer uses to refetch `listProjects()` and close the
   * fetch-before-subscribe race described in the file header.
   */
  onOpen?: () => void;
}

/**
 * Convenience entry point matching the epic's contract name: builds a
 * `ProjectsEventsClient`, wires the given listener, connects, and returns an
 * unsubscribe function that also closes the connection. Reach for the class
 * directly instead when a consumer needs `onReconnect` specifically, or
 * needs to keep the connection open across listener changes.
 */
export function subscribeProjectsChanged(
  listener: SubscribeProjectsChangedListener,
  options: ProjectsEventsClientOptions = {},
): () => void {
  const client = new ProjectsEventsClient(options);
  const offEvent = client.onEvent(listener.onEvent);
  const offOpen = listener.onOpen ? client.onOpen(listener.onOpen) : undefined;
  client.connect();
  return () => {
    offEvent();
    offOpen?.();
    client.close();
  };
}
