/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SSG HTML-presence test for the DesktopSidebarToggle island component.
 *
 * Verifies that the toggle button appears in the serialized HTML produced
 * by `preact-render-to-string`. The button renders in both visible and
 * hidden states with the correct aria attributes.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { Island } from "@takazudo/zfb";
import { DesktopSidebarToggle } from "../index.js";

describe("DesktopSidebarToggle — SSG HTML presence", () => {
  it("renders a button element in static HTML", () => {
    const html = render(<DesktopSidebarToggle />);
    expect(html).toContain("<button");
  });

  it("renders in visible (default) state with correct aria-label", () => {
    const html = render(<DesktopSidebarToggle />);
    // SSR defaults to visible=true
    expect(html).toContain('aria-label="Hide sidebar"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("renders the zd-desktop-sidebar-toggle class in static HTML", () => {
    const html = render(<DesktopSidebarToggle />);
    expect(html).toContain("zd-desktop-sidebar-toggle");
  });

  it("renders the transition-persist data attribute", () => {
    const html = render(<DesktopSidebarToggle />);
    expect(html).toContain('data-zfb-transition-persist="desktop-sidebar-toggle"');
  });
});

describe("DesktopSidebarToggle — displayName pin", () => {
  it("has displayName set to DesktopSidebarToggle", () => {
    expect(DesktopSidebarToggle.displayName).toBe("DesktopSidebarToggle");
  });
});

describe("DesktopSidebarToggle — call-site Island marker", () => {
  it("emits data-zfb-island=DesktopSidebarToggle in SSG output", () => {
    const html = render(
      Island({
        when: "load",
        children: <DesktopSidebarToggle />,
      }) as ReturnType<typeof Island>,
    );
    expect(html).toContain('data-zfb-island="DesktopSidebarToggle"');
  });
});
