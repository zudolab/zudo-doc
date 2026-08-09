import { describe, expect, it } from "vitest";

import { RevisionConflictError, type ProjectSnapshot } from "../contract";
import { createCoordinatedStore, RevisionCoordinator } from "../revision-coordinator";
import { createTestStore } from "./support";

function snapshotAt(revision: number): ProjectSnapshot {
  return {
    slug: "docs",
    title: "Test Project",
    revision,
    outline: { schemaVersion: 1, projectTitle: "Test Project", categories: [] },
    pages: [],
  };
}

describe("RevisionCoordinator.enqueue", () => {
  it("serializes two queued mutations, dispatching the second only after the first settles", async () => {
    const coordinator = new RevisionCoordinator(1);
    const seenRevisions: number[] = [];
    let resolveFirst!: (value: { revision: number }) => void;
    const firstResult = new Promise<{ revision: number }>((resolve) => {
      resolveFirst = resolve;
    });

    const first = coordinator.enqueue((expectedRevision) => {
      seenRevisions.push(expectedRevision);
      return firstResult;
    });
    const second = coordinator.enqueue((expectedRevision) => {
      seenRevisions.push(expectedRevision);
      return Promise.resolve({ revision: expectedRevision + 1 });
    });

    // The second task must not run while the first is still pending.
    await Promise.resolve();
    await Promise.resolve();
    expect(seenRevisions).toEqual([1]);

    resolveFirst({ revision: 2 });
    await first;
    await second;

    // The second mutation was dispatched with the revision the first one
    // produced (2), not the value that was current when it was enqueued (1).
    expect(seenRevisions).toEqual([1, 2]);
    expect(coordinator.currentRevision).toBe(3);
  });

  it("propagates a RevisionConflictError to its own caller, and adopts its snapshot's revision for the next queued task", async () => {
    const coordinator = new RevisionCoordinator(1);
    const seenRevisions: number[] = [];

    const first = coordinator.enqueue((expectedRevision) => {
      seenRevisions.push(expectedRevision);
      return Promise.reject(new RevisionConflictError("stale", snapshotAt(5)));
    });
    const second = coordinator.enqueue((expectedRevision) => {
      seenRevisions.push(expectedRevision);
      return Promise.resolve({ revision: expectedRevision });
    });

    await expect(first).rejects.toBeInstanceOf(RevisionConflictError);
    await second;

    expect(seenRevisions).toEqual([1, 5]);
    expect(coordinator.currentRevision).toBe(5);
  });

  it("does not let a rejection break the chain for a task queued after it settles", async () => {
    const coordinator = new RevisionCoordinator(1);
    await expect(
      coordinator.enqueue(() => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");

    const after = await coordinator.enqueue((expectedRevision) =>
      Promise.resolve({ revision: expectedRevision + 1 }),
    );
    expect(after.revision).toBe(2);
  });
});

describe("RevisionCoordinator.adoptRevision", () => {
  it("only ever moves the tracked revision forward", () => {
    const coordinator = new RevisionCoordinator(5);
    coordinator.adoptRevision(3);
    expect(coordinator.currentRevision).toBe(5);
    coordinator.adoptRevision(9);
    expect(coordinator.currentRevision).toBe(9);
  });
});

describe("createCoordinatedStore", () => {
  it("ignores a caller-supplied expectedRevision and substitutes the coordinator's own", async () => {
    const inner = createTestStore();
    const { store } = createCoordinatedStore(inner, 1);

    const result = await store.applyOutlineCommand(0, { type: "add-category", title: "New" });
    expect(result.changed).toBe(true);
    expect(result.revision).toBe(2);
  });

  it("resolves a same-tab race across two different mutation kinds without a spurious conflict", async () => {
    const inner = createTestStore();
    const { store } = createCoordinatedStore(inner, 1);

    // Both calls are fired before either resolves, and both are (deliberately,
    // realistically) written as if they still believed revision 1 was current.
    const outlineCall = store.applyOutlineCommand(1, { type: "add-category", title: "A" });
    const pageCall = store.savePage("page-1", 1, { markdown: "Race\n" });

    const [outlineResult, pageResult] = await Promise.all([outlineCall, pageCall]);
    expect(outlineResult.changed).toBe(true);
    expect(outlineResult.revision).toBe(2);
    expect(pageResult.changed).toBe(true);
    expect(pageResult.revision).toBe(3);
  });

  it("syncs the coordinator's tracked revision on loadSnapshot", async () => {
    const inner = createTestStore();
    inner.applyExternalOutlineCommand({ type: "add-category", title: "External" });
    const { store, coordinator } = createCoordinatedStore(inner, 1);

    expect(coordinator.currentRevision).toBe(1);
    await store.loadSnapshot();
    expect(coordinator.currentRevision).toBe(2);
  });

  it("still surfaces a genuine remote conflict to the caller", async () => {
    const inner = createTestStore();
    const { store, coordinator } = createCoordinatedStore(inner, 1);

    // Someone else commits behind the coordinator's back.
    inner.applyExternalPageWrite("page-2", { markdown: "Elsewhere\n" });
    expect(coordinator.currentRevision).toBe(1);

    await expect(
      store.applyOutlineCommand(1, { type: "add-category", title: "Mine" }),
    ).rejects.toBeInstanceOf(RevisionConflictError);
    // The coordinator adopts the fresh revision even though this mutation lost.
    expect(coordinator.currentRevision).toBe(2);
  });
});
