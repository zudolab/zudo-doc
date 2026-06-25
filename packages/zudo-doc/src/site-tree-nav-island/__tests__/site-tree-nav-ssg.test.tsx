/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SSG HTML-presence test for the SiteTreeNav island component.
 *
 * Verifies that the site navigation grid appears in the serialized HTML
 * produced by `preact-render-to-string`. The static markup must contain
 * the nav structure so crawlers and JS-off users can discover all sections.
 */

import { describe, expect, it } from "vitest";
import type { VNode } from "preact";
import { render } from "preact-render-to-string";
import { Island } from "@takazudo/zfb";
import { SiteTreeNav } from "../index.js";
import type { SidebarNavNode } from "../../sidebar/types.js";

const SAMPLE_TREE: SidebarNavNode[] = [
  {
    slug: "guides",
    label: "Guides",
    position: 0,
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
  {
    slug: "reference",
    label: "Reference",
    position: 1,
    href: "/docs/reference",
    hasPage: true,
    children: [],
  },
];

describe("SiteTreeNav — SSG HTML presence", () => {
  it("renders a nav element with aria-label in static HTML", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} />);
    expect(html).toContain("<nav");
    expect(html).toContain('aria-label="Site index"');
  });

  it("renders custom aria-label when provided", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} ariaLabel="Docs index" />);
    expect(html).toContain('aria-label="Docs index"');
  });

  it("renders category label text in static HTML", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} />);
    expect(html).toContain("Guides");
    expect(html).toContain("Reference");
  });

  it("renders child node href in static HTML", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} />);
    expect(html).toContain('href="/docs/guides/getting-started"');
  });

  it("renders the data-site-nav attribute in static HTML", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} />);
    expect(html).toContain("data-site-nav");
  });

  it("respects categoryIgnore to filter nodes", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} categoryIgnore={["guides"]} />);
    expect(html).not.toContain("Getting Started");
    expect(html).toContain("Reference");
  });

  it("renders empty nav when all nodes are ignored", () => {
    const html = render(<SiteTreeNav tree={SAMPLE_TREE} categoryIgnore={["guides", "reference"]} />);
    expect(html).toContain("<nav");
    // No category cards rendered
    expect(html).not.toContain("Getting Started");
    expect(html).not.toContain('href="/docs/reference"');
  });
});

describe("SiteTreeNav — displayName pin", () => {
  it("has displayName set to SiteTreeNav", () => {
    expect(SiteTreeNav.displayName).toBe("SiteTreeNav");
  });
});

describe("SiteTreeNav — call-site Island marker", () => {
  it("emits data-zfb-island=SiteTreeNav in SSG output when wrapped with Island(when:idle)", () => {
    const html = render(
      // Island() returns the public IslandElement shape ({ type, props, key });
      // it is a real Preact VNode at runtime, so re-view it as VNode for render().
      Island({
        when: "idle",
        children: <SiteTreeNav tree={SAMPLE_TREE} />,
      }) as unknown as VNode,
    );
    expect(html).toContain('data-zfb-island="SiteTreeNav"');
  });
});
