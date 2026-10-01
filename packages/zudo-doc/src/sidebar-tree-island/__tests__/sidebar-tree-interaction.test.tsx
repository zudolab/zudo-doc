/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, flushAll } from "../../__tests__/helpers/zudo-react.js";
import { SidebarTree, type SidebarTreeProps } from "../index.js";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/index.js";
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
