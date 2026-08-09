import { describe, expect, it } from "vitest";

import { KeyedMutex } from "../store/locks";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("KeyedMutex", () => {
  it("runs tasks for one key strictly one at a time", async () => {
    const mutex = new KeyedMutex();
    const log: string[] = [];
    const gate = deferred();

    const first = mutex.run("p", async () => {
      log.push("first:start");
      await gate.promise;
      log.push("first:end");
    });
    const second = mutex.run("p", async () => {
      log.push("second:start");
    });

    // The second task must not have started while the first is parked.
    await Promise.resolve();
    expect(log).toEqual(["first:start"]);

    gate.resolve();
    await Promise.all([first, second]);
    expect(log).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("lets different keys run concurrently", async () => {
    const mutex = new KeyedMutex();
    const log: string[] = [];
    const gate = deferred();

    const a = mutex.run("a", async () => {
      log.push("a:start");
      await gate.promise;
    });
    const b = mutex.run("b", async () => {
      log.push("b:start");
    });

    await b;
    expect(log).toEqual(["a:start", "b:start"]);
    gate.resolve();
    await a;
  });

  it("keeps the chain usable after a task rejects", async () => {
    const mutex = new KeyedMutex();

    await expect(
      mutex.run("p", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    await expect(mutex.run("p", async () => "fine")).resolves.toBe("fine");
  });

  it("drops its bookkeeping once a key drains", async () => {
    const mutex = new KeyedMutex();
    await mutex.run("p", async () => undefined);
    // One extra turn for the cleanup continuation to run.
    await Promise.resolve();
    await Promise.resolve();
    expect(mutex.pendingKeys).toBe(0);
  });
});
