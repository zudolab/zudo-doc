/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { render as renderToString } from "preact-render-to-string";
import { act } from "preact/test-utils";
import { ThemeToggle, type ThemeToggleProps } from "../index.js";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/index.js";
import { applyThemePreference, COLOR_SCHEME_RUNTIME_GLOBAL } from "../color-scheme-sync.js";

const mounted: HTMLDivElement[] = [];
function mount(props: ThemeToggleProps = {}, beforeEffects?: (button: HTMLButtonElement) => void) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  act(() => {
    render(<ThemeToggle {...props} />, container);
    beforeEffects?.(container.querySelector("button")!);
  });
  return container;
}
function trigger(container: HTMLElement) { return container.querySelector<HTMLButtonElement>("button")!; }
function menu(container: HTMLElement) { return document.getElementById(trigger(container).getAttribute("aria-controls") ?? "missing-menu"); }
function items(container: HTMLElement) { return [...(menu(container)?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])]; }
function press(target: HTMLElement, key: string) {
  act(() => { target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); });
}
function open(container: HTMLElement) { act(() => trigger(container).click()); }

afterEach(() => {
  for (const container of mounted.splice(0)) { act(() => render(null, container)); container.remove(); }
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.colorScheme = "";
  localStorage.clear();
  delete (window as unknown as Record<string, unknown>)[COLOR_SCHEME_RUNTIME_GLOBAL];
  vi.unstubAllGlobals();
});

describe("ThemeToggle appearance menu", () => {
  it("keeps SSR pending and inert until hydration, then opens the selected preference", () => {
    const container = mount({}, (button) => {
      const ssr = document.createElement("div");
      ssr.innerHTML = renderToString(<ThemeToggle />);
      expect(button.outerHTML).toBe(ssr.querySelector("button")!.outerHTML);
      expect(button.getAttribute("aria-disabled")).toBe("true");
      button.click();
      press(button, "Enter");
      expect(button.parentElement?.querySelector('[role="menu"]')).toBeNull();
    });
    expect(trigger(container).getAttribute("aria-disabled")).toBeNull();
    expect(trigger(container).getAttribute("aria-label")).toBe("Appearance: System");
    open(container);
    expect(items(container).map((item) => item.textContent?.trim())).toEqual(["Light", "Dark", "System✓"]);
    expect(items(container)[2]?.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(items(container)[2]);
  });

  it("supports arrow, Home/End, selection, Escape, Tab, outside click, and unique ids", async () => {
    const first = mount();
    const second = mount();
    open(first);
    open(second);
    expect(trigger(first).getAttribute("aria-controls")).not.toBe(trigger(second).getAttribute("aria-controls"));
    press(items(first)[2]!, "Home");
    expect(document.activeElement).toBe(items(first)[0]);
    press(items(first)[0]!, "ArrowUp");
    expect(document.activeElement).toBe(items(first)[2]);
    press(items(first)[2]!, "ArrowDown");
    expect(document.activeElement).toBe(items(first)[0]);
    press(items(first)[0]!, "End");
    expect(document.activeElement).toBe(items(first)[2]);
    press(items(first)[2]!, "Escape");
    expect(menu(first)).toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger(first)));
    open(first);
    press(items(first)[2]!, "Tab");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(menu(first)).toBeNull();
    open(first);
    act(() => { document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    expect(menu(first)).toBeNull();
    open(first);
    act(() => { document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT)); });
    expect(menu(first)).toBeNull();
    open(first);
    act(() => items(first)[0]!.click());
    expect(localStorage.getItem("zudo-doc-theme")).toBe("light");
    expect(menu(first)).toBeNull();
    expect(trigger(first).getAttribute("aria-label")).toBe("Appearance: Light");
    expect(trigger(second).getAttribute("aria-label")).toBe("Appearance: Light");
    expect(menu(second)).toBeNull();
  });

  it("keeps System selected across OS changes and persists through remount", () => {
    const container = mount();
    act(() => applyThemePreference("dark"));
    open(container);
    act(() => items(container)[2]!.click());
    expect(localStorage.getItem("zudo-doc-theme")).toBe("system");
    expect(trigger(container).getAttribute("aria-label")).toBe("Appearance: System");
    document.documentElement.setAttribute("data-theme", "dark");
    act(() => { window.dispatchEvent(new CustomEvent("color-scheme-changed")); });
    open(container);
    expect(items(container)[2]?.getAttribute("aria-checked")).toBe("true");
    expect(menu(container)?.textContent).toContain("currently Dark");
    act(() => render(null, container));
    act(() => render(<ThemeToggle />, container));
    expect(trigger(container).getAttribute("aria-label")).toBe("Appearance: System");
  });

  it("shows the configured fallback in explicit opt-out mode", () => {
    const container = mount({ defaultMode: "dark", respectPrefersColorScheme: false });
    expect(trigger(container).getAttribute("aria-label")).toBe("Appearance: Dark");
    open(container);
    expect(items(container)[1]?.getAttribute("aria-checked")).toBe("true");
  });

  // zudolab/zudo-doc#4393 / zudolab/zudo-doc#4403: the menu is portaled to
  // `document.body`, so an unstopped Escape would bubble to a document-level
  // listener owned by an ancestor (e.g. the mobile drawer's Escape-to-close
  // handler in sidebar-toggle-island/index.tsx) and close it too. Both the
  // menu's own Escape branch and the trigger button's Escape branch (reached
  // when the trigger itself is focused while the menu is open) must consume
  // the event so a document-level listener never sees it.
  it("stops Escape from reaching a document-level listener, from a menu item and from the trigger", () => {
    const container = mount();
    const onDocumentKeyDown = vi.fn();
    document.addEventListener("keydown", onDocumentKeyDown);

    open(container);
    press(items(container)[0]!, "Escape");
    expect(menu(container)).toBeNull();
    expect(onDocumentKeyDown).not.toHaveBeenCalled();

    open(container);
    press(trigger(container), "Escape");
    expect(menu(container)).toBeNull();
    expect(onDocumentKeyDown).not.toHaveBeenCalled();

    document.removeEventListener("keydown", onDocumentKeyDown);
  });

  it("uses Japanese labels and can activate without a pending state", () => {
    const container = mount({ pendingUntilHydrated: false, labels: {
      appearance: "外観", light: "ライト", dark: "ダーク", system: "システム",
      systemHelper: "デバイスの設定に従います · 現在は{mode}",
    } });
    expect(trigger(container).getAttribute("aria-label")).toBe("外観: システム");
    open(container);
    expect(items(container).map((item) => item.getAttribute("role"))).toEqual(["menuitemradio", "menuitemradio", "menuitemradio"]);
    expect(menu(container)?.textContent).toContain("デバイスの設定に従います");
  });
});
