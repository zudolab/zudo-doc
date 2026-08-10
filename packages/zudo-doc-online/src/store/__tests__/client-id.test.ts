import { afterEach, describe, expect, it } from "vitest";

import {
  getClientId,
  initClientId,
  resetClientIdState,
  type ClientIdLockManager,
  type ClientIdStorage,
} from "../client-id";

function fakeStorage(initial: Record<string, string> = {}): ClientIdStorage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

interface FakeLocks {
  readonly manager: ClientIdLockManager;
  /** Names currently held — by a simulated other tab, or by a successful claim. */
  readonly held: Set<string>;
  /** Names `request()` was called with, in order. */
  readonly requested: string[];
  /** Settle every callback still holding a lock, so no promise outlives the test. */
  releaseAll(): void;
}

function fakeLocks(initiallyHeld: string[] = []): FakeLocks {
  const held = new Set(initiallyHeld);
  const requested: string[] = [];
  const releases: Array<() => void> = [];

  const manager: ClientIdLockManager = {
    request(name, _options, callback) {
      requested.push(name);
      if (held.has(name)) return Promise.resolve(callback(null));
      held.add(name);
      // The real API keeps this promise pending for as long as the callback
      // holds the lock — the callback we pass never resolves on a grant.
      return Promise.race([
        callback({ name }),
        new Promise<void>((resolve) => {
          releases.push(() => {
            held.delete(name);
            resolve();
          });
        }),
      ]);
    },
  };

  return {
    manager,
    held,
    requested,
    releaseAll() {
      for (const release of releases.splice(0)) release();
    },
  };
}

/** Lets a pending-forever promise prove it is still pending. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function sequentialIds(prefix = "id"): () => string {
  let calls = 0;
  return () => {
    calls += 1;
    return `${prefix}-${calls}`;
  };
}

afterEach(() => {
  resetClientIdState();
});

describe("getClientId", () => {
  it("mints and persists an id on first call", () => {
    const storage = fakeStorage();
    const id = getClientId({ storage, createId: () => "minted-id" });

    expect(id).toBe("minted-id");
    expect(storage.getItem("zdo-client-id")).toBe("minted-id");
  });

  it("reuses whatever id is already persisted", () => {
    const storage = fakeStorage({ "zdo-client-id": "existing-id" });
    const id = getClientId({ storage, createId: () => "should-not-be-used" });

    expect(id).toBe("existing-id");
  });

  it("keeps returning the same id across repeated calls against the same storage", () => {
    const storage = fakeStorage();
    let calls = 0;
    const createId = () => {
      calls += 1;
      return `id-${calls}`;
    };

    const first = getClientId({ storage, createId });
    const second = getClientId({ storage, createId });

    expect(first).toBe("id-1");
    expect(second).toBe("id-1");
    expect(calls).toBe(1);
  });

  it("does not cross-contaminate two independent storages", () => {
    const storageA = fakeStorage();
    const storageB = fakeStorage();
    const createId = sequentialIds();

    const a = getClientId({ storage: storageA, createId });
    const b = getClientId({ storage: storageB, createId });

    expect(a).not.toBe(b);
  });
});

describe("initClientId", () => {
  it("keeps the stored id and holds its lock when the lock is free", async () => {
    const storage = fakeStorage({ "zdo-client-id": "stored-id" });
    const locks = fakeLocks();

    const id = await initClientId({
      storage,
      lockManager: locks.manager,
      createId: () => "should-not-be-used",
    });

    expect(id).toBe("stored-id");
    expect(storage.getItem("zdo-client-id")).toBe("stored-id");
    expect(locks.held.has("zdo-client-id:stored-id")).toBe(true);

    locks.releaseAll();
  });

  it("mints, stores and claims a fresh id when the stored one is held elsewhere", async () => {
    const storage = fakeStorage({ "zdo-client-id": "duplicated-id" });
    // The first mint also loses, forcing a second pass — two duplicates racing.
    const locks = fakeLocks(["zdo-client-id:duplicated-id", "zdo-client-id:fresh-1"]);

    const id = await initClientId({
      storage,
      lockManager: locks.manager,
      createId: sequentialIds("fresh"),
    });

    expect(id).toBe("fresh-2");
    expect(storage.getItem("zdo-client-id")).toBe("fresh-2");
    expect(locks.requested).toEqual([
      "zdo-client-id:duplicated-id",
      "zdo-client-id:fresh-1",
      "zdo-client-id:fresh-2",
    ]);
    expect(locks.held.has("zdo-client-id:fresh-2")).toBe(true);

    locks.releaseAll();
  });

  it("falls back to the synchronous behavior when no lock manager exists", async () => {
    const storage = fakeStorage({ "zdo-client-id": "stored-id" });

    const id = await initClientId({ storage, lockManager: null });

    expect(id).toBe("stored-id");
  });

  it("resolves while the underlying lock request stays pending", async () => {
    const storage = fakeStorage({ "zdo-client-id": "stored-id" });
    let requestSettled = false;
    const locks = fakeLocks();
    const manager: ClientIdLockManager = {
      request(name, options, callback) {
        const outcome = locks.manager.request(name, options, callback);
        void outcome.then(
          () => {
            requestSettled = true;
          },
          () => {
            requestSettled = true;
          },
        );
        return outcome;
      },
    };

    await expect(initClientId({ storage, lockManager: manager })).resolves.toBe("stored-id");
    await flushMicrotasks();

    expect(requestSettled).toBe(false);

    locks.releaseAll();
  });

  it("claims once for concurrent and repeated calls", async () => {
    const storage = fakeStorage({ "zdo-client-id": "stored-id" });
    const locks = fakeLocks();

    const [first, second] = await Promise.all([
      initClientId({ storage, lockManager: locks.manager }),
      initClientId({ storage, lockManager: locks.manager }),
    ]);
    const third = await initClientId({ storage, lockManager: locks.manager });

    expect(first).toBe("stored-id");
    expect(second).toBe("stored-id");
    expect(third).toBe("stored-id");
    expect(locks.requested).toEqual(["zdo-client-id:stored-id"]);

    locks.releaseAll();
  });

  it("falls back to the stored id when the lock request rejects", async () => {
    const storage = fakeStorage({ "zdo-client-id": "stored-id" });
    const manager: ClientIdLockManager = {
      request: () => Promise.reject(new Error("locks unavailable")),
    };

    await expect(initClientId({ storage, lockManager: manager })).resolves.toBe("stored-id");
  });

  it("mints an id when there is neither storage nor a lock manager", async () => {
    const throwingStorage: ClientIdStorage = {
      getItem: () => {
        throw new Error("storage unavailable");
      },
      setItem: () => {
        throw new Error("storage unavailable");
      },
    };

    await expect(
      initClientId({
        storage: throwingStorage,
        lockManager: null,
        createId: () => "fallback-id",
      }),
    ).resolves.toBe("fallback-id");
  });
});
