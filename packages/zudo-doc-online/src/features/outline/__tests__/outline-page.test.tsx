// @vitest-environment jsdom
/**
 * Surface-level specs. Every one of these drives the real memory provider
 * through the real revision coordinator, so "the rename round-trips" means
 * the command the API server would run actually ran — not that a spy was
 * called.
 */
import { afterEach, describe, expect, it } from "vitest";
import { act } from "preact/test-utils";
import type { ProjectStore } from "../../../store/contract.js";
import { ProjectEventsClient } from "../../../store/events.js";
import { createFakeEventSourceFactory } from "../../../store/__tests__/support.js";
import type { MemoryProjectStore } from "../../../store/memory-provider.js";
import { OutlinePage } from "../outline-page.js";
import type { OutlineViewProps } from "../view-props.js";
import {
  buttonContaining,
  buttonWithText,
  byLabel,
  click,
  compose,
  createWiring,
  flush,
  memoryViewStorage,
  mount,
  pressKey,
  queryByLabel,
  typeInto,
} from "./support.js";

interface Surface {
  container: HTMLElement;
  memory: MemoryProjectStore;
  unmount(): void;
}

/** Mounts the surface over a fresh memory-backed copy of the fixture project. */
async function mountSurface(): Promise<Surface> {
  const wiring = createWiring();
  const view = await mount(
    <OutlinePage
      store={wiring.store}
      coordinator={wiring.coordinator}
      viewStorage={memoryViewStorage()}
    />,
  );
  return { container: view.container, memory: wiring.memory, unmount: view.unmount };
}

async function pageIdsOf(
  memory: MemoryProjectStore,
  categoryId: string,
): Promise<string[]> {
  const snapshot = await memory.loadSnapshot();
  return (
    snapshot.outline.categories
      .find((category) => category.id === categoryId)
      ?.pages.map((page) => page.id) ?? []
  );
}

async function categoryTitles(memory: MemoryProjectStore): Promise<string[]> {
  const snapshot = await memory.loadSnapshot();
  return snapshot.outline.categories.map((category) => category.title);
}

describe("OutlinePage — tree", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the derived top page, the categories, and their pages", async () => {
    const view = await mountSurface();

    const text = view.container.textContent ?? "";
    expect(text).toContain("Top page");
    expect(text).toContain("derived");
    expect(text).toContain("generated category grid — not directly authored");
    expect(text).toContain("alpha/");
    expect(text).toContain("3 pages");
    expect(text).toContain("Gamma");
    expect(text).toContain("category page");
    expect(text).toContain("draft");

    view.unmount();
  });

  it("scopes the consequence preview to the selected category, and back out through the top-page row", async () => {
    const view = await mountSurface();

    // The first category is scoped on load, so the preview is never empty.
    expect(view.container.textContent ?? "").toContain("Category view");
    expect(view.container.textContent ?? "").toContain("/docs/alpha");

    await click(byLabel(view.container, "Select category Beta"));
    expect(view.container.textContent ?? "").toContain("/docs/beta");

    await click(buttonWithText(view.container, "Top page"));
    expect(view.container.textContent ?? "").not.toContain("Category view");
    expect(view.container.textContent ?? "").toContain("Select a category");

    view.unmount();
  });

  it("collapses and expands a category", async () => {
    const view = await mountSurface();

    expect(view.container.textContent ?? "").toContain("Add page to Alpha");
    await click(byLabel(view.container, "Collapse Alpha"));
    expect(view.container.textContent ?? "").not.toContain("Add page to Alpha");

    await click(byLabel(view.container, "Expand Alpha"));
    expect(view.container.textContent ?? "").toContain("Add page to Alpha");

    view.unmount();
  });
});

describe("OutlinePage — inline rename", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renames a category through the outline command, leaving its published slug alone", async () => {
    const view = await mountSurface();

    await click(byLabel(view.container, "Rename category Alpha"));
    const input = byLabel(
      view.container,
      "Rename category “Alpha”",
    ) as HTMLInputElement;
    typeInto(input, "Getting started");
    await pressKey(input, "Enter");

    expect(await categoryTitles(view.memory)).toEqual([
      "Getting started",
      "Beta",
      "Gamma",
    ]);
    expect(view.container.textContent ?? "").toContain("Getting started");
    expect(view.container.textContent ?? "").toContain("Saved");
    expect(view.container.textContent ?? "").toContain("alpha/");

    view.unmount();
  });

  it("never commits on an Enter that belongs to an input method", async () => {
    const view = await mountSurface();

    await click(byLabel(view.container, "Rename category Alpha"));
    const input = byLabel(
      view.container,
      "Rename category “Alpha”",
    ) as HTMLInputElement;
    typeInto(input, "はじめに");

    await compose(input, "compositionstart");
    await pressKey(input, "Enter");

    // Still editing: the IME's confirm-candidate Enter was not a commit.
    expect(queryByLabel(view.container, "Rename category “Alpha”")).not.toBeNull();
    expect(await categoryTitles(view.memory)).toEqual(["Alpha", "Beta", "Gamma"]);

    await compose(input, "compositionend");
    await pressKey(input, "Enter");

    expect(await categoryTitles(view.memory)).toEqual([
      "はじめに",
      "Beta",
      "Gamma",
    ]);

    view.unmount();
  });

  it("never cancels on an Escape that belongs to an input method", async () => {
    const view = await mountSurface();

    await click(byLabel(view.container, "Rename category Alpha"));
    const input = byLabel(
      view.container,
      "Rename category “Alpha”",
    ) as HTMLInputElement;

    await compose(input, "compositionstart");
    await pressKey(input, "Escape");
    expect(queryByLabel(view.container, "Rename category “Alpha”")).not.toBeNull();

    await compose(input, "compositionend");
    await pressKey(input, "Escape");
    expect(queryByLabel(view.container, "Rename category “Alpha”")).toBeNull();

    view.unmount();
  });

  it("saves a page rename as frontmatter, leaving the outline structure alone", async () => {
    const view = await mountSurface();

    await click(byLabel(view.container, "Rename page One"));
    const input = byLabel(view.container, "Rename page “One”") as HTMLInputElement;
    typeInto(input, "First steps");
    await pressKey(input, "Enter");

    const snapshot = await view.memory.loadSnapshot();
    expect(
      snapshot.pages.find((page) => page.id === "page-alpha-one")?.title,
    ).toBe("First steps");
    // Title ownership: the outline still stores nothing but id + slug.
    expect(
      snapshot.outline.categories[0]?.pages.find(
        (page) => page.id === "page-alpha-one",
      ),
    ).toEqual({ id: "page-alpha-one", slug: "one" });
    expect(view.container.textContent ?? "").toContain("First steps");

    view.unmount();
  });

  it("keeps a page's description when only its title changes", async () => {
    const view = await mountSurface();

    await click(byLabel(view.container, "Rename page Alpha"));
    const input = byLabel(
      view.container,
      "Rename page “Alpha”",
    ) as HTMLInputElement;
    typeInto(input, "Overview");
    await pressKey(input, "Enter");

    const page = await view.memory.loadPage("page-alpha-index");
    expect(page.frontmatter).toEqual({
      title: "Overview",
      description: "Everything in the alpha section.",
    });

    view.unmount();
  });

  it("changes a page slug through set-page-slug", async () => {
    const view = await mountSurface();

    await click(byLabel(view.container, "Change the URL segment of One"));
    const input = byLabel(
      view.container,
      "Change the URL segment of “One”",
    ) as HTMLInputElement;
    typeInto(input, "first-steps");
    await pressKey(input, "Enter");

    const snapshot = await view.memory.loadSnapshot();
    expect(
      snapshot.outline.categories[0]?.pages.find(
        (page) => page.id === "page-alpha-one",
      )?.slug,
    ).toBe("first-steps");

    view.unmount();
  });

  it("reports a rejected slug instead of pretending the change stuck", async () => {
    const view = await mountSurface();

    await click(byLabel(view.container, "Change the URL segment of One"));
    const input = byLabel(
      view.container,
      "Change the URL segment of “One”",
    ) as HTMLInputElement;
    typeInto(input, "Not A Slug");
    await pressKey(input, "Enter");

    expect(view.container.textContent ?? "").toContain("Not saved");
    expect(view.container.textContent ?? "").toContain("Invalid slug");
    const snapshot = await view.memory.loadSnapshot();
    expect(
      snapshot.outline.categories[0]?.pages.find(
        (page) => page.id === "page-alpha-one",
      )?.slug,
    ).toBe("one");

    view.unmount();
  });
});

describe("OutlinePage — delete", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("asks before deleting a category, naming the pages it takes along", async () => {
    const view = await mountSurface();

    await click(byLabel(view.container, "Delete category Alpha"));

    expect(view.container.textContent ?? "").toContain(
      "Delete “Alpha” and the 3 pages inside it?",
    );
    expect(document.activeElement).toBe(
      buttonWithText(view.container, "Cancel"),
    );

    await click(buttonWithText(view.container, "Cancel"));
    expect(await categoryTitles(view.memory)).toEqual(["Alpha", "Beta", "Gamma"]);

    await click(byLabel(view.container, "Delete category Alpha"));
    await click(buttonWithText(view.container, "Delete category"));

    expect(await categoryTitles(view.memory)).toEqual(["Beta", "Gamma"]);
    // Selection was repaired onto a category that still exists.
    expect(view.container.textContent ?? "").toContain("/docs/beta");

    view.unmount();
  });

  it("deletes a page after its own confirm", async () => {
    const view = await mountSurface();

    await click(byLabel(view.container, "Delete page Two"));
    expect(view.container.textContent ?? "").toContain("Delete “Two”?");
    await click(buttonWithText(view.container, "Delete page"));

    expect(await pageIdsOf(view.memory, "cat-alpha")).toEqual([
      "page-alpha-index",
      "page-alpha-one",
    ]);

    view.unmount();
  });
});

describe("OutlinePage — moves", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("moves a page one slot within its category", async () => {
    const view = await mountSurface();

    await click(byLabel(view.container, "Move page One down"));

    expect(await pageIdsOf(view.memory, "cat-alpha")).toEqual([
      "page-alpha-index",
      "page-alpha-two",
      "page-alpha-one",
    ]);

    view.unmount();
  });

  it("disables the move buttons at either end rather than sending a rejected index", async () => {
    const view = await mountSurface();

    expect(
      (byLabel(view.container, "Move page Alpha up") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (byLabel(view.container, "Move page Two down") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (byLabel(view.container, "Move category Alpha up") as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    view.unmount();
  });

  it("reorders categories", async () => {
    const view = await mountSurface();

    await click(byLabel(view.container, "Move category Gamma up"));

    expect(await categoryTitles(view.memory)).toEqual(["Alpha", "Gamma", "Beta"]);

    view.unmount();
  });

  it("moves a page across categories through the picker, warning about a slug that is already taken", async () => {
    const view = await mountSurface();

    await click(byLabel(view.container, "Move page Alpha out of Alpha"));

    const picker = byLabel(view.container, "Move page to another category");
    expect(picker.textContent ?? "").toContain("Already has a page at “index”");
    expect(buttonContaining(picker, "Beta").disabled).toBe(true);

    await click(buttonContaining(picker, "Gamma"));

    expect(await pageIdsOf(view.memory, "cat-alpha")).toEqual([
      "page-alpha-one",
      "page-alpha-two",
    ]);
    expect(await pageIdsOf(view.memory, "cat-gamma")).toEqual([
      "page-alpha-index",
    ]);

    view.unmount();
  });
});

describe("OutlinePage — adding", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("adds a page to a category and derives its slug from the title", async () => {
    const view = await mountSurface();

    await click(buttonContaining(view.container, "Add page to Alpha"));
    const input = byLabel(
      view.container,
      "Title of the new page in Alpha",
    ) as HTMLInputElement;
    typeInto(input, "Quick start");
    await pressKey(input, "Enter");

    const snapshot = await view.memory.loadSnapshot();
    const added = snapshot.outline.categories[0]?.pages.at(-1);
    expect(added?.slug).toBe("quick-start");
    expect(snapshot.pages.find((page) => page.id === added?.id)?.title).toBe(
      "Quick start",
    );
    expect(view.container.textContent ?? "").toContain("Quick start");

    view.unmount();
  });

  it("adds a category at the end and scopes the preview to it", async () => {
    const view = await mountSurface();

    await click(buttonContaining(view.container, "Add category"));
    const input = byLabel(
      view.container,
      "Title of the new category",
    ) as HTMLInputElement;
    typeInto(input, "Reference");
    await pressKey(input, "Enter");

    expect(await categoryTitles(view.memory)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
      "Reference",
    ]);
    expect(view.container.textContent ?? "").toContain("/docs/reference");

    view.unmount();
  });

  it("keeps the editor open on an empty title instead of sending one", async () => {
    const view = await mountSurface();

    await click(buttonContaining(view.container, "Add category"));
    const input = byLabel(
      view.container,
      "Title of the new category",
    ) as HTMLInputElement;
    typeInto(input, "   ");
    await pressKey(input, "Enter");

    expect(queryByLabel(view.container, "Title of the new category")).not.toBeNull();
    expect(await categoryTitles(view.memory)).toEqual(["Alpha", "Beta", "Gamma"]);

    view.unmount();
  });
});

describe("OutlinePage — conflicts", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("holds a 409'd change for a decision, and applies it on retry", async () => {
    const view = await mountSurface();

    // Somebody else committed first, so the revision this tab is holding is
    // genuinely stale — no auto-retry is allowed to paper over that.
    view.memory.applyExternalOutlineCommand({
      type: "rename-category",
      categoryId: "cat-gamma",
      title: "Gamma external",
    });

    await click(byLabel(view.container, "Move category Beta up"));

    expect(view.container.textContent ?? "").toContain(
      "Move category was not applied",
    );
    expect(view.container.textContent ?? "").toContain("Conflict");
    // Nothing was being edited, so the tree rebased onto the server's state.
    expect(view.container.textContent ?? "").toContain("Gamma external");
    expect(await categoryTitles(view.memory)).toEqual([
      "Alpha",
      "Beta",
      "Gamma external",
    ]);

    await click(buttonWithText(view.container, "Retry my change"));

    expect(await categoryTitles(view.memory)).toEqual([
      "Beta",
      "Alpha",
      "Gamma external",
    ]);
    expect(view.container.textContent ?? "").not.toContain("was not applied");
    expect(view.container.textContent ?? "").toContain("Saved");

    view.unmount();
  });

  it("rebases a retried page rename onto the server's frontmatter instead of reverting it", async () => {
    const view = await mountSurface();

    // A second editor stays open for the whole test, which is what makes the
    // 409 keep the draft: the displayed tree is deliberately NOT rebased, so
    // a retry that rebuilt its payload from what is on screen would resend
    // pre-conflict frontmatter — and `savePage` replaces the block wholesale,
    // so the other client's description edit would silently disappear.
    await click(byLabel(view.container, "Rename category Alpha"));

    view.memory.applyExternalPageWrite("page-alpha-index", {
      frontmatter: { title: "Alpha", description: "Rewritten by an agent." },
    });

    await click(byLabel(view.container, "Rename page Alpha"));
    const input = byLabel(
      view.container,
      "Rename page “Alpha”",
    ) as HTMLInputElement;
    typeInto(input, "Overview");
    await pressKey(input, "Enter");

    expect(view.container.textContent ?? "").toContain("was not applied");
    expect(view.container.textContent ?? "").toContain(
      "Your in-progress edit is kept",
    );
    // The tree still shows pre-conflict state, so only the conflict snapshot
    // knows about the remote description.
    expect(queryByLabel(view.container, "Rename category “Alpha”")).not.toBeNull();

    await click(buttonWithText(view.container, "Retry my change"));

    const page = await view.memory.loadPage("page-alpha-index");
    expect(page.frontmatter).toEqual({
      title: "Overview",
      description: "Rewritten by an agent.",
    });

    view.unmount();
  });

  it("drops the failed change when the user adopts the server's outline", async () => {
    const view = await mountSurface();

    view.memory.applyExternalOutlineCommand({
      type: "rename-category",
      categoryId: "cat-gamma",
      title: "Gamma external",
    });
    await click(byLabel(view.container, "Move category Beta up"));
    await click(buttonWithText(view.container, "Adopt latest"));

    expect(view.container.textContent ?? "").not.toContain("was not applied");
    expect(await categoryTitles(view.memory)).toEqual([
      "Alpha",
      "Beta",
      "Gamma external",
    ]);

    view.unmount();
  });
});

describe("OutlinePage — live external changes", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  async function mountWithEvents() {
    const wiring = createWiring();
    const sources = createFakeEventSourceFactory();
    const events = new ProjectEventsClient({
      projectSlug: "test-project",
      clientId: "this-tab",
      createEventSource: sources.factory,
    });
    const view = await mount(
      <OutlinePage
        store={wiring.store}
        coordinator={wiring.coordinator}
        events={events}
        viewStorage={memoryViewStorage()}
      />,
    );
    sources.instances[0]?.emitOpen();
    return { ...view, memory: wiring.memory, sources };
  }

  async function announceExternalRename(
    handle: Awaited<ReturnType<typeof mountWithEvents>>,
    origin: string,
  ) {
    handle.memory.applyExternalOutlineCommand({
      type: "rename-category",
      categoryId: "cat-beta",
      title: "Beta from an agent",
    });
    handle.sources.instances[0]?.emitMessage({
      type: "outline-changed",
      revision: handle.memory.getRevision(),
      origin,
    });
    await flush();
  }

  it("catches up on a change that landed before the stream opened", async () => {
    const wiring = createWiring();
    const sources = createFakeEventSourceFactory();
    const events = new ProjectEventsClient({
      projectSlug: "test-project",
      clientId: "this-tab",
      createEventSource: sources.factory,
    });
    const view = await mount(
      <OutlinePage
        store={wiring.store}
        coordinator={wiring.coordinator}
        events={events}
        viewStorage={memoryViewStorage()}
      />,
    );

    // Committed in the gap between the initial snapshot read and the stream
    // reaching `open`. SSE replays nothing, so no event will ever announce
    // it — only a refresh at open time can find it.
    wiring.memory.applyExternalOutlineCommand({
      type: "rename-category",
      categoryId: "cat-beta",
      title: "Renamed before open",
    });
    await flush();
    expect(view.container.textContent ?? "").not.toContain("Renamed before open");

    sources.instances[0]?.emitOpen();
    await flush();

    expect(view.container.textContent ?? "").toContain("Renamed before open");

    view.unmount();
  });

  it("refreshes on a remote change when nothing is being edited", async () => {
    const view = await mountWithEvents();

    await announceExternalRename(view, "some-agent");

    expect(view.container.textContent ?? "").toContain("Beta from an agent");

    view.unmount();
  });

  it("never clobbers an open editor — it defers the refresh until the edit closes", async () => {
    const view = await mountWithEvents();

    await click(byLabel(view.container, "Rename category Alpha"));
    const input = byLabel(
      view.container,
      "Rename category “Alpha”",
    ) as HTMLInputElement;
    typeInto(input, "Half-typed name");

    await announceExternalRename(view, "some-agent");

    // The editor is still open with its text, and the tree has not jumped.
    expect(queryByLabel(view.container, "Rename category “Alpha”")).not.toBeNull();
    expect(input.value).toBe("Half-typed name");
    expect(view.container.textContent ?? "").not.toContain("Beta from an agent");
    expect(view.container.textContent ?? "").toContain(
      "This project changed elsewhere",
    );

    await click(buttonWithText(view.container, "Cancel"));

    expect(view.container.textContent ?? "").toContain("Beta from an agent");
    expect(view.container.textContent ?? "").not.toContain(
      "This project changed elsewhere",
    );

    view.unmount();
  });

  it("ignores this tab's own echo", async () => {
    const view = await mountWithEvents();

    await click(byLabel(view.container, "Rename category Alpha"));
    typeInto(
      byLabel(view.container, "Rename category “Alpha”") as HTMLInputElement,
      "Draft in progress",
    );

    view.sources.instances[0]?.emitMessage({
      type: "outline-changed",
      revision: view.memory.getRevision(),
      origin: "this-tab",
    });
    await flush();

    expect(view.container.textContent ?? "").not.toContain(
      "This project changed elsewhere",
    );

    view.unmount();
  });
});

describe("OutlinePage — out-of-order responses", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("keeps both renames when two page writes are queued before either responds", async () => {
    const view = await mountSurface();

    // Both editors open first, so the two commits fire back to back with no
    // response in between — each one would otherwise patch the same
    // pre-enqueue snapshot and the second would drop the first.
    await click(byLabel(view.container, "Rename page One"));
    await click(byLabel(view.container, "Rename page Two"));
    const first = byLabel(view.container, "Rename page “One”") as HTMLInputElement;
    const second = byLabel(view.container, "Rename page “Two”") as HTMLInputElement;
    typeInto(first, "First steps");
    typeInto(second, "Second steps");

    await act(() => {
      first.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      second.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    await flush();

    const snapshot = await view.memory.loadSnapshot();
    expect(
      snapshot.pages.filter((page) => page.title.endsWith("steps")).map((p) => p.title),
    ).toEqual(["First steps", "Second steps"]);
    // The UI has to agree with the server, not show only the last writer.
    expect(view.container.textContent ?? "").toContain("First steps");
    expect(view.container.textContent ?? "").toContain("Second steps");

    view.unmount();
  });

  it("ignores a refresh response that lost the race to a newer mutation", async () => {
    const wiring = createWiring();
    const sources = createFakeEventSourceFactory();
    const events = new ProjectEventsClient({
      projectSlug: "test-project",
      clientId: "this-tab",
      createEventSource: sources.factory,
    });

    // Holds the SECOND loadSnapshot open so a mutation can overtake it.
    const held: Array<() => void> = [];
    let holdLoads = false;
    const gated: ProjectStore = {
      loadSnapshot: async () => {
        const snapshot = await wiring.store.loadSnapshot();
        if (holdLoads) {
          await new Promise<void>((resolve) => held.push(resolve));
        }
        return snapshot;
      },
      applyOutlineCommand: (revision, command) =>
        wiring.store.applyOutlineCommand(revision, command),
      loadPage: (id) => wiring.store.loadPage(id),
      savePage: (id, revision, input) => wiring.store.savePage(id, revision, input),
    };

    const view = await mount(
      <OutlinePage
        store={gated}
        coordinator={wiring.coordinator}
        events={events}
        viewStorage={memoryViewStorage()}
      />,
    );
    sources.instances[0]?.emitOpen();
    // Opening the stream triggers its own catch-up refresh (an event landing
    // between the initial load and `open` would otherwise be missed) — let it
    // settle before gating reads, so the only held load is the one this spec
    // is about.
    await flush();

    holdLoads = true;
    sources.instances[0]?.emitMessage({
      type: "outline-changed",
      revision: wiring.memory.getRevision(),
      origin: "some-agent",
    });
    await flush();
    expect(held).toHaveLength(1);

    await click(byLabel(view.container, "Rename category Alpha"));
    const input = byLabel(
      view.container,
      "Rename category “Alpha”",
    ) as HTMLInputElement;
    typeInto(input, "Getting started");
    await pressKey(input, "Enter");
    expect(view.container.textContent ?? "").toContain("Getting started");

    // The in-flight read now returns state from BEFORE the rename.
    held[0]?.();
    await flush();

    expect(view.container.textContent ?? "").toContain("Getting started");
    expect(await categoryTitles(wiring.memory)).toEqual([
      "Getting started",
      "Beta",
      "Gamma",
    ]);

    view.unmount();
  });
});

describe("OutlinePage — view switch", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("persists the picked view and restores it on the next mount", async () => {
    const viewStorage = memoryViewStorage();
    const firstWiring = createWiring();

    const first = await mount(
      <OutlinePage
        store={firstWiring.store}
        coordinator={firstWiring.coordinator}
        viewStorage={viewStorage}
      />,
    );
    await click(buttonWithText(first.container, "Board"));

    expect(viewStorage.values["zudo-doc-online-outline-view"]).toBe("board");
    expect(first.container.textContent ?? "").toContain("Board view");
    expect(first.container.textContent ?? "").toContain("sub-issue #3337");
    expect(first.container.textContent ?? "").not.toContain("Site structure");
    first.unmount();

    const secondWiring = createWiring();
    const second = await mount(
      <OutlinePage
        store={secondWiring.store}
        coordinator={secondWiring.coordinator}
        viewStorage={viewStorage}
      />,
    );
    expect(
      buttonWithText(second.container, "Board").getAttribute("aria-pressed"),
    ).toBe("true");
    second.unmount();
  });

  it("mounts a supplied board view with the snapshot, dispatch and selection", async () => {
    const wiring = createWiring();

    function BoardStub({ snapshot, dispatch, selection }: OutlineViewProps) {
      return (
        <button
          type="button"
          onClick={() =>
            void dispatch({
              type: "rename-category",
              categoryId: "cat-beta",
              title: "Renamed from the board",
            })
          }
        >
          board sees {snapshot.outline.categories.length} categories, scoped to{" "}
          {selection.categoryId}
        </button>
      );
    }

    const view = await mount(
      <OutlinePage
        store={wiring.store}
        coordinator={wiring.coordinator}
        viewStorage={memoryViewStorage({
          "zudo-doc-online-outline-view": "board",
        })}
        boardView={BoardStub}
      />,
    );

    expect(view.container.textContent ?? "").toContain("board sees 3 categories");
    expect(view.container.textContent ?? "").toContain("scoped to cat-alpha");

    await click(buttonContaining(view.container, "board sees"));
    expect(await categoryTitles(wiring.memory)).toEqual([
      "Alpha",
      "Renamed from the board",
      "Gamma",
    ]);

    view.unmount();
  });
});

describe("OutlinePage — honest save chip", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("starts up to date and reports an accepted no-op as a no-op, not as saved", async () => {
    const view = await mountSurface();

    expect(view.container.textContent ?? "").toContain("Up to date");
    expect(view.container.textContent ?? "").toContain(
      "no pending structure change",
    );

    // Renaming a category to the name it already has changes nothing, and
    // the server burns no revision for it.
    await click(byLabel(view.container, "Rename category Alpha"));
    const input = byLabel(
      view.container,
      "Rename category “Alpha”",
    ) as HTMLInputElement;
    typeInto(input, "Alpha");
    await pressKey(input, "Enter");

    expect(view.container.textContent ?? "").toContain("No change");
    expect(view.container.textContent ?? "").not.toContain("Saved");

    view.unmount();
  });
});
