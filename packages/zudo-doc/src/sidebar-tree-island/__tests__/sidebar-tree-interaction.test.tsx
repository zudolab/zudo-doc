/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, flushAll } from "../../__tests__/helpers/zudo-react.js";
import { SidebarTree, type SidebarTreeProps } from "../index.js";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/index.js";
import { buildSidebarNavigation } from "../../sidebar-utils/index.js";
import type { SidebarNavNode } from "../../sidebar/types.js";
import { CURRENT_PATH_DATASET_KEY } from "../../current-path/index.js";
import { disposeSidebarScrollPreserve } from "../sidebar-scroll-preserve.js";

const NODES: SidebarNavNode[] = [
  {
    slug: "guides",
    label: "Guides",
    position: 0,
    hasPage: false,
    collapsed: true,
    children: [
      {
        slug: "guides/first",
        label: "First",
        position: 0,
        href: "/docs/guides/first",
        hasPage: true,
        children: [],
      },
      {
        slug: "guides/second",
        label: "Second",
        position: 1,
        href: "/docs/guides/second",
        hasPage: true,
        children: [],
      },
    ],
  },
  {
    slug: "about",
    label: "About",
    position: 1,
    href: "/docs/about",
    hasPage: true,
    children: [],
  },
];
let view:
  | Awaited<ReturnType<typeof renderIsland<SidebarTreeProps>>>
  | undefined;
async function mount(props: SidebarTreeProps) {
  view = await renderIsland(SidebarTree, props, {
    identity: { component: "SidebarTree", build: "test" },
  });
  expect(view.diagnostics).toEqual([]);
  return view.root;
}
afterEach(() => {
  view?.dispose();
  view = undefined;
  disposeSidebarScrollPreserve(document);
  sessionStorage.clear();
  delete document.documentElement.dataset[CURRENT_PATH_DATASET_KEY];
});

function click(el: Element | null) {
  expect(el).not.toBeNull();
  el!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("SidebarTree hydration and interaction", () => {
  it("hydrates closed SSR tree, restores stored expansion, and persists collapse", async () => {
    sessionStorage.setItem("zd-sidebar-open", JSON.stringify(["guides"]));
    const root = await mount({ nodes: NODES, currentSlug: "about" });
    const button = root.querySelector('button[aria-label="Collapse Guides"]');
    expect(button).not.toBeNull();
    expect(root.querySelector('a[href="/docs/guides/first"]')).not.toBeNull();
    click(button);
    await flushAll();
    expect(
      root.querySelector('button[aria-label="Expand Guides"]'),
    ).not.toBeNull();
    expect(root.querySelector('a[href="/docs/guides/first"]')).toBeNull();
    expect(
      JSON.parse(sessionStorage.getItem("zd-sidebar-open")!),
    ).not.toContain("guides");
  });

  it("allows the active category to close and persists that choice", async () => {
    const root = await mount({ nodes: NODES, currentSlug: "guides/first" });
    click(root.querySelector('button[aria-label="Collapse Guides"]'));
    await flushAll();
    expect(
      root.querySelector('button[aria-label="Expand Guides"]'),
    ).not.toBeNull();
    expect(root.querySelector('a[href="/docs/guides/first"]')).toBeNull();
    expect(
      JSON.parse(sessionStorage.getItem("zd-sidebar-open")!),
    ).not.toContain("guides");
  });

  it("filters with the input model and keeps keyed rows responsive to navigation", async () => {
    const root = await mount({ nodes: NODES, currentSlug: "guides/first" });
    const input = root.querySelector<HTMLInputElement>(
      'input[aria-label="Filter navigation"]',
    )!;
    input.value = "second";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAll();
    expect(root.querySelector('a[href="/docs/guides/second"]')).not.toBeNull();
    expect(root.querySelector('a[href="/docs/guides/first"]')).toBeNull();
    document.documentElement.dataset[CURRENT_PATH_DATASET_KEY] =
      "/docs/guides/second";
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    await flushAll();
    expect(
      root.querySelector('a[aria-current="page"]')?.getAttribute("href"),
    ).toBe("/docs/guides/second");
  });

  it("hydrates a dated tray, restores its stored group, and permits closing the active group", async () => {
    const tray: SidebarNavNode = {
      slug: "notes",
      label: "Notes",
      position: 0,
      href: "/docs/notes",
      hasPage: true,
      shape: "note-tray",
      noteTrayDated: true,
      noteTraySidebar: "year",
      sortOrder: "desc",
      children: [
        {
          slug: "notes/one",
          label: "One",
          position: 0,
          rank: 1,
          date: "2026-01-02",
          href: "/docs/notes/one",
          hasPage: true,
          children: [],
        },
      ],
    };
    sessionStorage.setItem("zd-sidebar-open", JSON.stringify(["notes#2026"]));
    const root = await mount({ nodes: [tray], currentSlug: "notes" });
    expect(root.querySelector('a[href="/docs/notes/one"]')).not.toBeNull();
    document.documentElement.dataset[CURRENT_PATH_DATASET_KEY] =
      "/docs/notes/one";
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    await flushAll();
    expect(
      root.querySelector('a[aria-current="page"]')?.getAttribute("href"),
    ).toBe("/docs/notes/one");
    click(root.querySelector('button[data-zd-sidebar-open-key="notes#2026"]'));
    await flushAll();
    expect(
      root.querySelector('button[aria-label="Expand 2026"]'),
    ).not.toBeNull();
    expect(root.querySelector('a[href="/docs/notes/one"]')).toBeNull();
    expect(
      JSON.parse(sessionStorage.getItem("zd-sidebar-open")!),
    ).not.toContain("notes#2026");
  });

  it("shows the root menu, expands children, and returns to the tree", async () => {
    const root = await mount({
      nodes: NODES,
      currentSlug: "about",
      localeLinks: [
        { code: "en", label: "English", href: "/docs/about", active: true },
        { code: "ja", label: "日本語", href: "/ja/docs/about", active: false },
      ],
      rootMenuItems: [
        {
          label: "Home",
          href: "/",
          children: [{ label: "More", href: "/more" }],
        },
      ],
    });
    click(
      root.querySelector('button[aria-label="Filter navigation"]') ??
        root.querySelector("nav > button"),
    );
    await flushAll();
    expect(root.querySelector('a[href="/"]')).not.toBeNull();
    expect(root.querySelector('span[aria-current="true"]')?.textContent).toBe(
      "English",
    );
    expect(root.querySelector('a[lang="ja"]')?.getAttribute("href")).toBe(
      "/ja/docs/about",
    );
    click(root.querySelector('button[aria-label="Expand Home"]'));
    await flushAll();
    expect(root.querySelector('a[href="/more"]')).not.toBeNull();
    click(root.querySelector("nav > button"));
    await flushAll();
    expect(
      root.querySelector('input[aria-label="Filter navigation"]'),
    ).not.toBeNull();
  });
});


describe("Broader tree controls", () => {
  const build = () => buildSidebarNavigation([], "en", "guides", undefined, {
    guides: { items: [{ type: "category", label: "Editorial", items: [{ type: "category", label: "Local", items: [{ type: "autogenerated" }] }] }], initialPath: [0, 0] },
  }, () => NODES, []);

  it("hydrates the configured forest, keeps the filter, broadens exactly once and restores", async () => {
    const data = build();
    const root = await mount({ ...data, currentSlug: "guides/first" });
    expect(root.textContent).not.toContain("Show only this branch: Editorial");
    expect(root.querySelector('[data-sidebar-restore]')).toBeNull();
    const input = root.querySelector<HTMLInputElement>('input')!;
    input.value = "no matching page";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAll();
    click(root.querySelector('[data-sidebar-broaden]'));
    await flushAll();
    expect(input.value).toBe("no matching page");
    expect(root.querySelector('[data-sidebar-scope-toolbar]')?.textContent).toContain("Editorial");
    expect(root.querySelector('[data-sidebar-restore]')).not.toBeNull();
    click(root.querySelector('[data-sidebar-restore]'));
    await flushAll();
    expect(input.value).toBe("no matching page");
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAll();
    expect(root.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/docs/guides/first");
    expect(root.querySelector('[data-sidebar-restore]')).toBeNull();
  });

  it("keeps branch focus separate, preserves a collapsed unrelated branch, and restores after remount", async () => {
    const data = build();
    const root = await mount({ ...data, currentSlug: "about" });
    click(root.querySelector('button[aria-label="Expand Guides"]'));
    await flushAll();
    click(root.querySelector('button[aria-label="Collapse Guides"]'));
    await flushAll();
    click(root.querySelector('[data-sidebar-broaden]'));
    await flushAll();
    expect(root.querySelector('button[aria-label="Expand Guides"]')).not.toBeNull();
    click(root.querySelector('button[aria-label="Show only this branch: Guides"]'));
    await flushAll();
    expect(root.querySelector('a[href="/docs/about"]')).toBeNull();
    expect(root.querySelector('a[href="/docs/guides/first"]')).not.toBeNull();
    view!.dispose();
    view = undefined;
    const restored = await mount({ ...data, currentSlug: "guides/first" });
    expect(restored.querySelector('a[href="/docs/about"]')).toBeNull();
    expect(restored.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/docs/guides/first");
    click(restored.querySelector('[data-sidebar-restore]'));
    await flushAll();
    expect(restored.querySelector('a[href="/docs/about"]')).not.toBeNull();
  });

  it("widens for native cross-branch navigation and ignores invalid stored scope", async () => {
    const data = build();
    sessionStorage.setItem("zd-sidebar-scope", JSON.stringify({ context: data.navigation.id, selected: "deleted", query: "" }));
    const root = await mount({ ...data, currentSlug: "guides/first" });
    expect(root.querySelector('[data-sidebar-restore]')).toBeNull();
    click(root.querySelector('button[aria-label="Show only this branch: Guides"]'));
    await flushAll();
    document.documentElement.dataset[CURRENT_PATH_DATASET_KEY] = "/docs/about";
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    await flushAll();
    expect(root.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/docs/about");
    expect(root.textContent).toContain("Local");
  });
});


it("resets scope and query across locale/version context and renders Japanese controls", async () => {
  const data = buildSidebarNavigation([], "ja", undefined, undefined, {}, () => NODES, []);
  sessionStorage.setItem("zd-sidebar-scope", JSON.stringify({ context: `old-version:${data.navigation.id}`, selected: "auto/0", query: "stale query" }));
  const root = await mount({ ...data, currentSlug: "guides/first", locale: "ja" });
  expect(root.querySelector('input')?.value).toBe("");
  expect(root.querySelector('[data-sidebar-broaden]')?.textContent).toContain("ツリーを広げる");
  expect(root.querySelector('[data-sidebar-restore]')).toBeNull();
  expect(root.querySelector('button[aria-label="この枝だけを表示: Guides"]')).not.toBeNull();
});

it("preserves an off-article branch across same-page refresh and a second desktop/mobile mount", async () => {
  const data = buildSidebarNavigation([], "en", undefined, undefined, {}, () => NODES, []);
  const root = await mount({ ...data, currentSlug: "about" });
  click(root.querySelector('button[aria-label="Show only this branch: Guides"]'));
  await flushAll();
  expect(root.querySelector('a[href="/docs/about"]')).toBeNull();
  const second = await renderIsland(SidebarTree, { ...data, currentSlug: "about" }, {
    identity: { component: "SidebarTree", build: "second-view" },
  });
  try {
    expect(second.diagnostics).toEqual([]);
    expect(second.root.querySelector('a[href="/docs/about"]')).toBeNull();
    expect(root.querySelector('a[href="/docs/about"]')).toBeNull();
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    await flushAll();
    expect(second.root.querySelector('a[href="/docs/about"]')).toBeNull();
    click(second.root.querySelector('[data-sidebar-restore]'));
    await flushAll();
    for (const treeRoot of [root, second.root]) {
      expect(treeRoot.querySelector('a[href="/docs/about"]')).not.toBeNull();
      expect(treeRoot.querySelector('button[aria-label="Expand Guides"]')).not.toBeNull();
      expect(treeRoot.querySelector('a[href="/docs/guides/first"]')).toBeNull();
    }
  } finally { second.dispose(); }
});


it("widens a focused branch and reveals the empty-slug root page on native navigation", async () => {
  const rootGroup: SidebarNavNode = {
    slug: "root-group", label: "Root group", position: 0, hasPage: false, collapsed: true,
    children: [{ slug: "", label: "Root index", position: 0, hasPage: true, href: "/docs/", children: [] }],
  };
  const data = buildSidebarNavigation([], "en", undefined, undefined, {}, () => [rootGroup, ...NODES], []);
  const root = await mount({ ...data, currentSlug: "guides/first" });
  click(root.querySelector('button[aria-label="Show only this branch: Guides"]'));
  await flushAll();
  expect(root.querySelector('a[href="/docs/"]')).toBeNull();
  document.documentElement.dataset[CURRENT_PATH_DATASET_KEY] = "/docs/";
  document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
  await flushAll();
  expect(root.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/docs/");
  expect(root.querySelector('button[aria-label="Collapse Root group"]')).not.toBeNull();
});

it("opens the root-index active path even when its canonical slug is empty", async () => {
  const root = await mount({
    nodes: [{ slug: "root-group", label: "Root group", position: 0, hasPage: false, collapsed: true,
      children: [{ slug: "", label: "Root index", position: 0, hasPage: true, href: "/docs/", children: [] }],
    }], currentSlug: "",
  });
  expect(root.querySelector('button[aria-label="Collapse Root group"]')).not.toBeNull();
  expect(root.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/docs/");
});

it("preserves dated tray groups across ordinary scope changes but Restore resets inactive groups", async () => {
  const tray: SidebarNavNode = {
    slug: "notes", label: "Notes", position: 0, href: "/docs/notes", hasPage: true,
    shape: "note-tray", noteTrayDated: true, noteTraySidebar: "year",
    children: [
      { slug: "notes/current", label: "Current note", position: 0, rank: 1, date: "2026-01-02", href: "/docs/notes/current", hasPage: true, children: [] },
      { slug: "notes/older", label: "Older note", position: 1, rank: 2, date: "2025-01-02", href: "/docs/notes/older", hasPage: true, children: [] },
    ],
  };
  const data = buildSidebarNavigation([], "en", "notes", undefined, {}, () => [tray, NODES[1]!], ["notes"]);
  const root = await mount({ ...data, currentSlug: "notes/current" });
  click(root.querySelector('button[aria-label="Expand 2025"]'));
  await flushAll();
  expect(root.querySelector('a[href="/docs/notes/older"]')).not.toBeNull();
  click(root.querySelector('[data-sidebar-broaden]'));
  await flushAll();
  click(root.querySelector('button[aria-label="Show only this branch: Notes"]'));
  await flushAll();
  expect(root.querySelector('button[aria-label="Collapse 2025"]')).not.toBeNull();
  view!.dispose();
  view = undefined;
  const remounted = await mount({ ...data, currentSlug: "notes/current" });
  expect(remounted.querySelector('button[aria-label="Collapse 2025"]')).not.toBeNull();
  click(remounted.querySelector('[data-sidebar-broaden]'));
  await flushAll();
  click(remounted.querySelector('[data-sidebar-restore]'));
  await flushAll();
  expect(remounted.querySelector('button[aria-label="Expand 2025"]')).not.toBeNull();
  expect(remounted.querySelector('a[href="/docs/notes/older"]')).toBeNull();
  expect(remounted.querySelector('button[aria-label="Collapse 2026"]')).not.toBeNull();
  expect(remounted.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/docs/notes/current");
  document.documentElement.dataset[CURRENT_PATH_DATASET_KEY] = "/docs/notes/older";
  document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
  await flushAll();
  expect(remounted.querySelector('button[aria-label="Collapse 2025"]')).not.toBeNull();
  expect(remounted.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/docs/notes/older");
});
