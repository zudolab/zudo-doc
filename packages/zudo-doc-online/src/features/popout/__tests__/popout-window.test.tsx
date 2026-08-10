// @vitest-environment jsdom
/**
 * `<PopoutWindow>` mounted for real, driven against the in-memory store and
 * a fake `EventSourceLike` — mirrors the injection style
 * `editor/__tests__/workspace.test.tsx` uses for the same reason: no real
 * network, no real wasm render (PreviewPane's own default render loop is
 * covered by preview-pane.test.tsx; here it is only ever asserted to be
 * MOUNTED, via its `aria-label`, never driven to a rendered-HTML state).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import PopoutWindow from "../popout-window";
import {
  ProjectEventsClient,
  StoreRequestError,
  type PagePayload,
  type ProjectStore,
} from "../../../store/index";
import { createFakeEventSourceFactory, createTestStore } from "../../../store/__tests__/support";

const mountedContainers: HTMLElement[] = [];

async function mount(props: {
  pageId: string;
  store: ProjectStore;
  events?: ProjectEventsClient | null;
}): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    render(<PopoutWindow {...props} />, container);
    await Promise.resolve();
    await Promise.resolve();
  });
  mountedContainers.push(container);
  return container;
}

afterEach(() => {
  for (const container of mountedContainers.splice(0)) {
    render(null, container);
    container.remove();
  }
});

describe("PopoutWindow — malformed URL", () => {
  it("shows a visible invalid-link error (never a silent self-close) for an empty pageId, without ever calling the store", async () => {
    const loadPage = vi.fn();
    const store: ProjectStore = {
      loadSnapshot: vi.fn(),
      applyOutlineCommand: vi.fn(),
      loadPage,
      savePage: vi.fn(),
    };
    const container = await mount({ pageId: "   ", store, events: null });

    expect(container.textContent).toContain("This pop-out link is invalid");
    expect(container.textContent).toContain("You can close this window.");
    expect(loadPage).not.toHaveBeenCalled();
  });
});

describe("PopoutWindow — loading and error states", () => {
  it("shows a loading status while the page fetch is in flight", async () => {
    const store: ProjectStore = {
      loadSnapshot: vi.fn(),
      applyOutlineCommand: vi.fn(),
      loadPage: vi.fn(() => new Promise<PagePayload>(() => {})),
      savePage: vi.fn(),
    };
    const container = await mount({ pageId: "page-1", store, events: null });

    expect(container.textContent).toContain("Opening preview…");
  });

  it("shows a visible error page (never a silent self-close) when the page load fails", async () => {
    const store: ProjectStore = {
      loadSnapshot: vi.fn(),
      applyOutlineCommand: vi.fn(),
      loadPage: vi.fn().mockRejectedValue(new StoreRequestError("page-not-found", "No such page.", 404)),
      savePage: vi.fn(),
    };
    const container = await mount({ pageId: "missing-page", store, events: null });

    expect(container.textContent).toContain("This preview window could not be opened");
    expect(container.textContent).toContain("No such page.");
    expect(container.textContent).toContain("You can close this window.");
  });

  it("falls back to a generic message for a non-store error", async () => {
    const store: ProjectStore = {
      loadSnapshot: vi.fn(),
      applyOutlineCommand: vi.fn(),
      loadPage: vi.fn().mockRejectedValue(new Error("boom")),
      savePage: vi.fn(),
    };
    const container = await mount({ pageId: "page-1", store, events: null });

    expect(container.textContent).toContain("The editing server could not be reached.");
  });
});

describe("PopoutWindow — ready state", () => {
  it("renders the page title in the slim bar and mounts PreviewPane under .zdo-editor", async () => {
    const store = createTestStore();
    const container = await mount({ pageId: "page-1", store, events: null });

    expect(container.querySelector(".zdo-editor")).not.toBeNull();
    expect(container.textContent).toContain("Intro");
    expect(container.querySelector('[aria-label="Preview: Intro"]')).not.toBeNull();
  });
});

describe("PopoutWindow — SSE live update", () => {
  it("re-fetches and re-renders on a page-changed event for its own pageId", async () => {
    const store = createTestStore();
    const handle = createFakeEventSourceFactory();
    const events = new ProjectEventsClient({
      projectSlug: "docs",
      clientId: "popout-tab",
      createEventSource: handle.factory,
    });

    const container = await mount({ pageId: "page-1", store, events });
    expect(container.textContent).toContain("Intro");

    await store.applyExternalPageWrite("page-1", { frontmatter: { title: "Intro (edited)" } });

    await act(async () => {
      handle.instances[0]?.emitMessage({ type: "page-changed", pageId: "page-1", revision: 2 });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Intro (edited)");
  });

  it("ignores a page-changed event for a different pageId", async () => {
    const store = createTestStore();
    const handle = createFakeEventSourceFactory();
    const events = new ProjectEventsClient({
      projectSlug: "docs",
      clientId: "popout-tab",
      createEventSource: handle.factory,
    });

    const container = await mount({ pageId: "page-1", store, events });
    await store.applyExternalPageWrite("page-1", { frontmatter: { title: "Should not appear" } });

    await act(async () => {
      handle.instances[0]?.emitMessage({ type: "page-changed", pageId: "page-2", revision: 2 });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("Should not appear");
    expect(container.textContent).toContain("Intro");
  });

  it("refetches once the SSE connection opens, catching an edit that committed before the stream was live", async () => {
    const store = createTestStore();
    const handle = createFakeEventSourceFactory();
    const events = new ProjectEventsClient({
      projectSlug: "docs",
      clientId: "popout-tab",
      createEventSource: handle.factory,
    });

    const container = await mount({ pageId: "page-1", store, events });
    expect(container.textContent).toContain("Intro");

    // Simulates an edit committed after the initial loadPage() but before the
    // SSE connection actually opened: no page-changed event for it is ever
    // received (the socket was not listening yet), so only the
    // onOpen-triggered refetch can catch it.
    await store.applyExternalPageWrite("page-1", { frontmatter: { title: "Intro (missed edit)" } });

    await act(async () => {
      handle.instances[0]?.emitOpen();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Intro (missed edit)");
  });

  it("serializes refetches — a page-changed event arriving mid-refetch is queued, never run concurrently", async () => {
    let resolveInFlight: ((value: PagePayload) => void) | undefined;
    const inFlight = new Promise<PagePayload>((resolve) => {
      resolveInFlight = resolve;
    });
    const loadPage = vi
      .fn<() => Promise<PagePayload>>()
      .mockResolvedValueOnce(makePage("v1"))
      .mockImplementationOnce(() => inFlight)
      .mockResolvedValueOnce(makePage("v3"));
    const store: ProjectStore = {
      loadSnapshot: vi.fn(),
      applyOutlineCommand: vi.fn(),
      loadPage,
      savePage: vi.fn(),
    };
    const handle = createFakeEventSourceFactory();
    const events = new ProjectEventsClient({
      projectSlug: "docs",
      clientId: "popout-tab",
      createEventSource: handle.factory,
    });

    const container = await mount({ pageId: "page-1", store, events });
    expect(container.textContent).toContain("v1");

    // First page-changed starts the (held-open) 2nd loadPage() call.
    await act(async () => {
      handle.instances[0]?.emitMessage({ type: "page-changed", pageId: "page-1", revision: 2 });
      await Promise.resolve();
    });
    expect(loadPage).toHaveBeenCalledTimes(2);

    // A second page-changed while the first refetch is still in flight must
    // be QUEUED, not start a concurrent (and possibly out-of-order) 3rd call.
    await act(async () => {
      handle.instances[0]?.emitMessage({ type: "page-changed", pageId: "page-1", revision: 3 });
      await Promise.resolve();
    });
    expect(loadPage).toHaveBeenCalledTimes(2);

    // Resolving the in-flight call triggers exactly the one queued refetch.
    await act(async () => {
      resolveInFlight?.(makePage("v2"));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadPage).toHaveBeenCalledTimes(3);
    expect(container.textContent).toContain("v3");
  });
});

function makePage(title: string): PagePayload {
  return {
    id: "page-1",
    slug: "intro",
    categoryId: "cat-1",
    revision: 1,
    frontmatter: { title },
    markdown: "Hello\n",
    warnings: [],
  };
}
