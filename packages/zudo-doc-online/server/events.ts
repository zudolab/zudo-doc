/**
 * Change-event fan-out behind the SSE route.
 *
 * Events are published only AFTER a commit is durable, so a subscriber that
 * refetches on the event always sees at least the state the event announced —
 * never a revision the disk has not reached yet.
 *
 * `origin` echoes the mutating request's `clientId`. A client that made the
 * change recognises its own event and skips the refetch it already performed;
 * without it every save would round-trip twice.
 */

/**
 * A discriminated union: `outline-changed`/`page-changed` carry the project
 * revision the commit produced; `projects-changed` (list-level: created,
 * deleted, duplicated) does not, because it is not scoped to one project's
 * revision history at all.
 */
export type ChangeEvent =
  | {
      type: "outline-changed";
      revision: number;
      /** The `clientId` of the mutation that caused this event, when supplied. */
      origin?: string;
    }
  | {
      type: "page-changed";
      pageId: string;
      revision: number;
      /** The `clientId` of the mutation that caused this event, when supplied. */
      origin?: string;
    }
  | {
      type: "projects-changed";
      slug: string;
      action: "created" | "deleted" | "duplicated";
      /** The `clientId` of the mutation that caused this event, when supplied. */
      origin?: string;
    };

export type ChangeEventType = ChangeEvent["type"];

export type ChangeListener = (event: ChangeEvent) => void;

/**
 * Reserved subscription key for the global projects stream
 * (`GET /api/projects/_events`). Colon-keyed, so it can never collide with a
 * project slug (`isValidSlug` never allows `:`).
 */
export const GLOBAL_EVENTS_KEY = "::all";

/**
 * Per-project cap. A local dev server sees a handful of tabs; a number this
 * far above that only exists to keep a leaking or hostile client from growing
 * the map without bound, which is why exceeding it is a refused connection
 * rather than a silently dropped subscriber.
 */
export const MAX_SUBSCRIBERS_PER_PROJECT = 64;

export class SubscriberLimitError extends Error {
  constructor(public readonly projectSlug: string) {
    super(
      `Project "${projectSlug}" already has ${MAX_SUBSCRIBERS_PER_PROJECT} event subscribers.`,
    );
    this.name = "SubscriberLimitError";
  }
}

export class EventBus {
  private readonly listeners = new Map<string, Set<ChangeListener>>();

  /**
   * Returns an unsubscribe function. Calling it twice is safe — the SSE route
   * runs it from both its abort handler and its `finally`.
   */
  subscribe(projectSlug: string, listener: ChangeListener): () => void {
    const existing = this.listeners.get(projectSlug);
    if (existing && existing.size >= MAX_SUBSCRIBERS_PER_PROJECT) {
      throw new SubscriberLimitError(projectSlug);
    }

    const set = existing ?? new Set<ChangeListener>();
    set.add(listener);
    this.listeners.set(projectSlug, set);

    return () => {
      const current = this.listeners.get(projectSlug);
      if (!current) return;
      current.delete(listener);
      // Drop the empty set so a long-lived server does not accumulate one
      // entry per project it has ever served.
      if (current.size === 0) this.listeners.delete(projectSlug);
    };
  }

  /** A throwing listener must not stop the others from being told. */
  publish(projectSlug: string, event: ChangeEvent): void {
    const set = this.listeners.get(projectSlug);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        listener(event);
      } catch (error) {
        console.error(`[events] subscriber failed for "${projectSlug}":`, error);
      }
    }
  }

  subscriberCount(projectSlug: string): number {
    return this.listeners.get(projectSlug)?.size ?? 0;
  }

  /** Projects with at least one subscriber — bookkeeping assertions in tests. */
  get trackedProjects(): number {
    return this.listeners.size;
  }
}
