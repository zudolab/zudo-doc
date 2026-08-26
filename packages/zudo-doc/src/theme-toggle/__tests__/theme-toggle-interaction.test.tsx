/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { afterEach, describe, expect, it } from "vitest";
import { render } from "preact";
import { render as renderToString } from "preact-render-to-string";
import { act } from "preact/test-utils";
import { ThemeToggle, type ThemeToggleProps } from "../index.js";

let mounted: HTMLDivElement | null = null;

function mount(
  props: ThemeToggleProps = {},
  beforeEffects?: (button: HTMLButtonElement) => void,
): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted = container;
  act(() => {
    render(<ThemeToggle {...props} />, container);
    const button = container.querySelector<HTMLButtonElement>("button");
    expect(button).not.toBeNull();
    beforeEffects?.(button!);
  });
  return container;
}

function activateWithKeyboard(button: HTMLButtonElement, key: "Enter" | " "): void {
  button.focus();
  expect(document.activeElement).toBe(button);
  button.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  // happy-dom does not synthesize the button click that a browser performs
  // for keyboard activation, so reproduce that default action explicitly.
  button.click();
  button.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
}

afterEach(() => {
  if (mounted) {
    act(() => render(null, mounted!));
    mounted.remove();
    mounted = null;
  }
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.colorScheme = "";
  localStorage.clear();
});

describe("ThemeToggle — hydration pending interaction", () => {
  it("guards click, focused Enter, and focused Space before the first effect, then enables all three", () => {
    const container = mount({}, (button) => {
      const ssr = document.createElement("div");
      ssr.innerHTML = renderToString(<ThemeToggle />);
      expect(button.outerHTML).toBe(ssr.querySelector("button")!.outerHTML);
      expect(button.tabIndex).toBe(0);
      button.focus();
      expect(document.activeElement).toBe(button);
      expect(button.getAttribute("data-zd-pending")).toBe("");
      expect(button.getAttribute("aria-disabled")).toBe("true");

      button.click();
      activateWithKeyboard(button, "Enter");
      activateWithKeyboard(button, " ");
      expect(button.getAttribute("aria-label")).toBe("Switch to light mode");
      expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    });

    const button = container.querySelector<HTMLButtonElement>("button")!;
    expect(button.hasAttribute("data-zd-pending")).toBe(false);
    expect(button.hasAttribute("aria-disabled")).toBe(false);

    act(() => button.click());
    expect(button.getAttribute("aria-label")).toBe("Switch to dark mode");
    act(() => activateWithKeyboard(button, "Enter"));
    expect(button.getAttribute("aria-label")).toBe("Switch to light mode");
    act(() => activateWithKeyboard(button, " "));
    expect(button.getAttribute("aria-label")).toBe("Switch to dark mode");
  });

  it("activates immediately when pendingUntilHydrated is false", () => {
    const container = mount({ pendingUntilHydrated: false }, (button) => {
      expect(button.hasAttribute("data-zd-pending")).toBe(false);
      expect(button.hasAttribute("aria-disabled")).toBe(false);
      button.click();
    });

    expect(container.querySelector("button")!.getAttribute("aria-label")).toBe(
      "Switch to dark mode",
    );
  });

  it("re-enters the guarded pending state on a fresh remount", () => {
    const container = mount();
    const firstButton = container.querySelector<HTMLButtonElement>("button")!;
    expect(firstButton.hasAttribute("data-zd-pending")).toBe(false);

    act(() => render(null, container));
    act(() => {
      render(<ThemeToggle />, container);
      const remountedButton = container.querySelector<HTMLButtonElement>("button")!;
      expect(remountedButton.getAttribute("data-zd-pending")).toBe("");
      expect(remountedButton.getAttribute("aria-disabled")).toBe("true");
      remountedButton.click();
      expect(remountedButton.getAttribute("aria-label")).toBe("Switch to light mode");
      expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    });

    const remountedButton = container.querySelector<HTMLButtonElement>("button")!;
    expect(remountedButton.hasAttribute("data-zd-pending")).toBe(false);
    expect(remountedButton.hasAttribute("aria-disabled")).toBe(false);
    act(() => remountedButton.click());
    expect(remountedButton.getAttribute("aria-label")).toBe("Switch to dark mode");
  });
});
