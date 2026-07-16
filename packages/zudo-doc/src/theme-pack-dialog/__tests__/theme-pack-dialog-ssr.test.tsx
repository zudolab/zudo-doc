/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// SSR-shape tests for ThemePackDialog (#2825).
//
// This dialog never unmounts (it lives inside the persistent ThemePackSwitcher
// island's tree) and lazily fetches its registry data only once the dialog is
// actually opened client-side — so the initial (closed) SSR render must be a
// pure, deterministic function of its serializable props: no fetch, no DOM
// access outside guarded fallbacks, no card content yet (`packs` starts
// `null`). Interactive behavior (Esc/backdrop/✕ close, focus restore, the
// live fetch, applying a pack) is out of scope here — this package's vitest
// config runs in a plain Node environment (no jsdom); those flows are (a)
// covered indirectly via the pure helpers in `dialog-state.test.ts` /
// `theme-pack-card.test.tsx`, and (b) exercised end-to-end by central e2e
// (#2826).

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { ThemePackDialog } from "../index.js";
import type { ThemePackDialogProps } from "../../theme-pack-switcher/index.js";

const PROPS: ThemePackDialogProps = {
  open: false,
  onClose: () => {},
  order: [
    { slug: "default", name: "Default", mode: "light", description: "The stock zudo-doc look." },
    { slug: "foundry", name: "Foundry", mode: "light", description: "Industrial dark pack." },
  ],
  active: "default",
  base: "/",
};

describe("ThemePackDialog — SSR shape", () => {
  const html = render(<ThemePackDialog {...PROPS} />);

  it("renders a native <dialog> labelled 'Preview theme'", () => {
    expect(html).toContain("<dialog");
    expect(html).toContain("Preview theme");
    expect(html).toContain('aria-labelledby="zd-theme-pack-dialog-title"');
  });

  it("uses the semantic modal z-index tiers, never a raw integer", () => {
    expect(html).toContain("z-modal");
    expect(html).toContain("z-modal-backdrop");
    expect(html).not.toMatch(/z-\[?\d/);
  });

  it("scrolls the grid area with overscroll-behavior contained (no scroll-chaining to the page)", () => {
    expect(html).toContain("overscroll-contain");
  });

  it("renders no card content yet (data is fetched lazily on first open, not on mount)", () => {
    expect(html).not.toContain("Aa Heading");
    expect(html).not.toContain("theme-packs/index.json");
  });

  it("renders an accessible loading placeholder sized from the SSR order prop", () => {
    expect(html).toContain("Loading theme previews");
  });

  it("is a deterministic function of its serializable props (hydration-safe)", () => {
    expect(render(<ThemePackDialog {...PROPS} />)).toBe(html);
  });

  it("pins displayName for the island-scanner static-import chain", () => {
    expect(ThemePackDialog.displayName).toBe("ThemePackDialog");
  });
});
