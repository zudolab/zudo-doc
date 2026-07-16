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
});
