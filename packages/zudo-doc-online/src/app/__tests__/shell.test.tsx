// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import type { KeyValueStorage } from "../../features/editor/persistence.js";
import { OPEN_TABS_STORAGE_KEY } from "../../features/editor/persistence.js";
import type { ProjectSnapshot, ProjectStore } from "../../store/contract.js";
import { ProjectEventsClient } from "../../store/events.js";
import { createFakeEventSourceFactory } from "../../store/__tests__/support.js";
import { Shell } from "../shell.js";

const SNAPSHOT: ProjectSnapshot = {
  slug: "aurora-docs",
  title: "Aurora Docs",
  revision: 3,
  outline: {
    schemaVersion: 1,
    projectTitle: "Aurora Docs",
    categories: [
      {
        id: "cat-getting-started",
        slug: "getting-started",
        title: "Getting started",
        pages: [
          { id: "page-getting-started-installation", slug: "installation" },
          { id: "page-getting-started-first-page", slug: "first-page" },
        ],
      },
    ],
  },
  pages: [
    {
      id: "page-getting-started-installation",
      slug: "installation",
      categoryId: "cat-getting-started",
      title: "Installation",
    },
    {
      id: "page-getting-started-first-page",
      slug: "first-page",
      categoryId: "cat-getting-started",
      title: "Your first page",
    },
  ],
};

function storeFor(snapshot: ProjectSnapshot): ProjectStore {
  return {
    loadSnapshot: async () => snapshot,
    applyOutlineCommand: vi.fn(),
    loadPage: vi.fn(),
    savePage: vi.fn(),
  };
}

function storageWithTabs(ids: string[]): KeyValueStorage {
  const entries = new Map([[OPEN_TABS_STORAGE_KEY, JSON.stringify(ids)]]);
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

/** Mounts the shell and lets its snapshot read (and the re-render) settle. */
async function mountShell(props: Parameters<typeof Shell>[0]): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    render(<Shell {...props} />, container);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return container;
}

function editorLink(container: HTMLElement): HTMLAnchorElement | null {
  return container.querySelector<HTMLAnchorElement>('a[href^="#/editor/"]');
}

describe("Shell", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the wordmark, project name, nav links, and TZ avatar", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    render(
      <Shell route={{ name: "outline" }}>
        <div>content</div>
      </Shell>,
      container,
    );

    expect(container.textContent).toContain("zudo-doc online");
    expect(container.textContent).toContain("Aurora Docs");
    expect(container.textContent).toContain("Outline");
    expect(container.textContent).toContain("Editor");
    expect(container.textContent).toContain("TZ");
    expect(container.textContent).toContain("content");

    render(null, container);
    container.remove();
  });

  it("marks the nav link matching the current route with aria-current", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    render(
      <Shell route={{ name: "editor", pageId: "installation" }}>
        <div />
      </Shell>,
      container,
    );

    const outlineLink = container.querySelector('a[href="#/outline"]');
    const editorLink = container.querySelector('a[href^="#/editor/"]');

    expect(outlineLink?.getAttribute("aria-current")).toBeNull();
    expect(editorLink?.getAttribute("aria-current")).toBe("page");

    render(null, container);
    container.remove();
  });
});

/**
 * jsdom computes no layout, so this can only assert the class SHAPE of the
 * height chain, not the pixels — the manager's browser pass is what re-verifies
 * the rendered result. It is still worth pinning: the measured bug was the
 * shell root carrying `min-h-dvh` (a MIN height is not a definite one) and
 * `main` carrying bare `flex-1`, which together left the routed surface's
 * `h-full` with no percentage base and collapsed it to content height —
 * 355-735px of dead space, and an 85px-tall editor with the rail collapsed.
 */
describe("Shell — viewport height chain", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("gives the root a definite viewport height and main a resolvable one", async () => {
    const container = await mountShell({
      route: { name: "outline" },
      store: null,
    });

    const root = container.firstElementChild;
    expect(root?.className).toContain("h-dvh");
    // A MIN height would break the chain again — this is the regression.
    expect(root?.className).not.toContain("min-h-dvh");
    expect(root?.className).toContain("flex-col");

    const main = container.querySelector("main");
    expect(main?.className).toContain("flex-1");
    // Height-establishing container + shrinkable, so `h-full` children resolve
    // and scroll internally instead of pushing the column past the viewport.
    expect(main?.className).toContain("min-h-0");
    expect(main?.className).toContain("flex-col");
  });
});

/**
 * The nav link's target must be a PAGE ID. It used to be the hardcoded URL
 * path "getting-started/installation", which no page id ever matches, so the
 * Editor tab always landed on page-not-found.
 */
describe("Shell — Editor nav target", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("points at the project's first page when nothing was opened before", async () => {
    const container = await mountShell({
      route: { name: "outline" },
      store: storeFor(SNAPSHOT),
      storage: storageWithTabs([]),
    });

    expect(editorLink(container)?.getAttribute("href")).toBe(
      "#/editor/page-getting-started-installation",
    );
  });

  it("prefers the most recently opened tab that still exists", async () => {
    const container = await mountShell({
      route: { name: "outline" },
      store: storeFor(SNAPSHOT),
      // The last entry is the newest tab; the id before it is long gone.
      storage: storageWithTabs([
        "page-getting-started-installation",
        "page-deleted-elsewhere",
        "page-getting-started-first-page",
      ]),
    });

    expect(editorLink(container)?.getAttribute("href")).toBe(
      "#/editor/page-getting-started-first-page",
    );
  });

  it("stays on the page being edited while the editor route is open", async () => {
    const container = await mountShell({
      route: { name: "editor", pageId: "page-getting-started-first-page" },
      store: storeFor(SNAPSHOT),
      storage: storageWithTabs([]),
    });

    expect(editorLink(container)?.getAttribute("href")).toBe(
      "#/editor/page-getting-started-first-page",
    );
  });

  it("renders an inert item, not a broken link, when the project has no pages", async () => {
    const container = await mountShell({
      route: { name: "outline" },
      store: storeFor({ ...SNAPSHOT, pages: [] }),
      storage: storageWithTabs([]),
    });

    expect(editorLink(container)).toBeNull();
    expect(container.querySelector('[aria-disabled="true"]')?.textContent).toBe(
      "Editor",
    );
  });

  it("re-reads the target when the outline changes under it", async () => {
    // The shell outlives every surface, so a one-shot read goes stale as soon
    // as the outline moves: the target page can be deleted (a link that 404s
    // again) or the first page added (an item stuck disabled), neither of
    // which involves a route change.
    let current: ProjectSnapshot = { ...SNAPSHOT, revision: 3, pages: [] };
    const store: ProjectStore = {
      ...storeFor(SNAPSHOT),
      loadSnapshot: async () => current,
    };
    const sources = createFakeEventSourceFactory();
    const events = new ProjectEventsClient({
      projectSlug: "aurora-docs",
      clientId: "this-tab",
      createEventSource: sources.factory,
    });
    events.connect();

    const container = await mountShell({
      route: { name: "outline" },
      store,
      events,
      storage: storageWithTabs([]),
    });
    expect(editorLink(container)).toBeNull();

    current = { ...SNAPSHOT, revision: 4 };
    await act(async () => {
      sources.instances[0]?.emitMessage({
        type: "outline-changed",
        revision: 4,
        origin: "this-tab",
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(editorLink(container)?.getAttribute("href")).toBe(
      "#/editor/page-getting-started-installation",
    );

    events.close();
  });

  it("keeps the item inert when the server cannot be reached", async () => {
    const failing: ProjectStore = {
      ...storeFor(SNAPSHOT),
      loadSnapshot: async () => {
        throw new Error("offline");
      },
    };
    const container = await mountShell({
      route: { name: "outline" },
      store: failing,
      storage: storageWithTabs([]),
    });

    expect(editorLink(container)).toBeNull();
  });
});
