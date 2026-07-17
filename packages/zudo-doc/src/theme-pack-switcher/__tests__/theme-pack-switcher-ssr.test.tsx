/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// SSR-shape tests for the ThemePackSwitcher flyout island (#2821).
//
// The island hydrates `when: "load"` WITHOUT an `ssrFallback`, so zfb SSRs
// the component itself and the client's first render must reproduce it
// byte-for-byte (hydration safety). These tests pin that SSR shape: card
// CLOSED (launcher only — no card markup, no dialog markup, no fetch), the
// launcher's popup a11y wiring, and the pinned displayName the island
// scanner keys the marker on.
//
// Interactive behavior (launcher/✕/Escape toggling in a real DOM) is central
// e2e's job (#2826); the state transitions behind it are unit-tested in
// switcher-state.test.ts.

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { ThemePackSwitcher, type ThemePackSwitcherProps } from "../index.js";

const PROPS: ThemePackSwitcherProps = {
  active: "foundry",
  order: [
    { slug: "default", name: "Default", mode: "light", description: "The stock zudo-doc look." },
    { slug: "foundry", name: "Foundry", mode: "dark", description: "Industrial dark pack." },
  ],
  base: "/",
};

describe("ThemePackSwitcher — SSR shape", () => {
  const html = render(<ThemePackSwitcher {...PROPS} />);

  it("renders the launcher button, closed (aria-expanded=false, popup wiring)", () => {
    expect(html).toContain('aria-label="Theme pack switcher"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
  });

  it("renders stable DOM hooks: data-theme-pack-switcher on the root, data-switcher-launcher on the launcher (zudolab/zudo-doc#2873)", () => {
    expect(html).toMatch(/<div[^>]*data-theme-pack-switcher[^>]*>/);
    expect(html).toMatch(
      /<button[^>]*aria-label="Theme pack switcher"[^>]*data-switcher-launcher[^>]*>/,
    );
  });

  it("renders NO card content while closed (the card is toggled client-side)", () => {
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("data-switcher-card");
    expect(html).not.toContain("Foundry");
    expect(html).not.toContain("Industrial dark pack.");
    // Matched by aria-label rather than the raw "Prev"/"Next" substrings:
    // since #2825 filled the ThemePackDialogSlot seam, this SSR output also
    // includes the (always-closed) browse-all dialog's "Preview theme" title
    // — which contains "Prev" as a substring — so a bare text match would
    // false-positive on unrelated dialog markup instead of the flyout's own
    // Prev/Next buttons this test actually cares about.
    expect(html).not.toContain('aria-label="Previous theme pack"');
    expect(html).not.toContain('aria-label="Next theme pack"');
  });

  it("anchors viewport-fixed at the bottom-right on the semantic popover tier", () => {
    // The wrapper must be viewport-fixed (never inside a scroll container)
    // and use the z-index-defaults `popover` tier utility — never a raw int.
    expect(html).toContain("fixed");
    expect(html).toContain("bottom-hsp-lg");
    expect(html).toContain("right-hsp-lg");
    expect(html).toContain("z-popover");
    expect(html).not.toMatch(/z-\[?\d/);
  });

  it("is a deterministic function of its serializable props (hydration-safe)", () => {
    expect(render(<ThemePackSwitcher {...PROPS} />)).toBe(html);
  });

  it("pins displayName for the island-scanner marker (#1446 contract)", () => {
    expect(ThemePackSwitcher.displayName).toBe("ThemePackSwitcher");
  });
});
