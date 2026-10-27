/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderIsland, flushAll } from "../../__tests__/helpers/zudo-react.js";
import { SidebarTree, type SidebarTreeProps } from "../index.js";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/index.js";
import { buildSidebarNavigation } from "../../sidebar-utils/index.js";
import { toSidebarClientData } from "../../sidebar/client-data.js";
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
  view = await renderIsland(SidebarTree, { ...props, ...toSidebarClientData(props.nodes, props.navigation) }, {
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

  it("keeps Restore icon-only with a localized accessible name and comfortable targets", async () => {
    const root = await mount({ ...build(), currentSlug: "guides/first" });
    click(root.querySelector('[data-sidebar-broaden]'));
    await flushAll();
    const toolbar = root.querySelector('[data-sidebar-scope-toolbar]')!;
    const actions = toolbar.querySelector('[data-sidebar-scope-actions]')!;
    const restore = actions.querySelector<HTMLButtonElement>('[data-sidebar-restore]')!;
    expect(restore.textContent).toBe("");
    expect(restore.getAttribute("aria-label")).toBe("Restore current page’s sidebar");
    expect(restore.getAttribute("data-sidebar-tip")).toBe("Restore this page’s sidebar");
    // A native title would stack a second tooltip on top of the transient one.
    expect(restore.hasAttribute("title")).toBe(false);
    expect(restore.querySelector('svg[aria-hidden="true"] path')?.getAttribute("d")).toBe("M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6");
    expect(toolbar.querySelector('[data-sidebar-scope-hint]')).toBeNull();
    expect(restore.style.width).toBe("40px");
    expect(root.querySelector("[data-sidebar-filter-region]")).not.toBeNull();
    click(restore);
    await flushAll();
    expect(document.activeElement?.getAttribute("aria-current")).toBe("page");
    const ja = buildSidebarNavigation([], "ja", undefined, undefined, {}, () => NODES, []);
    view!.dispose();
    const localized = await mount({ ...ja, currentSlug: "guides/first", locale: "ja" });
    click(localized.querySelector('button[aria-label="サイドバーに「Guides」だけを表示"]'));
    await flushAll();
    expect(localized.querySelector('[data-sidebar-restore]')?.getAttribute("aria-label")).toBe("現在のページのサイドバーに戻す");
  });

  it("hydrates the configured forest, keeps the filter, broadens exactly once and restores", async () => {
    const data = build();
    const root = await mount({ ...data, currentSlug: "guides/first" });
    expect(root.textContent).not.toContain("Focus sidebar on Editorial");
    expect(root.querySelector('[data-sidebar-restore]')).toBeNull();
    const input = root.querySelector<HTMLInputElement>('input')!;
    input.value = "no matching page";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAll();
    click(root.querySelector('[data-sidebar-broaden]'));
    await flushAll();
    expect(input.value).toBe("no matching page");
    expect(root.querySelector('[data-sidebar-scope-toolbar]')?.textContent).toContain("Broaden tree");
    expect(root.querySelector('[data-sidebar-restore]')).not.toBeNull();
    click(root.querySelector('[data-sidebar-restore]'));
    await flushAll();
    expect(input.value).toBe("no matching page");
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAll();
    expect(root.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/docs/guides/first");
    expect(root.querySelector('[data-sidebar-restore]')).toBeNull();
    expect(document.activeElement?.hasAttribute("data-sidebar-broaden")).toBe(true);
    for (let step = 0; step < 4 && root.querySelector('[data-sidebar-broaden]'); step++) {
      click(root.querySelector('[data-sidebar-broaden]'));
      await flushAll();
    }
    expect(root.querySelector('[data-sidebar-scope-toolbar]')).toBeNull();
    expect(document.activeElement?.getAttribute("data-sidebar-focus")).not.toBeNull();
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
    click(root.querySelector('button[aria-label="Focus sidebar on Guides"]'));
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

  it("configured section ignores a stored full-forest scope", async () => {
    const editorial = buildSidebarNavigation([], "en", "guides", undefined, {}, () => NODES, ["guides"]);
    const configured = buildSidebarNavigation([], "en", "guides", undefined, {
      guides: { items: [], scopeRoot: "configured" },
    }, () => NODES, ["guides"]);
    expect(configured.navigation.id).not.toBe(editorial.navigation.id);
    expect(configured.navigation.roots.map((node) => node.slug)).toEqual(["guides"]);
    sessionStorage.setItem("zd-sidebar-scope", JSON.stringify({
      version: 2,
      context: configured.navigation.id,
      page: "guides/first",
      selected: "@forest",
      query: "",
      expansion: {},
    }));
    const root = await mount({ ...configured, currentSlug: "guides/first" });
    expect(root.textContent).not.toContain("About");
    expect(root.querySelector("[data-sidebar-broaden]")).toBeNull();
    sessionStorage.setItem("zd-sidebar-scope", JSON.stringify({
      version: 2,
      context: configured.navigation.id,
      page: "guides/first",
      selected: editorial.navigation.roots.find((node) => node.slug === "about")?.occurrenceId,
      query: "",
      expansion: {},
    }));
    view?.dispose();
    const again = await mount({ ...configured, currentSlug: "guides/first" });
    expect(again.textContent).not.toContain("About");
  });

  it("widens for native cross-branch navigation and ignores invalid stored scope", async () => {
    const data = build();
    sessionStorage.setItem("zd-sidebar-scope", JSON.stringify({ context: data.navigation.id, selected: "deleted", query: "" }));
    const root = await mount({ ...data, currentSlug: "guides/first" });
    expect(root.querySelector('[data-sidebar-restore]')).toBeNull();
    click(root.querySelector('button[aria-label="Focus sidebar on Guides"]'));
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
  expect(root.querySelector('[data-sidebar-scope-toolbar]')).toBeNull();
  click(root.querySelector('button[aria-label="サイドバーに「Guides」だけを表示"]'));
  await flushAll();
  expect(root.querySelector('[data-sidebar-broaden]')?.textContent).toContain("ツリーを広げる");
  expect(root.querySelector('[data-sidebar-restore]')).not.toBeNull();
  expect(root.querySelector('[data-sidebar-restore]')?.getAttribute("data-sidebar-tip")).toBe("現在のページのサイドバーに戻す");
  const focused = root.querySelector('button[aria-label="すでに「Guides」だけを表示しています"]');
  expect(focused?.getAttribute("aria-disabled")).toBe("true");
  expect(focused?.getAttribute("data-sidebar-tip")).toBe("すでにここだけを表示しています");
});

it("preserves an off-article branch across same-page refresh and a second desktop/mobile mount", async () => {
  const data = buildSidebarNavigation([], "en", undefined, undefined, {}, () => NODES, []);
  const root = await mount({ ...data, currentSlug: "about" });
  click(root.querySelector('button[aria-label="Focus sidebar on Guides"]'));
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
  click(root.querySelector('button[aria-label="Focus sidebar on Guides"]'));
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
  click(root.querySelector('button[aria-label="Focus sidebar on Notes"]'));
  await flushAll();
  expect(root.querySelector('button[aria-label="Collapse 2025"]')).not.toBeNull();
  view!.dispose();
  view = undefined;
  const remounted = await mount({ ...data, currentSlug: "notes/current" });
  expect(remounted.querySelector('button[aria-label="Collapse 2025"]')).not.toBeNull();
  click(remounted.querySelector('[data-sidebar-broaden]'));
  await flushAll();
  expect(remounted.querySelector('[data-sidebar-scope-toolbar]')).toBeNull();
  click(remounted.querySelector('button[aria-label="Focus sidebar on Notes"]'));
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

it("always hides the global toolbar at the highest scope and transfers focus to the active branch", async () => {
  const data = buildSidebarNavigation([], "en", "guides", undefined, {}, () => NODES, ["guides"]);
  const root = await mount({ ...data, currentSlug: "guides/first" });
  const url = window.location.href;
  click(root.querySelector('[data-sidebar-broaden]'));
  await flushAll();
  expect(root.querySelector('[data-sidebar-scope-toolbar]')).toBeNull();
  expect(root.querySelector('[data-sidebar-filter-region]')).not.toBeNull();
  expect(document.activeElement?.getAttribute("data-sidebar-focus")).not.toBeNull();
  expect(window.location.href).toBe(url);
  click(root.querySelector('button[aria-label="Collapse Guides"]'));
  await flushAll();
  expect(root.querySelector('[data-sidebar-scope-toolbar]')).toBeNull();
  click(root.querySelector('button[aria-label="Focus sidebar on Guides"]'));
  await flushAll();
  expect(root.querySelector('[data-sidebar-broaden]')).not.toBeNull();
});

it("compares effective disclosure instead of retaining a sticky Restore flag", async () => {
  const unrelated = { ...NODES[0]!, slug: "other", label: "Other", collapsed: undefined,
    children: [{ ...NODES[0]!.children[0]!, slug: "other/page" }] };
  const data = buildSidebarNavigation([{ slug: "guides/index", data: { sidebar_initial_expansion: "collapsed" } }], "en", "guides", undefined, {}, () => [NODES[0]!, unrelated], ["guides"]);
  // A narrower authored scope contains both categories under one editorial parent.
  data.nodes = data.navigation.roots;
  data.navigation.roots = [{ slug: "editorial", label: "Editorial", position: 0, hasPage: false, occurrenceId: "editorial", children: data.nodes }];
  for (const node of data.nodes) data.navigation.parents[node.occurrenceId!] = "editorial";
  data.navigation.parents.editorial = null;
  const root = await mount({ ...data, currentSlug: "guides/first" });
  expect(root.querySelector('button[aria-label="Expand Other"]')).not.toBeNull();
  expect(root.querySelector('[data-sidebar-restore]')).toBeNull();
  click(root.querySelector('button[aria-label="Expand Other"]'));
  await flushAll();
  expect(root.querySelector('[data-sidebar-restore]')).not.toBeNull();
  click(root.querySelector('button[aria-label="Collapse Other"]'));
  await flushAll();
  expect(root.querySelector('[data-sidebar-restore]')).toBeNull();
  click(root.querySelector('button[aria-label="Expand Other"]'));
  await flushAll();
  document.documentElement.dataset[CURRENT_PATH_DATASET_KEY] = "/docs/guides/second";
  document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
  await flushAll();
  expect(root.querySelector('button[aria-label="Collapse Other"]')).not.toBeNull();
  click(root.querySelector('[data-sidebar-restore]'));
  await flushAll();
  expect(root.querySelector('button[aria-label="Expand Other"]')).not.toBeNull();
  expect(root.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/docs/guides/second");
});


describe("explicit-only disclosure persistence", () => {
  const BRANCHES: SidebarNavNode[] = [
    NODES[0]!,
    { slug: "other", label: "Other", position: 1, hasPage: false, collapsed: true,
      children: [{ slug: "other/page", label: "Other page", position: 0, href: "/docs/other/page", hasPage: true, children: [] }] },
    NODES[1]!,
  ];
  const build = () => buildSidebarNavigation([], "en", undefined, undefined, {}, () => BRANCHES, []);
  const stored = () => JSON.parse(sessionStorage.getItem("zd-sidebar-scope")!);
  const navigateTo = async (path: string) => {
    document.documentElement.dataset[CURRENT_PATH_DATASET_KEY] = path;
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    await flushAll();
  };

  it("does not persist automatic route reveal across navigation and history traversal", async () => {
    const data = build();
    const root = await mount({ ...data, currentSlug: "about" });
    expect(stored()).toMatchObject({ version: 2, expansion: {} });
    for (const path of ["/docs/guides/first", "/docs/other/page", "/docs/guides/second", "/docs/other/page", "/docs/guides/second"]) {
      await navigateTo(path);
      expect(root.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe(path);
      expect(stored().expansion).toEqual({});
    }
    expect(root.querySelector('button[aria-label="Collapse Guides"]')).not.toBeNull();
    expect(root.querySelector('button[aria-label="Expand Other"]')).not.toBeNull();
    expect(root.querySelector('[data-sidebar-restore]')).toBeNull();
  });

  it("closes an active ancestor until a later destination, keeping unrelated choices", async () => {
    const data = build();
    document.documentElement.dataset[CURRENT_PATH_DATASET_KEY] = "/docs/guides/first";
    const root = await mount({ ...data, currentSlug: "guides/first" });
    click(root.querySelector('button[aria-label="Expand Other"]'));
    await flushAll();
    click(root.querySelector('button[aria-label="Collapse Guides"]'));
    await flushAll();
    expect(root.querySelector('a[href="/docs/guides/first"]')).toBeNull();
    expect(stored().expansion).toEqual({ "auto/0": false, "auto/1": true });
    // Same-page hash navigation and filtering are not destinations.
    await navigateTo("/docs/guides/first");
    const input = root.querySelector<HTMLInputElement>("input")!;
    for (const value of ["first", ""]) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await flushAll();
    }
    expect(root.querySelector('button[aria-label="Expand Guides"]')).not.toBeNull();
    await navigateTo("/docs/guides/second");
    expect(root.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/docs/guides/second");
    expect(root.querySelector('button[aria-label="Collapse Other"]')).not.toBeNull();
    expect(stored().expansion).toEqual({ "auto/1": true });
    click(root.querySelector('button[aria-label="Collapse Guides"]'));
    await flushAll();
    expect(stored().expansion).toEqual({ "auto/0": false, "auto/1": true });
    view!.dispose();
    view = undefined;
    // Same-page reload keeps the explicit collapse.
    const reloaded = await mount({ ...data, currentSlug: "guides/second" });
    expect(reloaded.querySelector('button[aria-label="Expand Guides"]')).not.toBeNull();
    expect(reloaded.querySelector('button[aria-label="Collapse Other"]')).not.toBeNull();
  });

  it("keeps two controllers in agreement and Restore resets both but keeps the query", async () => {
    const data = build();
    const root = await mount({ ...data, currentSlug: "guides/first" });
    const second = await renderIsland(SidebarTree, { ...data, ...toSidebarClientData(data.nodes, data.navigation), currentSlug: "guides/first" }, {
      identity: { component: "SidebarTree", build: "second-controller" },
    });
    try {
      click(second.root.querySelector('button[aria-label="Collapse Guides"]'));
      await flushAll();
      click(root.querySelector('button[aria-label="Focus sidebar on Other"]'));
      await flushAll();
      for (const treeRoot of [root, second.root]) {
        expect(treeRoot.querySelector('a[href="/docs/other/page"]')).not.toBeNull();
        expect(treeRoot.querySelector('a[href="/docs/about"]')).toBeNull();
      }
      expect(stored().expansion).toEqual({ "auto/0": false });
      await navigateTo("/docs/other/page");
      expect(stored().expansion).toEqual({ "auto/0": false });
      const input = second.root.querySelector<HTMLInputElement>("input")!;
      input.value = "page";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await flushAll();
      click(second.root.querySelector('[data-sidebar-restore]'));
      await flushAll();
      expect(stored()).toMatchObject({ selected: null, query: "page", expansion: {} });
      for (const treeRoot of [root, second.root]) {
        expect(treeRoot.querySelector<HTMLInputElement>("input")?.value).toBe("page");
        expect(treeRoot.querySelector('[data-sidebar-restore]')).toBeNull();
      }
    } finally { second.dispose(); }
  });

  it("migrates ambiguous legacy expansion once while preserving scope and query", async () => {
    const data = build();
    sessionStorage.setItem("zd-sidebar-scope", JSON.stringify({ context: data.navigation.id, page: "about", selected: "auto/1", query: "page", expansion: { "auto/0": true, "auto/0/0": true } }));
    const root = await mount({ ...data, currentSlug: "about" });
    expect(root.querySelector('a[href="/docs/other/page"]')).not.toBeNull();
    expect(root.querySelector<HTMLInputElement>("input")?.value).toBe("page");
    expect(stored()).toMatchObject({ version: 2, selected: "auto/1", query: "page", expansion: {} });
    click(root.querySelector('[data-sidebar-broaden]'));
    await flushAll();
    root.querySelector<HTMLInputElement>("input")!.value = "";
    root.querySelector<HTMLInputElement>("input")!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAll();
    click(root.querySelector('button[aria-label="Expand Guides"]'));
    await flushAll();
    view!.dispose();
    view = undefined;
    const again = await mount({ ...data, currentSlug: "about" });
    expect(again.querySelector('button[aria-label="Collapse Guides"]')).not.toBeNull();
    expect(stored().expansion).toEqual({ "auto/0": true });
  });

  it("fails safe on malformed or unavailable storage", async () => {
    const data = build();
    for (const value of ["not json", "5", "[]", JSON.stringify({ version: 2, context: data.navigation.id, page: "about", selected: 7, query: 3, expansion: { "auto/0": "yes", stale: true, "auto/1": false } })]) {
      sessionStorage.setItem("zd-sidebar-scope", value);
      const root = await mount({ ...data, currentSlug: "about" });
      expect(root.querySelector('[data-sidebar-restore]')).toBeNull();
      expect(root.querySelector<HTMLInputElement>("input")?.value).toBe("");
      expect(stored()).toMatchObject({ version: 2, selected: null, query: "" });
      expect(Object.keys(stored().expansion).every((id) => id === "auto/1")).toBe(true);
      view!.dispose();
      view = undefined;
    }
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    try {
      const root = await mount({ ...data, currentSlug: "about" });
      click(root.querySelector('button[aria-label="Expand Guides"]'));
      await flushAll();
      expect(root.querySelector('button[aria-label="Collapse Guides"]')).not.toBeNull();
    } finally { getItem.mockRestore(); setItem.mockRestore(); }
  });

  it("opens the sole scope root from outside it, honoring a same-page collapse until the next destination", async () => {
    const tree: SidebarNavNode[] = [{ slug: "wind", label: "Wind", position: 0, href: "/docs/wind", hasPage: true, collapsed: true, children: [
      { slug: "wind/surfaces", label: "Surfaces", position: 0, href: "/docs/wind/surfaces", hasPage: true, collapsed: true, children: [
        { slug: "wind/surfaces/background", label: "Background", position: 0, href: "/docs/wind/surfaces/background", hasPage: true, children: [] },
      ] },
      { slug: "wind/layout", label: "Layout", position: 1, href: "/docs/wind/layout", hasPage: true, collapsed: true, children: [
        { slug: "wind/layout/spacing", label: "Spacing", position: 0, href: "/docs/wind/layout/spacing", hasPage: true, children: [] },
      ] },
    ] }];
    const data = buildSidebarNavigation([], "en", "wind", undefined, { wind: { items: [{ type: "autogenerated" }], initialPath: [0, 0], initialPathMode: "node" } }, () => tree, ["wind"]);
    document.documentElement.dataset[CURRENT_PATH_DATASET_KEY] = "/docs/wind/layout/spacing";
    const root = await mount({ ...data, currentSlug: "wind/layout/spacing" });
    expect(root.querySelector('a[href="/docs/wind/surfaces/background"]')).not.toBeNull();
    click(root.querySelector('button[aria-label="Collapse Surfaces"]'));
    await flushAll();
    expect(stored().expansion).toEqual({ [data.nodes[0]!.occurrenceId!]: false });
    view!.dispose();
    view = undefined;
    const reloaded = await mount({ ...data, currentSlug: "wind/layout/spacing" });
    expect(reloaded.querySelector('button[aria-label="Expand Surfaces"]')).not.toBeNull();
    await navigateTo("/docs/wind/surfaces/background");
    expect(reloaded.querySelector('button[aria-label="Collapse Surfaces"]')).not.toBeNull();
    expect(stored().expansion).toEqual({});
  });

  it("keeps an explicit collapse when broadening out of a focused branch", async () => {
    const data = build();
    const root = await mount({ ...data, currentSlug: "about" });
    click(root.querySelector('button[aria-label="Focus sidebar on Guides"]'));
    await flushAll();
    click(root.querySelector('button[aria-label="Collapse Guides"]'));
    await flushAll();
    click(root.querySelector('[data-sidebar-broaden]'));
    await flushAll();
    expect(root.querySelector('button[aria-label="Expand Guides"]')).not.toBeNull();
    expect(stored().expansion).toEqual({ "auto/0": false });
  });

  it("treats focusing a spliced node-mode baseline root as the baseline", async () => {
    const data = buildSidebarNavigation([], "en", "guides", undefined, { guides: {
      items: [{ type: "category", label: "Editorial", items: [{ type: "category", label: "Local", items: [{ type: "autogenerated", dirName: "guides" }] }] }],
      initialPath: [0, 0], initialPathMode: "node",
    } }, () => NODES, ["guides"]);
    const root = await mount({ ...data, currentSlug: "guides/first" });
    // The node-mode baseline already shows Local as its single root, so its frame is inactive.
    const local = root.querySelector('button[aria-label="Sidebar is already focused on Local"]');
    expect(local?.getAttribute("aria-disabled")).toBe("true");
    click(local);
    await flushAll();
    expect(stored().selected).toBeNull();
    expect(root.querySelector('[data-sidebar-restore]')).toBeNull();
  });

  it("canonicalizes a stored scope equal to the node-mode baseline and keeps different scopes", async () => {
    const tree: SidebarNavNode[] = [{ slug: "wind", label: "Wind", position: 0, href: "/docs/wind", hasPage: true, children: [
      { slug: "wind/surfaces", label: "Surfaces", position: 0, href: "/docs/wind/surfaces", hasPage: true, children: [
        { slug: "wind/surfaces/background", label: "Background", position: 0, href: "/docs/wind/surfaces/background", hasPage: true, children: [] },
      ] },
    ] }];
    const data = buildSidebarNavigation([], "en", "wind", undefined, { wind: { items: [{ type: "autogenerated" }], initialPath: [0, 0], initialPathMode: "node" } }, () => tree, ["wind"]);
    sessionStorage.setItem("zd-sidebar-scope", JSON.stringify({ version: 2, context: data.navigation.id, page: "wind", selected: data.nodes[0]!.occurrenceId, query: "", expansion: {} }));
    const root = await mount({ ...data, currentSlug: "wind/surfaces/background" });
    expect(stored().selected).toBeNull();
    expect(root.querySelector('[data-sidebar-restore]')).toBeNull();
    expect(root.querySelector('[data-sidebar-tree-root] a')?.getAttribute("href")).toBe("/docs/wind/surfaces");
    expect(root.querySelector('a[href="/docs/wind"]')).toBeNull();
    click(root.querySelector('[data-sidebar-broaden]'));
    await flushAll();
    expect(root.querySelector('a[href="/docs/wind"]')).not.toBeNull();
    view!.dispose();
    view = undefined;
    const remounted = await mount({ ...data, currentSlug: "wind/surfaces/background" });
    expect(remounted.querySelector('a[href="/docs/wind"]')).not.toBeNull();
    expect(stored().selected).toBe(data.navigation.roots[0]!.occurrenceId);
  });
});

describe("focus frame, branch preview and tooltip", () => {
  const FOREST: SidebarNavNode[] = [
    NODES[0]!,
    { slug: "other", label: "Other", position: 1, href: "/docs/other", hasPage: true, collapsed: true,
      children: [{ slug: "other/page", label: "Other page", position: 0, href: "/docs/other/page", hasPage: true, children: [] }] },
    NODES[1]!,
  ];
  const build = () => buildSidebarNavigation([], "en", undefined, undefined, {}, () => FOREST, []);
  const frame = (root: Element, label: string) => root.querySelector<HTMLButtonElement>(`button[aria-label="Focus sidebar on ${label}"]`);
  const previewed = (root: Element) => [...root.querySelectorAll("[data-sidebar-preview]")];
  const pointer = (type: "pointerover" | "pointerout", target: Element, pointerType: string) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, "pointerType", { value: pointerType });
    Object.defineProperty(event, "relatedTarget", { value: null });
    target.dispatchEvent(event);
  };
  const branchOf = (button: Element | null) => button?.closest("[data-sidebar-branch]");
  const tooltip = () => document.querySelector<HTMLElement>('[role="tooltip"][data-sidebar-tooltip]');

  it("renders the four-corner frame at rest, separate from link and disclosure", async () => {
    const root = await mount({ ...build(), currentSlug: "about" });
    const other = frame(root, "Other")!;
    expect(other.textContent).toBe("");
    expect(root.textContent).not.toContain("◎");
    const svg = other.querySelector('svg[aria-hidden="true"]')!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("stroke-width")).toBe("1.65");
    expect(svg.querySelector("path")?.getAttribute("d")).toBe("M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3");
    expect(other.getAttribute("data-sidebar-tip")).toBe("Focus sidebar here");
    expect(other.getAttribute("data-sidebar-tip-detail")).toBe("Other");
    expect(other.hasAttribute("aria-disabled")).toBe(false);
    const row = other.closest("[data-sidebar-row]")!;
    expect(row.querySelector('a[href="/docs/other"]')).not.toBeNull();
    expect(row.querySelector('button[aria-label="Expand Other"]')).not.toBeNull();
    expect(other.contains(row.querySelector("a"))).toBe(false);
  });

  it("previews exactly the hovered branch for mouse, never for touch, without persisting", async () => {
    const root = await mount({ ...build(), currentSlug: "about" });
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const broadcasts: Event[] = [];
    const onSync = (event: Event) => broadcasts.push(event);
    document.addEventListener("zd:sidebar-scope", onSync);
    try {
      pointer("pointerover", frame(root, "Other")!, "touch");
      await flushAll();
      expect(previewed(root)).toHaveLength(0);
      pointer("pointerover", frame(root, "Other")!, "mouse");
      await flushAll();
      expect(previewed(root)).toEqual([branchOf(frame(root, "Other"))]);
      // Collapsed: the preview marks the row without expanding its children.
      expect(root.querySelector('a[href="/docs/other/page"]')).toBeNull();
      // Hovering the link or disclosure is not a preview trigger.
      pointer("pointerout", frame(root, "Other")!, "mouse");
      pointer("pointerover", root.querySelector('a[href="/docs/other"]')!, "mouse");
      await flushAll();
      expect(previewed(root)).toHaveLength(0);
      expect(writes).not.toHaveBeenCalled();
      expect(broadcasts).toHaveLength(0);
      expect(window.location.hash).toBe("");
    } finally {
      writes.mockRestore();
      document.removeEventListener("zd:sidebar-scope", onSync);
    }
  });

  it("lets pointer hover win over the keyboard-focused frame and falls back on pointer departure", async () => {
    const root = await mount({ ...build(), currentSlug: "about" });
    const guides = frame(root, "Guides")!;
    const other = frame(root, "Other")!;
    guides.focus();
    guides.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await flushAll();
    expect(previewed(root)).toEqual([branchOf(guides)]);
    pointer("pointerover", other, "mouse");
    await flushAll();
    expect(previewed(root)).toEqual([branchOf(other)]);
    pointer("pointerout", other, "mouse");
    await flushAll();
    expect(previewed(root)).toEqual([branchOf(guides)]);
    guides.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await flushAll();
    expect(previewed(root)).toHaveLength(0);
  });

  it("clears a stale preview on filtering, scope change and navigation", async () => {
    const root = await mount({ ...build(), currentSlug: "about" });
    pointer("pointerover", frame(root, "Other")!, "mouse");
    await flushAll();
    const input = root.querySelector<HTMLInputElement>("input")!;
    input.value = "page";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAll();
    expect(previewed(root)).toHaveLength(0);
    pointer("pointerover", frame(root, "Other")!, "mouse");
    await flushAll();
    expect(previewed(root)).toHaveLength(1);
    // A filtered view previews its rendered branch without changing the filter.
    expect(input.value).toBe("page");
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    await flushAll();
    expect(previewed(root)).toHaveLength(0);
    pointer("pointerover", frame(root, "Other")!, "mouse");
    await flushAll();
    click(frame(root, "Other"));
    await flushAll();
    expect(previewed(root)).toHaveLength(0);
  });

  it("makes the focused root's frame inactive while its disclosure keeps working", async () => {
    const root = await mount({ ...build(), currentSlug: "about" });
    click(frame(root, "Other"));
    await flushAll();
    const inactive = root.querySelector<HTMLButtonElement>('button[aria-label="Sidebar is already focused on Other"]')!;
    expect(inactive.getAttribute("aria-disabled")).toBe("true");
    expect(inactive.getAttribute("tabindex")).toBe("-1");
    expect(inactive.getAttribute("data-sidebar-tip")).toBe("Already focused here");
    const before = sessionStorage.getItem("zd-sidebar-scope");
    click(inactive);
    await flushAll();
    expect(sessionStorage.getItem("zd-sidebar-scope")).toBe(before);
    expect(root.querySelector("[data-sidebar-restore]")).not.toBeNull();
    // Not a preview trigger either.
    pointer("pointerover", inactive, "mouse");
    await flushAll();
    expect(previewed(root)).toHaveLength(0);
    click(root.querySelector('button[aria-label="Collapse Other"]'));
    await flushAll();
    expect(root.querySelector('button[aria-label="Expand Other"]')).not.toBeNull();
    expect(root.querySelector('a[href="/docs/other/page"]')).toBeNull();
  });

  it("derives the inactive frame from the unfiltered scope, not the filtered rows", async () => {
    const root = await mount({ ...build(), currentSlug: "about" });
    const input = root.querySelector<HTMLInputElement>("input")!;
    input.value = "other page";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAll();
    expect(root.querySelectorAll("[data-sidebar-tree-root] > [data-sidebar-branch]")).toHaveLength(1);
    const other = frame(root, "Other")!;
    expect(other.hasAttribute("aria-disabled")).toBe(false);
    click(other);
    await flushAll();
    expect(input.value).toBe("other page");
    expect(root.querySelector('button[aria-label="Sidebar is already focused on Other"]')).not.toBeNull();
  });

  it("moves keyboard focus to the new root's own action, never to an inactive frame", async () => {
    const root = await mount({ ...build(), currentSlug: "about" });
    frame(root, "Guides")!.focus();
    click(frame(root, "Guides"));
    await flushAll();
    // Guides has no page, so its disclosure is the root row's primary action.
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Collapse Guides");
    click(root.querySelector("[data-sidebar-restore]"));
    await flushAll();
    click(frame(root, "Other"));
    await flushAll();
    expect(document.activeElement?.getAttribute("href")).toBe("/docs/other");
    expect(document.activeElement?.getAttribute("aria-disabled")).toBeNull();
  });

  it("marks the arrived root briefly", async () => {
    vi.useFakeTimers();
    try {
      const root = await mount({ ...build(), currentSlug: "about" });
      click(frame(root, "Other"));
      await flushAll();
      expect(root.querySelector("[data-sidebar-arrived]")).toBe(branchOf(root.querySelector('button[aria-label="Sidebar is already focused on Other"]')));
      vi.advanceTimersByTime(800);
      await flushAll();
      expect(root.querySelector("[data-sidebar-arrived]")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows an associated tooltip on keyboard focus and consumes only the first Escape", async () => {
    const root = await mount({ ...build(), currentSlug: "about" });
    const other = frame(root, "Other")!;
    other.focus();
    other.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await flushAll();
    const tip = tooltip()!;
    expect(tip.hidden).toBe(false);
    expect(tip.parentElement).toBe(document.body);
    expect(tip.textContent).toBe("Focus sidebar hereOther");
    expect(other.getAttribute("aria-describedby")).toBe(tip.id);
    expect(document.activeElement).toBe(other);
    const first = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    other.dispatchEvent(first);
    expect(first.defaultPrevented).toBe(true);
    expect(tip.hidden).toBe(true);
    expect(other.hasAttribute("aria-describedby")).toBe(false);
    const second = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    other.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(false);
    const composing = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, isComposing: true });
    other.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    other.dispatchEvent(composing);
    expect(composing.defaultPrevented).toBe(false);
  });

  it("removes its tooltip and listeners on disposal", async () => {
    await mount({ ...build(), currentSlug: "about" });
    expect(tooltip()).not.toBeNull();
    view!.dispose();
    view = undefined;
    expect(tooltip()).toBeNull();
  });

  it("renders no frame or tooltip without navigation context", async () => {
    const root = await mount({ nodes: NODES, currentSlug: "about" });
    expect(root.querySelector("[data-sidebar-focus]")).toBeNull();
    expect(tooltip()).toBeNull();
  });
});
