/**
 * Wraps a `ProjectStore` so every mutation the SPA sends for one project is
 * serialized through a single FIFO queue and always carries the freshest
 * known revision — never the value a caller captured earlier.
 *
 * Why this exists: two save machines (say, a page's autosave and an outline
 * drag-drop) both read `revision: 5` from the last snapshot they saw, then
 * fire around the same moment. Sent uncoordinated, the second request would
 * 409 on a revision that is, from this tab's own point of view, not stale at
 * all — this tab already knows about its own first mutation. The coordinator
 * queues the second mutation's *dispatch* until the first settles, and hands
 * it the revision the first one produced, so a same-tab race never manufactures
 * a false conflict.
 *
 * This is NOT the same protection as the save machine's dirty-guard
 * (`save-machine.ts`): a coordinator-smoothed revision only means "no other
 * mutation from THIS tab is still in flight." It says nothing about whether
 * some OTHER tab changed the exact resource a queued mutation is about to
 * overwrite — that is what `events.ts` dirty-guard events, and the save
 * machine's own conflict handling, exist to catch. A genuine remote conflict
 * still 409s here, and the coordinator forwards it to its caller — it only
 * ever suppresses the *spurious*, same-tab kind.
 */

import { RevisionConflictError, type ProjectStore } from "./contract";

/** Anything the coordinator can queue must report the revision it produced. */
interface Revisioned {
  revision: number;
}

export class RevisionCoordinator {
  private revision: number;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(initialRevision: number) {
    this.revision = initialRevision;
  }

  get currentRevision(): number {
    return this.revision;
  }

  /**
   * Moves the tracked revision forward. Never backward: an out-of-band read
   * (a snapshot refetch, an SSE event for a mutation still in flight through
   * this exact queue) could in principle observe a revision the queue has
   * already moved past, and regressing would let a subsequent mutation use a
   * `expectedRevision` the server has already rejected once.
   */
  adoptRevision(revision: number): void {
    if (revision > this.revision) this.revision = revision;
  }

  /**
   * Queues one mutation. `task` receives the revision to send — always the
   * coordinator's current value at the moment this task actually runs, not
   * at the moment it was enqueued. The revision advances synchronously (still
   * inside this method's continuation) before the queue moves on to the next
   * task, which is what makes the ordering guarantee hold.
   *
   * A `RevisionConflictError` still adopts the snapshot it carries (so the
   * next queued mutation does not repeat the same stale send) and then
   * re-throws to the caller that owns this particular mutation — a conflict
   * is never swallowed, only used to keep the queue's own bookkeeping honest.
   *
   * A successful result also goes through `adoptRevision` (monotonic),
   * never a plain assignment: while `task` is in flight, an SSE event for
   * some OTHER client's commit can arrive and adopt a newer revision than
   * this mutation's own response carries — network delivery gives no
   * ordering guarantee between the two channels. An unconditional assignment
   * here would regress the tracked revision, making the next queued
   * mutation send one the server has already moved past.
   */
  enqueue<T extends Revisioned>(task: (expectedRevision: number) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      try {
        const result = await task(this.revision);
        this.adoptRevision(result.revision);
        return result;
      } catch (error) {
        if (error instanceof RevisionConflictError) {
          this.adoptRevision(error.snapshot.revision);
        }
        throw error;
      }
    });

    // Never let a rejection break the chain for later-queued mutations.
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

export interface CoordinatedProjectStore {
  store: ProjectStore;
  coordinator: RevisionCoordinator;
}

/**
 * Builds the `ProjectStore` a save machine actually talks to: both reads
 * (`loadSnapshot`, `loadPage`) adopt whatever revision they observe into the
 * coordinator — a stale-revision read must never leave the coordinator
 * behind a resource it just fetched — while both mutation methods are routed
 * through the coordinator's queue. The `expectedRevision` argument a caller
 * passes to `applyOutlineCommand`/`savePage` is accepted for interface
 * parity but intentionally ignored — see the module comment.
 */
export function createCoordinatedStore(
  inner: ProjectStore,
  initialRevision: number,
): CoordinatedProjectStore {
  const coordinator = new RevisionCoordinator(initialRevision);

  const store: ProjectStore = {
    async loadSnapshot() {
      const snapshot = await inner.loadSnapshot();
      coordinator.adoptRevision(snapshot.revision);
      return snapshot;
    },

    applyOutlineCommand(_expectedRevision, command) {
      return coordinator.enqueue((expectedRevision) =>
        inner.applyOutlineCommand(expectedRevision, command),
      );
    },

    async loadPage(id) {
      const page = await inner.loadPage(id);
      coordinator.adoptRevision(page.revision);
      return page;
    },

    savePage(id, _expectedRevision, input) {
      return coordinator.enqueue((expectedRevision) => inner.savePage(id, expectedRevision, input));
    },
  };

  return { store, coordinator };
}
