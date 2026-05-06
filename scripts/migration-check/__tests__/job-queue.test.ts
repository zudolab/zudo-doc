/**
 * job-queue.test.ts — unit tests for lib/job-queue.mjs
 *
 * Tests verify:
 *   1. All jobs run and results are returned in input order.
 *   2. Concurrency is capped at N (never more than N promises in flight).
 *   3. Works when concurrency >= job count (no under-utilisation error).
 *   4. Works with an empty job list.
 *   5. Errors propagate from failing jobs.
 */

import { describe, it, expect } from "vitest";
import { runJobQueue } from "../lib/job-queue.mjs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runJobQueue — basic correctness", () => {
  it("runs all jobs and returns results in input order", async () => {
    const results = await runJobQueue(
      [async () => 10, async () => 20, async () => 30],
      2,
    );
    expect(results).toEqual([10, 20, 30]);
  });

  it("preserves result order even when later jobs finish first", async () => {
    // Job 0 sleeps longest; job 2 finishes first — results must still be in order.
    const jobs = [
      async () => { await delay(30); return "slow"; },
      async () => { await delay(10); return "medium"; },
      async () => { await delay(1);  return "fast"; },
    ];
    const results = await runJobQueue(jobs, 3);
    expect(results).toEqual(["slow", "medium", "fast"]);
  });

  it("returns an empty array for empty job list", async () => {
    const results = await runJobQueue([], 3);
    expect(results).toEqual([]);
  });

  it("works when concurrency >= job count", async () => {
    const results = await runJobQueue(
      [async () => "a", async () => "b"],
      10,
    );
    expect(results).toEqual(["a", "b"]);
  });

  it("works with concurrency = 1 (sequential execution)", async () => {
    const order: number[] = [];
    const jobs = [0, 1, 2, 3].map((n) => async () => {
      order.push(n);
      return n;
    });
    const results = await runJobQueue(jobs, 1);
    expect(results).toEqual([0, 1, 2, 3]);
    expect(order).toEqual([0, 1, 2, 3]);
  });
});

describe("runJobQueue — concurrency cap", () => {
  it("never runs more than N jobs concurrently (N=3, 10 jobs)", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const jobs = Array.from({ length: 10 }, (_, i) => async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(20); // hold the slot long enough for overlap to occur
      inFlight--;
      return i;
    });

    const results = await runJobQueue(jobs, 3);

    expect(maxInFlight).toBeLessThanOrEqual(3);
    // Also assert all results are correct
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("never runs more than N jobs concurrently (N=1, 5 jobs)", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const jobs = Array.from({ length: 5 }, (_, i) => async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(10);
      inFlight--;
      return i;
    });

    await runJobQueue(jobs, 1);
    expect(maxInFlight).toBe(1);
  });

  it("saturates concurrency when there are enough jobs (N=4, 8 jobs)", async () => {
    let maxInFlight = 0;
    let inFlight = 0;

    // All jobs start simultaneously in the first wave.
    // The first 4 jobs all start before any finish (each delays 30 ms).
    const jobs = Array.from({ length: 8 }, (_, i) => async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(30);
      inFlight--;
      return i;
    });

    await runJobQueue(jobs, 4);
    expect(maxInFlight).toBe(4); // First wave fills all 4 slots
  });
});

describe("runJobQueue — error handling", () => {
  it("propagates a rejection from a failing job", async () => {
    await expect(
      runJobQueue(
        [
          async () => 1,
          async () => { throw new Error("boom"); },
          async () => 3,
        ],
        2,
      ),
    ).rejects.toThrow("boom");
  });
});
