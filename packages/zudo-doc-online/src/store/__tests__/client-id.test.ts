import { describe, expect, it } from "vitest";

import { getClientId, type ClientIdStorage } from "../client-id";

function fakeStorage(initial: Record<string, string> = {}): ClientIdStorage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

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
    let calls = 0;
    const createId = () => {
      calls += 1;
      return `id-${calls}`;
    };

    const a = getClientId({ storage: storageA, createId });
    const b = getClientId({ storage: storageB, createId });

    expect(a).not.toBe(b);
  });
});
