// @vitest-environment jsdom
/**
 * Integration specs for the workspace chrome, driven against the in-memory
 * store rather than mocks: a title edit really round-trips through
 * `PageSaveMachine` → `savePage`, and a Position edit really dispatches a
 * `move-page` outline command. The epic bars children from browser tooling,
 * so anything genuinely visual (pixel widths, stacking, the drag gesture)
 * is left to the manager's central browser pass — see the report.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import { ProjectEventsClient, type MemoryProjectStore } from "../../../store/index";
import { editorContentTicker } from "../use-editor-content";
import { createFakeEventSourceFactory } from "../../../store/__tests__/support";
import { mountWorkspace, queryByText, requireElement, settle } from "./harness";
import { act } from "preact/test-utils";
import { VIM_MODE_STORAGE_KEY } from "../persistence";
import {
  INSTALLATION_ID,
  INTRODUCTION_ID,
  THEMING_ID,
  createEditorTestStore,
  createFakeStorage,
} from "./support";

let store: MemoryProjectStore;
let mounted: Awaited<ReturnType<typeof mountWorkspace>> | undefined;

async function mount(routePageId = INSTALLATION_ID, extra = {}) {
  const snapshot = await store.loadSnapshot();
  mounted = await mountWorkspace({
    store,
    snapshot,
    routePageId,
    saveDebounceMs: 1,
    ...extra,
  });
  return mounted;
}

function tabLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[role="tab"]')].map(
    (tab) => tab.textContent?.trim() ?? "",
  );
}

function activeTabLabel(container: HTMLElement): string {
  return (
    container.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ??
    ""
  );
}

function typeInto(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * The markdown buffer is a CodeMirror view, so these specs drive it through
 * a transaction rather than an `input` event — `EditorView.findFromDOM` is
 * the supported way to reach the instance the pane mounted.
 */
function editorView(container: HTMLElement): EditorView {
  const view = EditorView.findFromDOM(requireElement<HTMLElement>(container, ".cm-editor"));
  if (!view) throw new Error("no CodeMirror view is mounted");
  return view;
}

function editorText(container: HTMLElement): string {
  return editorView(container).state.doc.toString();
}

function typeIntoEditor(container: HTMLElement, markdown: string): void {
  const view = editorView(container);
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: markdown },
    // Leave the caret where typing the text would have left it, so the status
    // bar's Ln/Col is asserted against something a user could actually see.
    selection: { anchor: markdown.length },
  });
}

beforeEach(() => {
  store = createEditorTestStore();
});

afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  editorContentTicker.reset();
  document.body.innerHTML = "";
});

describe("deep link and tab strip", () => {
  it("opens the routed page as the active tab and fills the chrome from it", async () => {
    const { container } = await mount();

    expect(activeTabLabel(container)).toContain("Installation");
    expect(requireElement<HTMLInputElement>(container, "#zdo-meta-title").value).toBe(
      "Installation",
    );
    expect(requireElement<HTMLInputElement>(container, "#zdo-meta-position").value).toBe(
      "3",
    );
    expect(container.textContent).toContain("installation.mdx");
    expect(container.textContent).toContain("getting-started/installation");
    expect(editorText(container)).toContain("## Prerequisites");
  });

  it("renders every category and page in the expanded rail", async () => {
    const { container } = await mount();
    const rail = requireElement(container, 'nav[aria-label="Pages"]');

    expect(rail.textContent).toContain("Getting started");
    expect(rail.textContent).toContain("Guides");
    expect(rail.textContent).toContain("Reference");
    expect(rail.textContent).toContain("14 pages");
    // The draft badge is the page's own frontmatter flag, not session state.
    expect(rail.querySelectorAll("span")).toBeTruthy();
    expect(queryByText(rail, "span", "draft")).toBeDefined();
  });

  it("opens a tab when a tree page is selected, and keeps the route in step", async () => {
    const { container, navigations } = await mount();

    const themingRow = queryByText<HTMLButtonElement>(
      requireElement(container, 'nav[aria-label="Pages"]'),
      "span",
      "Theming",
    )?.closest("button");
    themingRow?.click();
    await settle();

    expect(navigations).toContain(THEMING_ID);
    expect(tabLabels(container).join(" ")).toContain("Theming");
    expect(activeTabLabel(container)).toContain("Theming");
  });

  it("persists the open tab set so a reload restores it", async () => {
    const { container, storage } = await mount();

    queryByText<HTMLElement>(
      requireElement(container, 'nav[aria-label="Pages"]'),
      "span",
      "Introduction",
    )
      ?.closest("button")
      ?.click();
    await settle();

    expect(JSON.parse(storage.entries.get("zdo-editor-tabs") ?? "[]")).toEqual([
      INSTALLATION_ID,
      INTRODUCTION_ID,
    ]);
  });
});

describe("closing tabs", () => {
  it("activates the neighbouring tab", async () => {
    const { container, navigations } = await mount();

    queryByText<HTMLElement>(
      requireElement(container, 'nav[aria-label="Pages"]'),
      "span",
      "Introduction",
    )
      ?.closest("button")
      ?.click();
    await settle();

    requireElement<HTMLButtonElement>(
      container,
      'button[aria-label="Close Introduction"]',
    ).click();
    await settle();

    expect(activeTabLabel(container)).toContain("Installation");
    expect(navigations.at(-1)).toBe(INSTALLATION_ID);
  });

  it("asks before discarding a draft that still needs resolving", async () => {
    const sources = createFakeEventSourceFactory();
    const events = new ProjectEventsClient({
      projectSlug: "aurora-docs",
      clientId: "this-tab",
      createEventSource: sources.factory,
    });
    events.connect();
    sources.instances[0]?.emitOpen();

    const { container } = await mount(INSTALLATION_ID, {
      events,
      saveDebounceMs: 100_000,
    });
    typeIntoEditor(container, "unresolved draft");
    await settle();
    store.applyExternalPageWrite(INSTALLATION_ID, { markdown: "remote" });
    sources.instances[0]?.emitMessage({
      type: "page-changed",
      pageId: INSTALLATION_ID,
      revision: store.getRevision(),
      origin: "another-tab",
    });
    await settle();

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    requireElement<HTMLButtonElement>(
      container,
      'button[aria-label="Close Installation"]',
    ).click();
    await settle();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(1);

    confirm.mockReturnValue(true);
    requireElement<HTMLButtonElement>(
      container,
      'button[aria-label="Close Installation"]',
    ).click();
    await settle();

    expect(container.querySelector('[data-testid="left-editor"]')).not.toBeNull();
    confirm.mockRestore();
    events.close();
  });

  it("reports that no page is left when the last tab closes", async () => {
    const { container, navigations } = await mount();

    requireElement<HTMLButtonElement>(
      container,
      'button[aria-label="Close Installation"]',
    ).click();
    await settle();

    expect(navigations.at(-1)).toBeNull();
    expect(container.querySelector('[data-testid="left-editor"]')).not.toBeNull();
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });
});

describe("rail modes", () => {
  it("collapses to the icon rail, persists the choice, and keeps the tree reachable", async () => {
    const { container, storage } = await mount();

    requireElement<HTMLButtonElement>(
      container,
      'button[aria-label="Collapse the page rail"]',
    ).click();
    await settle();

    expect(storage.entries.get("zdo-editor-rail")).toBe("collapsed");
    expect(container.querySelector('nav[aria-label="Pages"]')).toBeNull();
    const iconRail = requireElement(container, 'nav[aria-label="Workspace panels"]');

    const pagesButton = requireElement<HTMLButtonElement>(
      iconRail,
      'button[aria-label="Pages"]',
    );
    expect(pagesButton.getAttribute("aria-expanded")).toBe("false");

    pagesButton.click();
    await settle();

    const flyout = requireElement(container, '[role="dialog"][aria-label="Pages"]');
    expect(pagesButton.getAttribute("aria-expanded")).toBe("true");
    expect(flyout.textContent).toContain("Theming");
  });

  it("restores the persisted rail mode on the next mount", async () => {
    const first = await mount();
    requireElement<HTMLButtonElement>(
      first.container,
      'button[aria-label="Collapse the page rail"]',
    ).click();
    await settle();
    first.unmount();

    const second = await mount(INSTALLATION_ID, { storage: first.storage });
    mounted = second;
    expect(second.container.querySelector('nav[aria-label="Workspace panels"]')).not.toBeNull();
  });
});

describe("metadata autosave", () => {
  it("round-trips a title edit to the store and updates the tab label", async () => {
    const { container } = await mount();

    typeInto(requireElement<HTMLInputElement>(container, "#zdo-meta-title"), "Setting up");
    await settle(5);

    const saved = await store.loadPage(INSTALLATION_ID);
    expect(saved.frontmatter.title).toBe("Setting up");
    expect(activeTabLabel(container)).toContain("Setting up");
    expect(
      container.querySelector('[data-save-state]')?.getAttribute("data-save-state"),
    ).toBe("saved");
  });

  it("drops an emptied description rather than sending a value the schema rejects", async () => {
    const { container } = await mount();

    typeInto(requireElement<HTMLInputElement>(container, "#zdo-meta-description"), "");
    await settle(5);

    const saved = await store.loadPage(INSTALLATION_ID);
    expect(saved.frontmatter.description).toBeUndefined();
    expect(saved.frontmatter.title).toBe("Installation");
  });

  it("refuses to commit a blank title and marks the field invalid", async () => {
    const { container } = await mount();
    const title = requireElement<HTMLInputElement>(container, "#zdo-meta-title");

    typeInto(title, "   ");
    await settle(5);

    expect(title.getAttribute("aria-invalid")).toBe("true");
    expect((await store.loadPage(INSTALLATION_ID)).frontmatter.title).toBe("Installation");
  });
});

describe("markdown autosave", () => {
  it("saves the editor buffer and reports the caret in the status bar", async () => {
    const { container } = await mount();

    typeIntoEditor(container, "one two three");
    // The word count rides the editor's ~100ms content tick; flushing it is
    // how this spec reads the real value without waiting on wall-clock time.
    editorContentTicker.flush();
    await settle(5);

    expect((await store.loadPage(INSTALLATION_ID)).markdown).toBe("one two three");
    expect(container.textContent).toContain("3 words");
    expect(container.textContent).toContain("Ln 1, Col 14");
  });

  it("keeps each tab's buffer with its own page across a switch", async () => {
    const { container } = await mount();

    typeIntoEditor(container, "installation body");
    await settle(5);

    queryByText<HTMLElement>(
      requireElement(container, 'nav[aria-label="Pages"]'),
      "span",
      "Introduction",
    )
      ?.closest("button")
      ?.click();
    await settle();
    typeIntoEditor(container, "introduction body");
    await settle(5);

    expect((await store.loadPage(INSTALLATION_ID)).markdown).toBe("installation body");
    expect((await store.loadPage(INTRODUCTION_ID)).markdown).toBe("introduction body");
  });

  // The buffer's IME guard moved to CodeMirror when the textarea placeholder
  // was replaced (#3336): CodeMirror tracks composition on its own
  // contenteditable and holds the transaction back until the candidate is
  // committed, so there is no `useCompositionGuard` in the pane to test. jsdom
  // cannot drive a real composition on a contenteditable, so this guarantee is
  // in the manager's browser-verification list rather than faked here. The
  // metadata row's own IME guard is still covered in `metadata-row.test.tsx`.
});

describe("position moves", () => {
  it("dispatches a move-page outline command on Enter", async () => {
    const { container } = await mount();
    const position = requireElement<HTMLInputElement>(container, "#zdo-meta-position");

    position.value = "1";
    position.dispatchEvent(new Event("input", { bubbles: true }));
    position.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await settle(4);

    const snapshot = await store.loadSnapshot();
    expect(snapshot.outline.categories[0]?.pages[0]?.id).toBe(INSTALLATION_ID);
    expect(requireElement<HTMLInputElement>(container, "#zdo-meta-position").value).toBe(
      "1",
    );
  });

  it("never commits on a composition Enter (IME triple guard)", async () => {
    const { container } = await mount();
    const position = requireElement<HTMLInputElement>(container, "#zdo-meta-position");

    position.value = "1";
    position.dispatchEvent(new Event("input", { bubbles: true }));
    position.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, keyCode: 229 }),
    );
    await settle(4);

    const snapshot = await store.loadSnapshot();
    expect(snapshot.outline.categories[0]?.pages[2]?.id).toBe(INSTALLATION_ID);
  });
});

describe("the status bar", () => {
  it("routes the vim preference through the workspace's storage override", async () => {
    const { container, storage } = await mount();

    queryByText<HTMLButtonElement>(container, "button", "vim off")?.click();
    await settle();

    // The pane must honour the same override the rest of the chrome does —
    // otherwise an isolated mount silently reads and writes the real
    // localStorage, and the preference leaks between them.
    expect(storage.entries.get("zdo-editor-vim")).toBe("on");
    expect(queryByText(container, "button", "-- NORMAL --")).toBeDefined();
  });

  it("drops the caret and vim controls when no editor is mounted", async () => {
    const { container } = await mount();
    expect(container.textContent).toContain("Ln 1, Col 1");

    // A page whose load fails renders the empty pane instead of an editor.
    // The status the previous page left behind carries `onToggleVim`, so a
    // footer that kept showing it would offer a vim toggle with no editor
    // behind it.
    vi.spyOn(store, "loadPage").mockRejectedValue(new Error("boom"));
    queryByText<HTMLElement>(
      requireElement(container, 'nav[aria-label="Pages"]'),
      "span",
      "Theming",
    )
      ?.closest("button")
      ?.click();
    await settle(5);

    expect(container.textContent).not.toContain("Ln 1, Col 1");
    expect(queryByText(container, "button", "vim off")).toBeUndefined();
    expect(queryByText(container, "button", "-- NORMAL --")).toBeUndefined();
  });
});

describe("the split", () => {
  it("exposes a resizable separator and persists a keyboard resize", async () => {
    const { container, storage } = await mount();
    const separator = requireElement<HTMLElement>(container, '[role="separator"]');

    expect(separator.getAttribute("aria-valuenow")).toBe("50");
    expect(separator.getAttribute("aria-valuemin")).toBe("20");
    expect(separator.getAttribute("aria-valuemax")).toBe("80");

    separator.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await settle();

    expect(separator.getAttribute("aria-valuenow")).toBe("52");
    expect(storage.entries.get("zdo-editor-split")).toBe("52");
  });

  it("keeps the editor host on an unbroken min-h-[0px] chain inside an inset-[0px] wrapper", async () => {
    const { container } = await mount();
    const host = requireElement<HTMLElement>(container, ".cm-editor").parentElement;

    // CodeMirror resolves its `height: 100%` against this chain; jsdom
    // computes no layout, so the assertion is structural rather than
    // pixel-based, and the rendered height is verified in the browser.
    const wrapper = host?.parentElement;
    expect(wrapper?.className).toContain("absolute inset-[0px]");
    expect(wrapper?.parentElement?.className).toContain("min-h-[0px]");

    let node: HTMLElement | null = wrapper?.parentElement ?? null;
    let minHeightZeroAncestors = 0;
    while (node && node !== container) {
      if (node.className.includes("min-h-[0px]")) minHeightZeroAncestors += 1;
      node = node.parentElement;
    }
    expect(minHeightZeroAncestors).toBeGreaterThanOrEqual(4);
  });
});

describe("conflict handling", () => {
  it("keeps the draft and offers retry/discard when a remote change lands mid-edit", async () => {
    const sources = createFakeEventSourceFactory();
    const events = new ProjectEventsClient({
      projectSlug: "aurora-docs",
      clientId: "this-tab",
      createEventSource: sources.factory,
    });
    events.connect();
    sources.instances[0]?.emitOpen();

    // A debounce long enough that autosave cannot fire during the spec: the
    // machine must still be `dirty` when the remote event arrives.
    const { container } = await mount(INSTALLATION_ID, {
      events,
      saveDebounceMs: 100_000,
    });

    typeIntoEditor(container, "my local draft");
    await settle();

    store.applyExternalPageWrite(INSTALLATION_ID, { markdown: "someone else's text" });
    sources.instances[0]?.emitMessage({
      type: "page-changed",
      pageId: INSTALLATION_ID,
      revision: store.getRevision(),
      origin: "another-tab",
    });
    await settle();

    const banner = requireElement(container, '[role="alert"]');
    expect(banner.textContent).toContain("changed elsewhere");
    expect(editorText(container)).toBe("my local draft");
    // The chrome puts the buffer in read-only while the conflict is open.
    expect(editorView(container).state.readOnly).toBe(true);

    queryByText<HTMLButtonElement>(banner, "button", "Discard my draft")?.click();
    await settle(4);

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(editorText(container)).toBe("someone else's text");

    events.close();
  });
});

/**
 * The vim chip is the surface the mode label and `aria-pressed` actually reach.
 * `editor-pane-slot.test.tsx` covers what the PANE reports; nothing covered
 * what the footer then renders, which is where a stale `-- NORMAL --` was
 * reported from the browser.
 */
describe("EditorWorkspace — vim chip", () => {
  function vimChip(container: HTMLElement): HTMLButtonElement {
    const chip = [...container.querySelectorAll("button")].find((button) =>
      (button.getAttribute("title") ?? "").includes("Vim mode"),
    );
    if (!chip) throw new Error("the vim chip is not rendered");
    return chip;
  }

  it("stops claiming a mode the moment vim is switched off", async () => {
    const storage = createFakeStorage({ [VIM_MODE_STORAGE_KEY]: "on" });
    const { container } = await mount(INSTALLATION_ID, { storage });

    expect(vimChip(container).getAttribute("aria-pressed")).toBe("true");
    expect(vimChip(container).textContent).toBe("-- NORMAL --");

    await act(async () => {
      vimChip(container).click();
    });
    await settle();

    // No further editor interaction — the chip must be correct immediately.
    expect(vimChip(container).getAttribute("aria-pressed")).toBe("false");
    expect(vimChip(container).textContent).toBe("vim off");
  });
});
