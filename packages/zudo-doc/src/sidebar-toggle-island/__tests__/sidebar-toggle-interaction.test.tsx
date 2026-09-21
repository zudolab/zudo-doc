/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Real-DOM behavioral tests for the mobile drawer's Escape-to-close handling
// (zudolab/zudo-doc#4366).
//
// Follows the theme-pack-switcher-interaction.test.tsx precedent: `happy-dom`
// via the pragma above, `render` from "preact", `act` from
// "preact/test-utils". `act()` is load-bearing here — the `useEffect` that
// registers the `document` keydown listener only flushes inside `act`,
// otherwise the dispatched "Escape" below would hit no listener at all.

import { afterEach, describe, expect, it } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import { SidebarToggle, type SidebarToggleProps } from "../index.js";
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
];

const PROPS: SidebarToggleProps = { nodes: NODES };

let mounted: HTMLDivElement | null = null;

function mount(props: SidebarToggleProps): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    render(<SidebarToggle {...props} />, container);
  });
  mounted = container;
  return container;
}

function pressEscape(): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
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

describe("SidebarToggle — Escape-to-close", () => {
  it("closes the open drawer and restores focus to the hamburger button", () => {
    const container = mount(PROPS);
    const hamburger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open sidebar"]',
    );
    expect(hamburger).not.toBeNull();

    act(() => {
      hamburger!.click();
    });
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Close sidebar"]'),
    ).not.toBeNull();

    pressEscape();

    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Open sidebar"]'),
    ).not.toBeNull();
    expect(document.activeElement).toBe(
      container.querySelector<HTMLButtonElement>('button[aria-label="Open sidebar"]'),
    );
  });

  it("does not register the listener while closed — a post-close Escape is a no-op", () => {
    const container = mount(PROPS);
    const hamburger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open sidebar"]',
    );

    // Never opened: Escape must not throw or otherwise misbehave, and the
    // drawer stays closed.
    pressEscape();
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Open sidebar"]'),
    ).not.toBeNull();

    // Open then close via Escape, then focus something else and press
    // Escape again. If the teardown didn't run, this second Escape would
    // re-invoke the handler and steal focus back to the hamburger.
    act(() => {
      hamburger!.click();
    });
    pressEscape();

    const decoy = document.createElement("input");
    document.body.appendChild(decoy);
    decoy.focus();
    expect(document.activeElement).toBe(decoy);

    pressEscape();

    expect(document.activeElement).toBe(decoy);
    decoy.remove();
  });
});

// zudolab/zudo-doc#4369: while open, the toggle renders the X and IS the close
// control, so it must be lifted out from under `z-modal-backdrop` (50). The
// elevation has to be conditional on `open` — SSR renders `open=false`, so a
// class present in the closed state would move this directory's A2 no-stub
// parity hashes and break hydration byte-stability.
describe("SidebarToggle — toggle elevation above the backdrop", () => {
  const toggle = (container: HTMLDivElement) =>
    container.querySelector<HTMLButtonElement>("button[aria-expanded]")!;

  it("adds `relative z-modal` only while the drawer is open", () => {
    const container = mount(PROPS);
    const button = toggle(container);

    const closedClasses = button.className;
    expect(closedClasses).not.toContain("z-modal");
    expect(closedClasses.split(/\s+/)).not.toContain("relative");

    act(() => {
      button.click();
    });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.className.split(/\s+/)).toContain("relative");
    expect(button.className.split(/\s+/)).toContain("z-modal");

    // Closing must restore the closed-state class list exactly — the elevation
    // is transient, not a one-way upgrade.
    pressEscape();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.className).toBe(closedClasses);
  });
});
