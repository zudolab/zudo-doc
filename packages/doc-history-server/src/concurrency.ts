import { cpus } from "node:os";

/**
 * Tiny semaphore for bounded parallelism — avoids a p-limit dependency.
 * Limits concurrent async tasks to `concurrency` at a time.
 */
export function makeSemaphore(concurrency: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  function next(): void {
    if (queue.length > 0 && running < concurrency) {
      // Do not increment running here — the dequeued tryRun call handles it.
      queue.shift()!();
    }
  }

  return function acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      function tryRun() {
        if (running < concurrency) {
          running++;
          resolve(() => {
            running--;
            next();
          });
        } else {
          queue.push(tryRun);
        }
      }
      tryRun();
    });
  };
}

/**
 * Default concurrency for git-history tasks: CPU count clamped to [2, 8].
 * Each getFileCommitsMetaAsync / getDocHistoryAsync issues one git process,
 * so this saturates git without spawning excessively on many-core machines.
 */
export function defaultGitConcurrency(): number {
  return Math.min(8, Math.max(2, cpus().length));
}
