/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Real-DOM interaction tests for the ThemePackSwitcher stable DOM hooks
// (zudolab/zudo-doc#2873 acceptance criteria):
//
//   - opening the flyout card must expose `data-switcher-card` (the card is
//     NOT rendered while closed, so the SSR-closed snapshot in
//     theme-pack-switcher-ssr.test.tsx cannot see it — this needs a real
//     mount + click).
//   - closing the browse-all dialog (rendered inside this same island's tree
//     via the ThemePackDialogSlot seam) must restore focus to the launcher,
//     proving the `LAUNCHER_SELECTOR` retarget to `[data-switcher-launcher]`
//     (theme-pack-dialog/index.tsx) resolves the right element.
//
// This is the one spot in the package that needs a real DOM (`happy-dom`,
// declared per-file via the `@vitest-environment` pragma above) — every
// other test in this package runs in vitest's default plain-Node
// environment. `order` here carries only the "default" pack so
// `hasBrowsablePacks` is false (theme-pack-dialog/index.tsx) and the dialog's
// lazy registry fetch never fires — keeping this a pure DOM-interaction test
// with no network mocking required.

import { afterEach, describe, expect, it } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import { ThemePackSwitcher, type ThemePackSwitcherProps } from "../index.js";
import { THEME_PACK_ATTR } from "../theme-pack-sync.js";

const PROPS: ThemePackSwitcherProps = {
  active: "default",
  order: [
    { slug: "default", name: "Default", mode: "light", description: "The stock zudo-doc look." },
  ],
  base: "/",
};

// The dialog's focus-restore reads `document.querySelector(LAUNCHER_SELECTOR)`
// against the WHOLE document (theme-pack-dialog/index.tsx), not scoped to a
// container — so a leftover mounted switcher from a prior test would shadow
// the current test's own launcher. Track + unmount/remove after every test.
let mounted: HTMLDivElement | null = null;

function mount(props: ThemePackSwitcherProps): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    render(<ThemePackSwitcher {...props} />, container);
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
  // `connectActivePackSync` reads this attribute on mount (real-DOM sync,
  // ADR Decision 7) — restore the absent-attribute default so a later test
  // that relies on the "default" fallback isn't shadowed by a leftover value.
  document.documentElement.removeAttribute(THEME_PACK_ATTR);
});

describe("ThemePackSwitcher — real-DOM interaction", () => {
  it("clicking the launcher opens the card and exposes data-switcher-card", () => {
    const container = mount(PROPS);

    expect(container.querySelector("[data-switcher-card]")).toBeNull();

    const launcher = container.querySelector<HTMLButtonElement>("[data-switcher-launcher]");
    expect(launcher).not.toBeNull();

    act(() => {
      launcher!.click();
    });

    const card = container.querySelector("[data-switcher-card]");
    expect(card).not.toBeNull();
    expect(card).toHaveProperty("tagName", "DIV");
  });

  it("closing the browse-all dialog restores focus to [data-switcher-launcher]", () => {
    const container = mount(PROPS);

    const launcher = container.querySelector<HTMLButtonElement>("[data-switcher-launcher]");
    expect(launcher).not.toBeNull();

    // Open the flyout card, then the browse-all dialog (mirrors openDialog()
    // in theme-pack-switcher/index.tsx: opening the dialog closes the card).
    act(() => {
      launcher!.click();
    });
    const gridButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Browse all theme packs"]',
    );
    expect(gridButton).not.toBeNull();
    act(() => {
      gridButton!.click();
    });

    const dialog = container.querySelector<HTMLDialogElement>("dialog");
    expect(dialog).not.toBeNull();
    expect(dialog!.open).toBe(true);
    // The flyout card is unmounted once the dialog takes over.
    expect(container.querySelector("[data-switcher-card]")).toBeNull();

    // Native close (Esc key or dialog.close()) — useModalDialog listens for
    // the dialog's own "close" event to restore focus.
    act(() => {
      dialog!.close();
    });

    expect(document.activeElement).toBe(launcher);
  });

  // Cheap local proxy for the #3116 Screenshot Requirement Contract (the
  // heavy browser-level pass is a separate Wave-2 sub-issue): with a
  // long-description pack active, the open card must be the fixed 360px
  // arbitrary-value width (never the inert `w-72`) and the description
  // must carry `break-words` so an unbroken long line can't stretch the
  // card to the full viewport (the Tidepool scenario from issue #3114).
  it("open card is fixed-width w-[360px] (never w-72) and the description wraps", () => {
    const longDescription =
      "A very long theme-pack description that must wrap across multiple lines instead of stretching the card to the full viewport width, mirroring the Tidepool pack scenario from issue #3114.";
    // connectActivePackSync resolves the active slug from the real DOM on
    // mount (ADR Decision 7), not from the `active` prop alone — set it here
    // so `resolveActiveEntry` matches this test's custom pack instead of
    // falling back to "default" (afterEach clears this for other tests).
    document.documentElement.setAttribute(THEME_PACK_ATTR, "long-desc-pack");
    const container = mount({
      active: "long-desc-pack",
      order: [
        {
          slug: "long-desc-pack",
          name: "Long Desc Pack",
          mode: "light",
          description: longDescription,
        },
      ],
      base: "/",
    });

    const launcher = container.querySelector<HTMLButtonElement>("[data-switcher-launcher]");
    act(() => {
      launcher!.click();
    });

    const card = container.querySelector<HTMLDivElement>("[data-switcher-card]");
    expect(card).not.toBeNull();
    expect(card!.className).toContain("w-[360px]");
    expect(card!.className).not.toMatch(/(?:^|\s)w-72(?:\s|$)/);
    // The viewport-safety cap from #2825 is untouched by this fix.
    expect(card!.className).toContain("max-w-[calc(100vw-2rem)]");

    const description = Array.from(card!.querySelectorAll("p")).find(
      (p) => p.textContent === longDescription,
    );
    expect(description).toBeDefined();
    expect(description!.className).toContain("break-words");

    // The card stays anchored bottom-right above the launcher — the fixed
    // positioning lives on the switcher's root wrapper, unaffected by this
    // fix; confirm it survived untouched.
    const root = container.querySelector("[data-theme-pack-switcher]");
    expect(root!.className).toContain("fixed");
    expect(root!.className).toContain("right-hsp-lg");
    expect(root!.className).toContain("bottom-hsp-lg");
  });
});
