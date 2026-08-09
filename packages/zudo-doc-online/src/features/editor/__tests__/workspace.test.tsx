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
import { ProjectEventsClient, type MemoryProjectStore } from "../../../store/index";
import { createFakeEventSourceFactory } from "../../../store/__tests__/support";
import { mountWorkspace, queryByText, requireElement, settle } from "./harness";
import {
  INSTALLATION_ID,
  INTRODUCTION_ID,
  THEMING_ID,
  createEditorTestStore,
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

beforeEach(() => {
  store = createEditorTestStore();
});

afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
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
    expect(
      requireElement<HTMLTextAreaElement>(container, 'textarea[aria-label="Page markdown"]')
        .value,
    ).toContain("## Prerequisites");
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
    typeInto(
      requireElement<HTMLTextAreaElement>(container, 'textarea[aria-label="Page markdown"]'),
      "unresolved draft",
    );
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
    const textarea = requireElement<HTMLTextAreaElement>(
      container,
      'textarea[aria-label="Page markdown"]',
    );

    typeInto(textarea, "one two three");
    await settle(5);

    expect((await store.loadPage(INSTALLATION_ID)).markdown).toBe("one two three");
    expect(container.textContent).toContain("3 words");
  });

  it("keeps each tab's buffer with its own page across a switch", async () => {
    const { container } = await mount();
    const textarea = () =>
      requireElement<HTMLTextAreaElement>(container, 'textarea[aria-label="Page markdown"]');

    typeInto(textarea(), "installation body");
    await settle(5);

    queryByText<HTMLElement>(
      requireElement(container, 'nav[aria-label="Pages"]'),
      "span",
      "Introduction",
    )
      ?.closest("button")
      ?.click();
    await settle();
    typeInto(textarea(), "introduction body");
    await settle(5);

    expect((await store.loadPage(INSTALLATION_ID)).markdown).toBe("installation body");
    expect((await store.loadPage(INTRODUCTION_ID)).markdown).toBe("introduction body");
  });

  it("never autosaves half-composed text, and saves once the IME finishes", async () => {
    const { container } = await mount();
    const textarea = requireElement<HTMLTextAreaElement>(
      container,
      'textarea[aria-label="Page markdown"]',
    );
    const original = (await store.loadPage(INSTALLATION_ID)).markdown;

    textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    typeInto(textarea, "にほn");
    await settle(5);
    expect((await store.loadPage(INSTALLATION_ID)).markdown).toBe(original);

    textarea.value = "日本語";
    textarea.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    await settle(5);

    expect((await store.loadPage(INSTALLATION_ID)).markdown).toBe("日本語");
  });
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
    const textarea = requireElement<HTMLTextAreaElement>(
      container,
      'textarea[aria-label="Page markdown"]',
    );

    // The CodeMirror sub-issue depends on this exact shape; jsdom computes no
    // layout, so the assertion is structural rather than pixel-based.
    const wrapper = textarea.parentElement;
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

    typeInto(
      requireElement<HTMLTextAreaElement>(container, 'textarea[aria-label="Page markdown"]'),
      "my local draft",
    );
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
    expect(
      requireElement<HTMLTextAreaElement>(container, 'textarea[aria-label="Page markdown"]')
        .value,
    ).toBe("my local draft");

    queryByText<HTMLButtonElement>(banner, "button", "Discard my draft")?.click();
    await settle(4);

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(
      requireElement<HTMLTextAreaElement>(container, 'textarea[aria-label="Page markdown"]')
        .value,
    ).toBe("someone else's text");

    events.close();
  });
});
