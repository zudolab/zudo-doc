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

describe("SidebarToggle — displayName pin", () => {
  it("has displayName set to SidebarToggle", () => {
    expect(SidebarToggle.displayName).toBe("SidebarToggle");
  });
});

describe("SidebarToggle — call-site Island marker", () => {
  it("emits data-zfb-island=SidebarToggle in SSG output", () => {
    const html = render(
      Island({
        when: "visible",
        children: <SidebarToggle nodes={SAMPLE_NODES} />,
      }) as ReturnType<typeof Island>,
    );
    expect(html).toContain('data-zfb-island="SidebarToggle"');
  });
});
