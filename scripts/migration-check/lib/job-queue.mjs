/**
 * job-queue.mjs — concurrency-capped job queue.
 *
 * A pure utility — no I/O, no side effects.
 * Pass a list of job functions (each returning a Promise) and a concurrency
 * limit; at most `concurrency` promises will be in-flight at any time.
 *
 * Results are returned in input order regardless of completion order.
 * If any job rejects, the rejection propagates (remaining in-flight jobs
 * run to completion first, then the error surfaces).
 *
 * @template T
 * @param {Array<() => Promise<T>>} jobs  Thunks to execute.
 * @param {number} concurrency            Max number of concurrent promises.
 * @returns {Promise<T[]>}               Results in the same order as jobs.
 */
export async function runJobQueue(jobs, concurrency) {
  if (jobs.length === 0) return [];

  const results = new Array(jobs.length);
  let nextIndex = 0;

  // Each worker repeatedly picks the next available job until all are done.
  // Since nextIndex++ is synchronous (no await between the while-check and
  // the increment), no two workers can grab the same index slot.
  async function worker() {
    while (nextIndex < jobs.length) {
      const i = nextIndex++;
      results[i] = await jobs[i]();
    }
  }

  const workerCount = Math.min(concurrency, jobs.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
