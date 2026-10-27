/** @jsxRuntime automatic */
/**
 * SSG HTML-presence test for the SidebarTree island component.
 *
 * Verifies that navigation links appear in the serialized HTML produced by
 * `renderSsr` from the zudo-react harness (which mirrors what zfb emits
 * into `dist/**\/index.html`). Static markup must contain nav structure so
 * crawlers and JS-off users can discover doc links.
 *
 * Also tests the `data-zfb-island` call-site marker via Island wrapper, and
 * checks the `displayName` pin and the public island boundary marker.
 */

import { describe, expect, it } from "vitest";
import { renderSsr as render } from "../../__tests__/helpers/zudo-react.js";
import { SidebarTree } from "../index.js";
import { h } from "@takazudo/zfb/zudo-react";
import { islandRoot } from "@takazudo/zfb/zudo-react/server";
import type { SidebarNavNode } from "../../sidebar/types.js";
import { buildSidebarNavigation } from "../../sidebar-utils/index.js";

const SAMPLE_NODES: SidebarNavNode[] = [
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

describe("SidebarTree — SSG HTML presence", () => {
  it("renders nav landmark in static HTML", () => {
    const html = render(<SidebarTree nodes={SAMPLE_NODES} />);
    expect(html).toContain("<nav");
  });

  it("renders leaf node href in static HTML", () => {
    const html = render(<SidebarTree nodes={SAMPLE_NODES} />);
    expect(html).toContain('href="/docs/introduction"');
  });

  it("renders nested leaf node href in static HTML", () => {
    const html = render(<SidebarTree nodes={SAMPLE_NODES} />);
    expect(html).toContain('href="/docs/guides/getting-started"');
  });

  it("renders filter input in static HTML", () => {
    const html = render(<SidebarTree nodes={SAMPLE_NODES} />);
    expect(html).toContain('aria-label="Filter navigation"');
  });

  it("renders empty nav gracefully", () => {
    const html = render(<SidebarTree nodes={[]} />);
    expect(html).toContain("<nav");
  });
});

describe("SidebarTree — focus frame SSR markup", () => {
  const data = buildSidebarNavigation([], "en", undefined, undefined, {}, () => SAMPLE_NODES, []);

  it("server-renders the four-corner frame with no transient preview, arrival or tooltip state", () => {
    const html = render(<SidebarTree {...data} currentSlug="introduction" />);
    expect(html).toContain('aria-label="Focus sidebar on Guides"');
    expect(html).toContain('d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3"');
    expect(html).not.toContain("◎");
    expect(html).not.toContain("data-sidebar-preview");
    expect(html).not.toContain("data-sidebar-arrived");
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain('role="tooltip"');
  });

  it("server-renders no frame for nodes-only sidebars", () => {
    const html = render(<SidebarTree nodes={SAMPLE_NODES} />);
    expect(html).not.toContain("data-sidebar-focus");
  });
});

describe("SidebarTree — displayName pin", () => {
  it("has displayName set to SidebarTree", () => {
    expect(SidebarTree.displayName).toBe("SidebarTree");
  });
});

describe("SidebarTree — call-site Island marker", () => {
  it("emits data-zfb-island=SidebarTree in SSG output", () => {
    const html = render(
      islandRoot(h(SidebarTree, { nodes: SAMPLE_NODES }), {
        identity: { component: "SidebarTree", build: "test" },
      }),
    );
    expect(html).toContain('data-zfb-island="SidebarTree"');
  });
});
