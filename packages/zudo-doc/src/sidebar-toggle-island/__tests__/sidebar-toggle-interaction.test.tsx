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

import { afterEach, describe, expect, it, vi } from "vitest";
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

function pressEscape(init: KeyboardEventInit = {}): void {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, ...init }),
    );
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

  // The drawer hosts a text filter input ("Filter navigation", rendered by
  // SidebarTree). On the JA locale, Escape is how a user cancels an in-flight
  // IME conversion there — that keydown carries `isComposing: true` and must
  // not also dismiss the drawer.
  it("ignores an Escape that ends an IME composition", () => {
    const container = mount(PROPS);
    const hamburger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open sidebar"]',
    );

    act(() => {
      hamburger!.click();
    });

    pressEscape({ isComposing: true });

    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Close sidebar"]'),
    ).not.toBeNull();
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

// zudolab/zudo-doc#4393 / zudolab/zudo-doc#4403: with the drawer open and its
// Appearance menu open, Escape must close only the menu (layer 1) on the
// first press, and only an unconsumed Escape reaches the drawer (layer 2) on
// a second press. The menu is portaled to `document.body` (theme-toggle's
// `createPortal`), so this exercises the real bubble path from the portaled
// menu / its in-drawer trigger up through `document`, not a stubbed handler.
describe("SidebarToggle + ThemeToggle — layered Escape ownership", () => {
  function mountWithTheme(): HTMLDivElement {
    return mount({ ...PROPS, themeDefaultMode: "dark" });
  }
  function appearanceTrigger(container: HTMLElement) {
    return container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
  }
  function appearanceMenu(container: HTMLElement) {
    const id = appearanceTrigger(container).getAttribute("aria-controls");
    return id ? document.getElementById(id) : null;
  }
  function appearanceMenuItems(container: HTMLElement) {
    return [
      ...(appearanceMenu(container)?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]',
      ) ?? []),
    ];
  }
  function openDrawerAndMenu(container: HTMLElement): void {
    const hamburger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open sidebar"]',
    )!;
    act(() => hamburger.click());
    act(() => appearanceTrigger(container).click());
  }
  function pressEscapeOn(target: EventTarget, init: KeyboardEventInit = {}): void {
    act(() => {
      target.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, ...init }),
      );
    });
  }

  it("first Escape from a menu item closes only the menu, keeps the drawer open, and restores focus to the trigger", async () => {
    const container = mountWithTheme();
    openDrawerAndMenu(container);
    const trigger = appearanceTrigger(container);
    const items = appearanceMenuItems(container);
    expect(items.length).toBeGreaterThan(0);

    pressEscapeOn(items[0]!);

    expect(appearanceMenu(container)).toBeNull();
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Close sidebar"]'),
    ).not.toBeNull();
    expect(container.querySelector("aside")!.hasAttribute("inert")).toBe(false);
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("second, unconsumed Escape closes the drawer and focuses the hamburger", async () => {
    const container = mountWithTheme();
    openDrawerAndMenu(container);
    const trigger = appearanceTrigger(container);
    pressEscapeOn(appearanceMenuItems(container)[0]!);
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));

    pressEscapeOn(trigger);

    const hamburger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open sidebar"]',
    );
    expect(hamburger).not.toBeNull();
    expect(document.activeElement).toBe(hamburger);
  });

  it("Escape on the trigger button with the menu open behaves like Escape from a menu item", async () => {
    const container = mountWithTheme();
    openDrawerAndMenu(container);
    const trigger = appearanceTrigger(container);
    trigger.focus();

    pressEscapeOn(trigger);

    expect(appearanceMenu(container)).toBeNull();
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Close sidebar"]'),
    ).not.toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("an Escape that ends an IME composition closes neither layer while both are open", () => {
    const container = mountWithTheme();
    openDrawerAndMenu(container);

    // Dispatched at `document` (not through the menu or its trigger), matching
    // the sibling composition-guard test above: this is the drawer's own
    // document-level listener seeing a composing Escape meant for an
    // unrelated input (e.g. the drawer's filter field), while the Appearance
    // menu happens to be open at the same time.
    pressEscapeOn(document, { isComposing: true });

    expect(appearanceMenu(container)).not.toBeNull();
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Close sidebar"]'),
    ).not.toBeNull();
  });
});
