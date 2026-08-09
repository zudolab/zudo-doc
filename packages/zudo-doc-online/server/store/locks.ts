/**
 * Per-key async mutex.
 *
 * Every mutation of a project must read its revision, decide, and commit
 * without another mutation slipping in between — otherwise two requests that
 * both passed the `expectedRevision` check would both commit, and one edit
 * would silently vanish. JavaScript's single thread does not help here: an
 * `await` inside the read-decide-commit sequence is exactly where the
 * interleaving happens.
 *
 * Keys are project slugs, so unrelated projects never wait on each other.
 */

export type MutexTask<T> = () => Promise<T>;

export class KeyedMutex {
  /** Tail of each key's promise chain; the entry is dropped when it drains. */
  private readonly chains = new Map<string, Promise<unknown>>();

  /**
   * Runs `task` once every earlier task for `key` has settled. A rejected task
   * does not poison the chain — the next waiter still runs.
   */
  run<T>(key: string, task: MutexTask<T>): Promise<T> {
    const previous = this.chains.get(key) ?? Promise.resolve();
    const result = previous.then(task, task);
    // Swallowed only for the *chain* copy: the returned promise still rejects.
    const chained = result.then(
      () => undefined,
      () => undefined,
    );
    this.chains.set(key, chained);

    void chained.then(() => {
      // Only the current tail may clear the entry; a later waiter that already
      // replaced it must keep its own chain alive.
      if (this.chains.get(key) === chained) this.chains.delete(key);
    });

    return result;
  }

  /** Number of keys with work in flight — bookkeeping assertions in tests. */
  get pendingKeys(): number {
    return this.chains.size;
  }
}
