import { describe, expect, it, vi } from "vitest";
import {
  StoreRequestError,
  type PagePayload,
  type ProjectStore,
} from "../../../store/index";
import { PageSessionRegistry } from "../page-sessions";
import { INSTALLATION_ID, INTRODUCTION_ID, createEditorTestStore } from "./support";

/** A store whose `loadPage` resolves only when the test says so. */
function deferredStore(inner: ProjectStore) {
  const pending: Array<(value: void) => void> = [];
  const store: ProjectStore = {
    loadSnapshot: () => inner.loadSnapshot(),
    applyOutlineCommand: (revision, command) =>
      inner.applyOutlineCommand(revision, command),
    savePage: (id, revision, input) => inner.savePage(id, revision, input),
    loadPage: async (id) => {
      await new Promise<void>((resolve) => pending.push(resolve));
      return inner.loadPage(id);
    },
  };
  return { store, release: () => pending.splice(0).forEach((resolve) => resolve()) };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("PageSessionRegistry", () => {
  it("loads a page and exposes its save machine", async () => {
    const registry = new PageSessionRegistry({ store: createEditorTestStore() });
    registry.open(INSTALLATION_ID);
    expect(registry.get(INSTALLATION_ID)?.status).toBe("loading");

    await flush();

    const session = registry.get(INSTALLATION_ID);
    expect(session?.status).toBe("ready");
    expect(session?.machine).toBeDefined();
    expect(session?.save?.content.frontmatter.title).toBe("Installation");
    expect(session?.slug).toBe("installation");
  });

  it("publishes a new snapshot object only when something changed", async () => {
    const registry = new PageSessionRegistry({ store: createEditorTestStore() });
    const listener = vi.fn();
    registry.subscribe(listener);

    const before = registry.getSnapshot();
    registry.open(INSTALLATION_ID);
    await flush();

    expect(registry.getSnapshot()).not.toBe(before);
    // Re-opening an already-open tab must not restart the load.
    const stable = registry.getSnapshot();
    registry.open(INSTALLATION_ID);
    expect(registry.getSnapshot()).toBe(stable);
  });

  it("mirrors every machine transition into the session snapshot", async () => {
    const registry = new PageSessionRegistry({ store: createEditorTestStore() });
    registry.open(INSTALLATION_ID);
    await flush();

    registry.get(INSTALLATION_ID)?.machine?.edit({ markdown: "changed" });

    expect(registry.get(INSTALLATION_ID)?.save?.status).toBe("dirty");
    expect(registry.get(INSTALLATION_ID)?.save?.content.markdown).toBe("changed");
  });

  it("keeps one session per open tab, independently", async () => {
    const registry = new PageSessionRegistry({ store: createEditorTestStore() });
    registry.open(INSTALLATION_ID);
    registry.open(INTRODUCTION_ID);
    await flush();

    registry.get(INSTALLATION_ID)?.machine?.edit({ markdown: "only this one" });

    expect(registry.get(INSTALLATION_ID)?.save?.status).toBe("dirty");
    expect(registry.get(INTRODUCTION_ID)?.save?.status).toBe("idle");
  });

  it("records a failed load and recovers on reload", async () => {
    const inner = createEditorTestStore();
    let failNext = true;
    const store: ProjectStore = {
      loadSnapshot: () => inner.loadSnapshot(),
      applyOutlineCommand: (revision, command) =>
        inner.applyOutlineCommand(revision, command),
      savePage: (id, revision, input) => inner.savePage(id, revision, input),
      loadPage: async (id): Promise<PagePayload> => {
        if (failNext) {
          failNext = false;
          throw new StoreRequestError("page-not-found", "No such page.", 404);
        }
        return inner.loadPage(id);
      },
    };

    const registry = new PageSessionRegistry({ store });
    registry.open(INSTALLATION_ID);
    await flush();
    expect(registry.get(INSTALLATION_ID)).toMatchObject({
      status: "error",
      error: { code: "page-not-found" },
    });

    registry.reload(INSTALLATION_ID);
    await flush();
    expect(registry.get(INSTALLATION_ID)?.status).toBe("ready");
  });

  it("lets a pending autosave land after its tab is closed", async () => {
    const store = createEditorTestStore();
    const registry = new PageSessionRegistry({ store, debounceMs: 5 });
    registry.open(INSTALLATION_ID);
    await flush();

    registry.get(INSTALLATION_ID)?.machine?.edit({ markdown: "typed then closed" });
    // Closing inside the debounce window used to dispose the machine, which
    // clears the timer — the edit vanished with no error anywhere.
    registry.close(INSTALLATION_ID);
    expect(registry.get(INSTALLATION_ID)).toBeUndefined();

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect((await store.loadPage(INSTALLATION_ID)).markdown).toBe("typed then closed");
  });

  it("abandons a retiring machine when the workspace unmounts", async () => {
    const registry = new PageSessionRegistry({
      store: createEditorTestStore(),
      debounceMs: 5,
    });
    registry.open(INSTALLATION_ID);
    await flush();

    const machine = registry.get(INSTALLATION_ID)?.machine;
    const dispose = vi.spyOn(machine!, "dispose");
    registry.close(INSTALLATION_ID);
    registry.dispose();

    expect(dispose).toHaveBeenCalled();
  });

  it("does not resurrect a session closed while its load was in flight", async () => {
    const { store, release } = deferredStore(createEditorTestStore());
    const registry = new PageSessionRegistry({ store });

    registry.open(INSTALLATION_ID);
    registry.close(INSTALLATION_ID);
    release();
    await flush();

    expect(registry.get(INSTALLATION_ID)).toBeUndefined();
  });

  it("disposes every machine when the workspace unmounts", async () => {
    const registry = new PageSessionRegistry({ store: createEditorTestStore() });
    registry.open(INSTALLATION_ID);
    await flush();

    const machine = registry.get(INSTALLATION_ID)?.machine;
    const dispose = vi.spyOn(machine!, "dispose");
    registry.dispose();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(registry.getSnapshot().size).toBe(0);
  });
});
