/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Real-DOM regression tests for the explicit current-route override threaded
// through SidebarTree's active-slug derivation (zudolab/zudo-doc#3398).
//
// Covers the override priority — `currentPath` prop >
// `document.documentElement.dataset.zdCurrentPath` > `window.location.pathname`
// — and the srcdoc/unusable-pathname case: inside an iframe `srcdoc` document,
// `location.pathname` is the literal string "srcdoc", which matches no route
// (spike ledger adl-0005). `deriveActiveSlug` must return `undefined` for
// such a pathname, and the caller (`useActiveSlug`) must PRESERVE the
// existing (SSR-supplied) active slug instead of clearing it.

import { afterEach, describe, expect, it } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import { SidebarTree, type SidebarTreeProps } from "../index.js";
import type { SidebarNavNode } from "../../sidebar/types.js";

const NODES: SidebarNavNode[] = [
  {
    slug: "introduction",
    label: "Introduction",
    position: 0,
    href: "/docs/introduction",
    hasPage: true,
    children: [],
  },
  {
    slug: "guides",
    label: "Guides",
    position: 1,
    hasPage: false,
    children: [
      {
        slug: "guides/getting-started",
        label: "Getting Started",
        position: 0,
        href: "/docs/guides/getting-started",
        hasPage: true,
        children: [],
      },
    ],
  },
];

let mounted: HTMLDivElement | null = null;

function mount(props: SidebarTreeProps): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    render(<SidebarTree {...props} />, container);
  });
  mounted = container;
  return container;
}

afterEach(() => {
  if (mounted) {
    act(() => {
      render(null, mounted!);
    });
    mounted.remove();
    mounted = null;
  }
  delete document.documentElement.dataset.zdCurrentPath;
});

describe("SidebarTree — explicit current-route override", () => {
  it("prefers the explicit currentPath prop over the dataset override", () => {
    document.documentElement.dataset.zdCurrentPath = "/docs/introduction";
    const container = mount({ nodes: NODES, currentPath: "/docs/guides/getting-started" });

    const active = container.querySelector('a[aria-current="page"]');
    expect(active?.getAttribute("href")).toBe("/docs/guides/getting-started");
  });

  it("falls back to document.documentElement.dataset.zdCurrentPath when no currentPath prop is given", () => {
    document.documentElement.dataset.zdCurrentPath = "/docs/introduction";
    const container = mount({ nodes: NODES });

    const active = container.querySelector('a[aria-current="page"]');
    expect(active?.getAttribute("href")).toBe("/docs/introduction");
  });
});

describe("SidebarTree — srcdoc / unusable pathname preserves SSR markers", () => {
  it("keeps the SSR-supplied active slug when the resolved pathname matches no route", () => {
    const container = mount({
      nodes: NODES,
      currentSlug: "guides/getting-started",
      currentPath: "srcdoc",
    });

    const activeLinks = container.querySelectorAll('a[aria-current="page"]');
    expect(activeLinks).toHaveLength(1);
    expect(activeLinks[0]?.getAttribute("href")).toBe("/docs/guides/getting-started");
  });

  it("renders with no active marker (nothing cleared, nothing wrongly matched) when there is no SSR slug either", () => {
    const container = mount({ nodes: NODES, currentPath: "srcdoc" });

    expect(container.querySelector('a[aria-current="page"]')).toBeNull();
  });
});
