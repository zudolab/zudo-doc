/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SSG HTML-presence test for the SidebarToggle island component.
 *
 * Verifies that the hamburger button and mobile sidebar panel appear in
 * the serialized HTML produced by `preact-render-to-string`. The static
 * markup must include the full sidebar tree so crawlers and JS-off users
 * can navigate even when the mobile panel is closed.
 */

import { describe, expect, it } from "vitest";
import type { VNode } from "preact";
import { render } from "preact-render-to-string";
import { Island } from "@takazudo/zfb";
import { SidebarToggle } from "../index.js";
import type { SidebarNavNode } from "../../sidebar/types.js";

const SAMPLE_NODES: SidebarNavNode[] = [
  {
    slug: "introduction",
    label: "Introduction",
    position: 0,
    href: "/docs/introduction",
    hasPage: true,
    children: [],
  },
];

describe("SidebarToggle — SSG HTML presence", () => {
  it("renders hamburger button in static HTML", () => {
    const html = render(<SidebarToggle nodes={SAMPLE_NODES} />);
    expect(html).toContain('aria-label="Open sidebar"');
  });

  it("renders sidebar panel (aside) in closed state in static HTML", () => {
    const html = render(<SidebarToggle nodes={SAMPLE_NODES} />);
    expect(html).toContain("<aside");
    // Closed state: -translate-x-full class
    expect(html).toContain("-translate-x-full");
  });

  it("renders embedded SidebarTree nav markup in static HTML", () => {
    const html = render(<SidebarToggle nodes={SAMPLE_NODES} />);
    expect(html).toContain('href="/docs/introduction"');
  });

  it("renders backdrop overlay element in static HTML", () => {
    const html = render(<SidebarToggle nodes={SAMPLE_NODES} />);
    // Backdrop div with modal-backdrop z-index
    expect(html).toContain("z-modal-backdrop");
  });
});

// Stable theme-pack DOM hook for the mobile drawer (zudolab/zudo-doc#2887 —
// the mobile counterpart of the desktop `#desktop-sidebar`, which the drawer
// does not share; `--zdc-sidebar-font` selects on both). Mirrors the Footer's
// `data-footer` hook suite (#2873).
describe("SidebarToggle — data-zd-mobile-sidebar hook", () => {
  it("renders data-zd-mobile-sidebar on the drawer <aside>", () => {
    const html = render(<SidebarToggle nodes={SAMPLE_NODES} />);
    expect(html).toMatch(/<aside[^>]*data-zd-mobile-sidebar[^>]*>/);
  });

  it("carries the hook alongside inert in the closed SSR state", () => {
    // SSR always renders open=false, so the drawer serialises with BOTH
    // `inert` and the hook — the hook must not displace or break `inert`.
    const html = render(<SidebarToggle nodes={SAMPLE_NODES} />);
    const aside = html.match(/<aside[^>]*>/)?.[0] ?? "";
    expect(aside).toContain("data-zd-mobile-sidebar");
    expect(aside).toContain("inert");
  });

  it("is unconditional, so the hook is byte-stable across a re-render", () => {
    // Unlike `inert` (which tracks `open`), the hook never varies. Rendering
    // twice must produce byte-identical markup — the property hydration relies
    // on, per the `inert` SSR byte-stability note in the component.
    const first = render(<SidebarToggle nodes={SAMPLE_NODES} />);
    const second = render(<SidebarToggle nodes={SAMPLE_NODES} />);
    expect(first).toBe(second);
    expect(first).toMatch(/<aside[^>]*data-zd-mobile-sidebar[^>]*>/);
  });
});

describe("SidebarToggle — displayName pin", () => {
  it("has displayName set to SidebarToggle", () => {
    expect(SidebarToggle.displayName).toBe("SidebarToggle");
  });
});

describe("SidebarToggle — call-site Island marker", () => {
  it("emits data-zfb-island=SidebarToggle in SSG output", () => {
    const html = render(
      // Island() returns the public IslandElement shape ({ type, props, key });
      // it is a real Preact VNode at runtime, so re-view it as VNode for render().
      Island({
        when: "visible",
        children: <SidebarToggle nodes={SAMPLE_NODES} />,
      }) as unknown as VNode,
    );
    expect(html).toContain('data-zfb-island="SidebarToggle"');
  });
});

// zudolab/zudo-doc#4355: the inactive toggle icon used to be hidden with
// Tailwind's `.hidden` utility, which lives in `@layer utilities`. A consumer
// component pack shipping an UNLAYERED `img, svg, … { display: block }` reset
// outranks any layered rule, so both icons rendered and the toggle grew to
// 48px. The hidden state is now an inline declaration, which no author rule —
// layered or not — can outrank. These assertions pin that: an icon's hidden
// state must never come back as a class.
describe("SidebarToggle — icon hidden state survives consumer cascade layers", () => {
  const iconTags = (html: string) =>
    html.match(/<svg[^>]*h-icon-lg[^>]*>/g) ?? [];

  it("hides exactly one of the two icons inline in the SSR (closed) state", () => {
    const icons = iconTags(render(<SidebarToggle nodes={SAMPLE_NODES} />));
    expect(icons).toHaveLength(2);
    // SSR always renders open=false: the X icon is hidden, the hamburger shows.
    expect(icons[0]).toContain('style="display:none"');
    expect(icons[1]).not.toContain("display:none");
  });

  it("never expresses an icon's hidden state as a class", () => {
    for (const icon of iconTags(render(<SidebarToggle nodes={SAMPLE_NODES} />))) {
      expect(icon).not.toMatch(/class="[^"]*\bhidden\b/);
    }
  });
});
