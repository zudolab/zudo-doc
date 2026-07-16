import { describe, it, expect } from "vitest";
import { makeSemaphore } from "@takazudo/zudo-doc-history-server/concurrency";

describe("makeSemaphore", () => {
  it("allows up to concurrency tasks to run simultaneously", async () => {
    const concurrency = 3;
    const acquire = makeSemaphore(concurrency);

    let peak = 0;
    let running = 0;
    const tasks: Promise<void>[] = [];

    for (let i = 0; i < 10; i++) {
      tasks.push(
        (async () => {
          const release = await acquire();
          try {
            running++;
            if (running > peak) peak = running;
            // Yield to event loop so concurrent tasks can start
            await new Promise<void>((resolve) => setTimeout(resolve, 5));
          } finally {
            running--;
            release();
          }
        })(),
      );
    }

    await Promise.all(tasks);

    // Peak concurrent tasks must never exceed the cap
    expect(peak).toBeLessThanOrEqual(concurrency);
    // At least 2 tasks must have run concurrently (otherwise the semaphore
    // isn't providing any parallelism at all)
    expect(peak).toBeGreaterThanOrEqual(2);
  });

  it("resolves all tasks even when cap is 1 (serial mode)", async () => {
    const acquire = makeSemaphore(1);
    const order: number[] = [];
    const tasks: Promise<void>[] = [];

    for (let i = 0; i < 5; i++) {
      const idx = i;
      tasks.push(
        (async () => {
          const release = await acquire();
          try {
            order.push(idx);
            await new Promise<void>((resolve) => setTimeout(resolve, 1));
          } finally {
            release();
          }
        })(),
      );
    }

    await Promise.all(tasks);

    // All 5 tasks must complete
    expect(order).toHaveLength(5);
    // With cap=1 tasks execute in FIFO order (queue is FIFO by design)
    expect(order).toEqual([0, 1, 2, 3, 4]);
  });

  it("release is idempotent — calling it twice does not corrupt the counter", async () => {
    const acquire = makeSemaphore(2);
    const release = await acquire();

    // First release is valid
    release();
    // Second release must not throw and must not corrupt state
    expect(() => release()).not.toThrow();

    // After a double-release, a new acquire must still resolve
    const release2 = await acquire();
    expect(typeof release2).toBe("function");
    release2();
  });

  it("caps concurrency at the specified limit across many tasks", async () => {
    const cap = 4;
    const acquire = makeSemaphore(cap);

    let peak = 0;
    let running = 0;
    const taskCount = 20;
    const tasks: Promise<void>[] = [];

    for (let i = 0; i < taskCount; i++) {
      tasks.push(
        (async () => {
          const release = await acquire();
          try {
            running++;
            if (running > peak) peak = running;
            await new Promise<void>((resolve) => setTimeout(resolve, 10));
          } finally {
            running--;
            release();
          }
        })(),
      );
    }

    await Promise.all(tasks);

    expect(peak).toBeLessThanOrEqual(cap);
    expect(running).toBe(0); // All tasks cleaned up
  });
});
