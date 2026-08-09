import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RevisionConflictError,
  StoreRequestError,
  type PagePayload,
  type PageSaveResult,
  type ProjectSnapshot,
  type ProjectStore,
} from "../contract";
import { PageSaveMachine, type SaveMachineStatus } from "../save-machine";

const initialPayload: PagePayload = {
  id: "page-1",
  slug: "intro",
  categoryId: "cat-1",
  revision: 1,
  frontmatter: { title: "Intro" },
  markdown: "Hello\n",
  warnings: [],
};

function fixtureSnapshot(revision: number): ProjectSnapshot {
  return {
    slug: "docs",
    title: "Test Project",
    revision,
    outline: { schemaVersion: 1, projectTitle: "Test Project", categories: [] },
    pages: [],
  };
}

function savedResult(markdown: string, revision: number): PageSaveResult {
  return {
    id: "page-1",
    slug: "intro",
    categoryId: "cat-1",
    revision,
    changed: true,
    frontmatter: { title: "Intro" },
    markdown,
    warnings: [],
  };
}

function makeStore(overrides: Partial<ProjectStore> = {}): ProjectStore {
  return {
    loadSnapshot: vi.fn(),
    applyOutlineCommand: vi.fn(),
    loadPage: vi.fn(),
    savePage: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PageSaveMachine — initial state", () => {
  it("starts idle with the initial payload's content and warnings", () => {
    const machine = new PageSaveMachine({ pageId: "page-1", store: makeStore(), initial: initialPayload });
    const snapshot = machine.getSnapshot();

    expect(snapshot.status).toBe("idle");
    expect(snapshot.content).toEqual({ frontmatter: { title: "Intro" }, markdown: "Hello\n" });
    expect(snapshot.remoteChanged).toBe(false);
    expect(snapshot.error).toBeUndefined();
  });
});

describe("PageSaveMachine — edit and autosave", () => {
  it("marks dirty immediately on edit, before the debounce fires", () => {
    const store = makeStore();
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });
    const statuses: SaveMachineStatus[] = [];
    machine.subscribe((snapshot) => statuses.push(snapshot.status));

    machine.edit({ markdown: "Edited\n" });

    expect(machine.getSnapshot().status).toBe("dirty");
    expect(machine.getSnapshot().content.markdown).toBe("Edited\n");
    expect(statuses).toEqual(["dirty"]);
    expect(store.savePage).not.toHaveBeenCalled();
  });

  it("autosaves ~500ms after the last edit", async () => {
    const savePage = vi.fn().mockResolvedValueOnce(savedResult("Edited\n", 2));
    const store = makeStore({ savePage });
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });

    machine.edit({ markdown: "Edited\n" });
    await vi.advanceTimersByTimeAsync(499);
    expect(savePage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(savePage).toHaveBeenCalledTimes(1);
    expect(savePage).toHaveBeenCalledWith("page-1", 1, {
      frontmatter: { title: "Intro" },
      markdown: "Edited\n",
    });
    expect(machine.getSnapshot().status).toBe("saved");
  });

  it("coalesces a burst of edits into a single save carrying the final content", async () => {
    const savePage = vi.fn().mockResolvedValueOnce(savedResult("Third\n", 2));
    const store = makeStore({ savePage });
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });

    machine.edit({ markdown: "First\n" });
    await vi.advanceTimersByTimeAsync(200);
    machine.edit({ markdown: "Second\n" });
    await vi.advanceTimersByTimeAsync(200);
    machine.edit({ markdown: "Third\n" });
    await vi.advanceTimersByTimeAsync(500);

    expect(savePage).toHaveBeenCalledTimes(1);
    expect(savePage).toHaveBeenCalledWith("page-1", 1, {
      frontmatter: { title: "Intro" },
      markdown: "Third\n",
    });
    expect(machine.getSnapshot().status).toBe("saved");
  });

  it("re-saves content that changed while the first save was still in flight", async () => {
    let resolveFirst!: (value: PageSaveResult) => void;
    const savePage = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<PageSaveResult>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(savedResult("First+more\n", 3));
    const store = makeStore({ savePage });
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });

    machine.edit({ markdown: "First\n" });
    await vi.advanceTimersByTimeAsync(500);
    expect(machine.getSnapshot().status).toBe("saving");

    machine.edit({ markdown: "First+more\n" });
    expect(machine.getSnapshot().status).toBe("saving"); // an edit during flight does not interrupt it

    resolveFirst(savedResult("First\n", 2));
    await vi.advanceTimersByTimeAsync(0);
    expect(machine.getSnapshot().status).toBe("dirty"); // still work to save

    await vi.advanceTimersByTimeAsync(500);
    expect(savePage).toHaveBeenCalledTimes(2);
    expect(savePage).toHaveBeenNthCalledWith(2, "page-1", 2, {
      frontmatter: { title: "Intro" },
      markdown: "First+more\n",
    });
    expect(machine.getSnapshot().status).toBe("saved");
  });

  it("acknowledgeSaved() moves saved -> idle, and is a no-op otherwise", async () => {
    const savePage = vi.fn().mockResolvedValueOnce(savedResult("Edited\n", 2));
    const store = makeStore({ savePage });
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });

    machine.acknowledgeSaved();
    expect(machine.getSnapshot().status).toBe("idle");

    machine.edit({ markdown: "Edited\n" });
    await vi.advanceTimersByTimeAsync(500);
    expect(machine.getSnapshot().status).toBe("saved");

    machine.acknowledgeSaved();
    expect(machine.getSnapshot().status).toBe("idle");
  });

  it("dispose() cancels a pending debounced autosave", async () => {
    const savePage = vi.fn();
    const store = makeStore({ savePage });
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });

    machine.edit({ markdown: "Edited\n" });
    machine.dispose();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(savePage).not.toHaveBeenCalled();
  });
});

describe("PageSaveMachine — save failure (non-conflict)", () => {
  it("enters error, retaining the draft, and retry() resubmits it", async () => {
    const savePage = vi
      .fn()
      .mockRejectedValueOnce(new StoreRequestError("internal-error", "boom", 500))
      .mockResolvedValueOnce(savedResult("Edited\n", 2));
    const store = makeStore({ savePage });
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });

    machine.edit({ markdown: "Edited\n" });
    await vi.advanceTimersByTimeAsync(500);

    let snapshot = machine.getSnapshot();
    expect(snapshot.status).toBe("error");
    expect(snapshot.error).toEqual({ code: "internal-error", message: "boom" });
    expect(snapshot.content.markdown).toBe("Edited\n");

    machine.retry();
    await vi.advanceTimersByTimeAsync(0);

    snapshot = machine.getSnapshot();
    expect(savePage).toHaveBeenCalledTimes(2);
    expect(snapshot.status).toBe("saved");
    expect(snapshot.error).toBeUndefined();
  });

  it("wraps a raw thrown error (not a StoreRequestError) as network-error", async () => {
    const savePage = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const store = makeStore({ savePage });
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });

    machine.edit({ markdown: "Edited\n" });
    await vi.advanceTimersByTimeAsync(500);

    expect(machine.getSnapshot().status).toBe("error");
    expect(machine.getSnapshot().error?.code).toBe("network-error");
  });
});

describe("PageSaveMachine — 409 conflict", () => {
  it("with no further local edits since the send, silently refetches and adopts the server's page", async () => {
    const conflictSnapshot = fixtureSnapshot(5);
    const serverPage: PagePayload = {
      id: "page-1",
      slug: "intro",
      categoryId: "cat-1",
      revision: 5,
      frontmatter: { title: "Server Intro" },
      markdown: "Server content\n",
      warnings: ["a warning"],
    };
    const savePage = vi.fn().mockRejectedValueOnce(new RevisionConflictError("stale", conflictSnapshot));
    const loadPage = vi.fn().mockResolvedValueOnce(serverPage);
    const store = makeStore({ savePage, loadPage });
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });

    machine.edit({ markdown: "Edited\n" });
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(0);

    expect(loadPage).toHaveBeenCalledWith("page-1");
    const snapshot = machine.getSnapshot();
    expect(snapshot.status).toBe("idle");
    expect(snapshot.content).toEqual({ frontmatter: { title: "Server Intro" }, markdown: "Server content\n" });
    expect(snapshot.warnings).toEqual(["a warning"]);
    expect(snapshot.remoteChanged).toBe(false);
  });

  describe("with further local edits since the send", () => {
    async function reachConflict(options: {
      loadPage?: (id: string) => Promise<PagePayload>;
      secondSaveResult?: PageSaveResult;
    } = {}) {
      const conflictSnapshot = fixtureSnapshot(5);
      let rejectFirst!: (reason: unknown) => void;
      const savePage = vi.fn().mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFirst = reject;
          }),
      );
      if (options.secondSaveResult) savePage.mockResolvedValueOnce(options.secondSaveResult);
      const loadPage = options.loadPage ? vi.fn(options.loadPage) : vi.fn();
      const store = makeStore({ savePage, loadPage });
      const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });

      machine.edit({ markdown: "First\n" });
      await vi.advanceTimersByTimeAsync(500);
      machine.edit({ markdown: "First and more\n" });

      rejectFirst(new RevisionConflictError("stale", conflictSnapshot));
      await vi.advanceTimersByTimeAsync(0);

      return { machine, store, savePage, loadPage };
    }

    it("enters conflict, retaining the newer draft untouched", async () => {
      const { machine } = await reachConflict();
      const snapshot = machine.getSnapshot();
      expect(snapshot.status).toBe("conflict");
      expect(snapshot.content.markdown).toBe("First and more\n");
    });

    it("retry() resubmits the kept draft at the fresh (post-conflict) revision", async () => {
      const { machine, savePage } = await reachConflict({
        secondSaveResult: savedResult("First and more\n", 6),
      });

      machine.retry();
      await vi.advanceTimersByTimeAsync(0);

      expect(savePage).toHaveBeenNthCalledWith(2, "page-1", 5, {
        frontmatter: { title: "Intro" },
        markdown: "First and more\n",
      });
      expect(machine.getSnapshot().status).toBe("saved");
    });

    it("discard() drops the draft and adopts the server's page", async () => {
      const serverPage: PagePayload = {
        id: "page-1",
        slug: "intro",
        categoryId: "cat-1",
        revision: 5,
        frontmatter: { title: "Server" },
        markdown: "Server content\n",
        warnings: [],
      };
      const { machine } = await reachConflict({ loadPage: async () => serverPage });

      machine.discard();
      await vi.advanceTimersByTimeAsync(0);

      const snapshot = machine.getSnapshot();
      expect(snapshot.status).toBe("idle");
      expect(snapshot.content).toEqual({ frontmatter: { title: "Server" }, markdown: "Server content\n" });
    });
  });
});

describe("PageSaveMachine — remote-change dirty guard", () => {
  it("silently refetches when clean (idle)", async () => {
    const serverPage: PagePayload = {
      id: "page-1",
      slug: "intro",
      categoryId: "cat-1",
      revision: 2,
      frontmatter: { title: "Server" },
      markdown: "Server\n",
      warnings: [],
    };
    const loadPage = vi.fn().mockResolvedValueOnce(serverPage);
    const store = makeStore({ loadPage });
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });

    machine.handleRemoteChange();
    await vi.advanceTimersByTimeAsync(0);

    expect(loadPage).toHaveBeenCalledWith("page-1");
    expect(machine.getSnapshot().content.markdown).toBe("Server\n");
    expect(machine.getSnapshot().status).toBe("idle");
  });

  it("moves to conflict (not dirty) and disarms the pending autosave when dirty", async () => {
    const savePage = vi.fn();
    const store = makeStore({ savePage });
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });
    machine.edit({ markdown: "Mine\n" });

    machine.handleRemoteChange();

    const snapshot = machine.getSnapshot();
    expect(snapshot.remoteChanged).toBe(true);
    expect(snapshot.content.markdown).toBe("Mine\n");
    // Not "dirty": the coordinator has likely already adopted this event's
    // revision, so a debounce-fired autosave would succeed and silently
    // overwrite the remote edit instead of 409ing. Only an explicit
    // retry()/discard() may resume saving.
    expect(snapshot.status).toBe("conflict");
    expect(store.loadPage).not.toHaveBeenCalled();

    // The pending debounce from edit() must not fire on its own.
    await vi.advanceTimersByTimeAsync(1_000);
    expect(savePage).not.toHaveBeenCalled();
  });

  it("flags remoteChanged without touching content while saving", async () => {
    const savePage = vi.fn().mockImplementationOnce(() => new Promise(() => undefined));
    const loadPage = vi.fn();
    const store = makeStore({ savePage, loadPage });
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });

    machine.edit({ markdown: "Mine\n" });
    await vi.advanceTimersByTimeAsync(500);
    expect(machine.getSnapshot().status).toBe("saving");

    machine.handleRemoteChange();

    expect(machine.getSnapshot().remoteChanged).toBe(true);
    expect(machine.getSnapshot().content.markdown).toBe("Mine\n");
    expect(loadPage).not.toHaveBeenCalled();
  });

  it("flags remoteChanged without touching content when in error", async () => {
    const savePage = vi.fn().mockRejectedValueOnce(new StoreRequestError("internal-error", "boom", 500));
    const loadPage = vi.fn();
    const store = makeStore({ savePage, loadPage });
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });

    machine.edit({ markdown: "Mine\n" });
    await vi.advanceTimersByTimeAsync(500);
    expect(machine.getSnapshot().status).toBe("error");

    machine.handleRemoteChange();

    expect(machine.getSnapshot().remoteChanged).toBe(true);
    expect(machine.getSnapshot().content.markdown).toBe("Mine\n");
    expect(loadPage).not.toHaveBeenCalled();
  });

  it("handleReconnectRefetch() follows the same clean/protected rule", async () => {
    const store = makeStore();
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });
    machine.edit({ markdown: "Mine\n" });

    machine.handleReconnectRefetch();

    expect(machine.getSnapshot().remoteChanged).toBe(true);
    expect(machine.getSnapshot().content.markdown).toBe("Mine\n");
  });

  it("ignores a stale out-of-order refetch response", async () => {
    // Two concurrent clean-path refetches (a targeted remote change
    // immediately followed by a reconnect signal) whose network responses
    // resolve out of order — the later request's fresher content must win
    // even though its response arrives first.
    let resolveFirst!: (value: PagePayload) => void;
    const firstPending = new Promise<PagePayload>((resolve) => {
      resolveFirst = resolve;
    });
    const loadPage = vi
      .fn()
      .mockImplementationOnce(() => firstPending)
      .mockResolvedValueOnce({ ...initialPayload, revision: 3, markdown: "Second (fresher)\n" });
    const store = makeStore({ loadPage });
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });

    machine.handleRemoteChange(); // refetch #1 — slow, still pending
    machine.handleReconnectRefetch(); // refetch #2 — resolves immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(machine.getSnapshot().content.markdown).toBe("Second (fresher)\n");

    resolveFirst({ ...initialPayload, revision: 2, markdown: "First (stale, arrives late)\n" });
    await vi.advanceTimersByTimeAsync(0);

    expect(machine.getSnapshot().content.markdown).toBe("Second (fresher)\n");
  });
});

describe("PageSaveMachine — remoteChanged clears on a successful save", () => {
  it("clears remoteChanged once an explicit retry from conflict succeeds", async () => {
    const savePage = vi.fn().mockResolvedValueOnce(savedResult("Edited\n", 2));
    const store = makeStore({ savePage });
    // A long debounce so the fix under test (disarming on remote change) is
    // what prevents a save, not an incidentally-elapsed timer.
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload, debounceMs: 100_000 });

    machine.edit({ markdown: "Edited\n" });
    machine.handleRemoteChange(); // dirty -> conflict, remoteChanged set, debounce disarmed
    expect(machine.getSnapshot().status).toBe("conflict");
    expect(machine.getSnapshot().remoteChanged).toBe(true);

    machine.retry();
    await vi.advanceTimersByTimeAsync(0);

    const snapshot = machine.getSnapshot();
    expect(snapshot.status).toBe("saved");
    expect(snapshot.remoteChanged).toBe(false);
  });
});

describe("PageSaveMachine — guarded no-ops", () => {
  it("retry() and discard() do nothing outside error/conflict", () => {
    const store = makeStore();
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: initialPayload });

    machine.retry();
    machine.discard();

    expect(machine.getSnapshot().status).toBe("idle");
    expect(store.savePage).not.toHaveBeenCalled();
    expect(store.loadPage).not.toHaveBeenCalled();
  });
});
