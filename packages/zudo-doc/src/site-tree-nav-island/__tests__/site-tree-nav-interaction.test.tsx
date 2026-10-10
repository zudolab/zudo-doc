/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  flushAll,
  renderIsland,
} from "../../__tests__/helpers/zudo-react.js";
import { SiteTreeNav } from "../index.js";
import type { SiteTreeNavProps } from "../index.js";
import type { SidebarNavNode } from "../../sidebar/types.js";

const TREE: SidebarNavNode[] = [
  {
    slug: "guides",
    label: "Guides",
    position: 0,
    hasPage: false,
    children: [
      {
        slug: "guides/first",
        label: "First guide",
        position: 0,
        href: "/docs/guides/first",
        hasPage: true,
        children: [],
      },
      {
        slug: "guides/second",
        label: "Second guide",
        position: 1,
        href: "/docs/guides/second",
        hasPage: true,
        children: [],
      },
    ],
  },
  {
    slug: "reference",
    label: "Reference",
    position: 1,
    href: "/docs/reference",
    hasPage: true,
    children: [],
  },
];

const mounted: Array<() => void> = [];

afterEach(() => {
  for (const dispose of mounted.splice(0)) dispose();
  localStorage.clear();
  vi.restoreAllMocks();
});

async function mount(props: SiteTreeNavProps) {
  const view = await renderIsland(SiteTreeNav, props, {
    identity: { component: "SiteTreeNav", build: "test" },
  });
  expect(view.diagnostics).toEqual([]);
  mounted.push(view.dispose);
  return view;
}

describe("SiteTreeNav hydration and interaction", () => {
  it("hydrates the serializable collapsed state, expands its children, and keeps navigation links", async () => {
    // Browser storage does not override the state encoded in the SSR props.
    const storageRead = vi.spyOn(Storage.prototype, "getItem");
    const view = await mount({
      tree: TREE,
      initiallyCollapsedCategorySlugs: ["guides"],
    });
    expect(storageRead).not.toHaveBeenCalled();

    const root = view.root;
    const expand = root.querySelector<HTMLButtonElement>(
      'button[aria-label="Expand Guides"]',
    )!;
    expect(expand).not.toBeNull();
    expect(root.querySelector('a[href="/docs/guides/first"]')).toBeNull();
    expect(root.querySelector('a[href="/docs/reference"]')).not.toBeNull();

    expand.click();
    await flushAll();

    expect(root.querySelector('button[aria-label="Collapse Guides"]')).not.toBeNull();
    expect(root.querySelector('a[href="/docs/guides/first"]')?.textContent).toBe(
      "First guide",
    );
    expect(root.querySelector('a[href="/docs/guides/second"]')).not.toBeNull();
    expect(root.querySelector('a[href="/docs/reference"]')?.getAttribute("href")).toBe(
      "/docs/reference",
    );
  });

  it("collapses and reopens an expanded category without replacing its sibling row", async () => {
    const view = await mount({ tree: TREE });
    const root = view.root;
    const reference = root.querySelector('a[href="/docs/reference"]')!;
    const collapse = root.querySelector<HTMLButtonElement>(
      'button[aria-label="Collapse Guides"]',
    )!;

    collapse.click();
    await flushAll();
    expect(root.querySelector('a[href="/docs/guides/first"]')).toBeNull();
    expect(root.querySelector('button[aria-label="Expand Guides"]')).not.toBeNull();
    expect(root.querySelector('a[href="/docs/reference"]')).toBe(reference);

    root.querySelector<HTMLButtonElement>('button[aria-label="Expand Guides"]')!.click();
    await flushAll();
    expect(root.querySelector('a[href="/docs/guides/first"]')).not.toBeNull();
    expect(root.querySelector('a[href="/docs/reference"]')).toBe(reference);
  });

  it("detaches the category listener on island disposal", async () => {
    const view = await mount({ tree: TREE });
    const button = view.root.querySelector<HTMLButtonElement>(
      'button[aria-label="Collapse Guides"]',
    )!;
    const before = button.getAttribute("aria-expanded");

    view.dispose();
    mounted.pop();
    button.click();
    await flushAll();

    expect(button.getAttribute("aria-expanded")).toBe(before);
  });

  it("renders node labels as escaped text", async () => {
    const htmlView = await mount({
      tree: [
        {
          slug: "unsafe-looking-label",
          label: "<script>bad()</script>",
          position: 0,
          href: "/docs/safe-text",
          hasPage: true,
          children: [],
        },
      ],
    });

    expect(htmlView.root.innerHTML).toContain("&lt;script&gt;bad()&lt;/script&gt;");
    expect(htmlView.root.querySelector("script")).toBeNull();
  });
});
