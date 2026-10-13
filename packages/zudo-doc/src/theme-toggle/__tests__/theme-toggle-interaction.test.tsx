/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushAll, renderIsland } from "../../__tests__/helpers/zudo-react.js";
import { ThemeToggle, type ThemeToggleProps } from "../index.js";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/index.js";
import { applyThemePreference, COLOR_SCHEME_RUNTIME_GLOBAL } from "../color-scheme-sync.js";

const mounted: Array<() => void> = [];
async function mount(props: ThemeToggleProps = {}) {
  const view = await renderIsland(ThemeToggle, props, { identity: { component: "ThemeToggle", build: "test" } });
  mounted.push(view.dispose);
  expect(view.diagnostics).toEqual([]);
  return view.root;
}
const trigger = (root: HTMLElement) => root.querySelector<HTMLButtonElement>("button")!;
const menu = (root: HTMLElement) => root.querySelector<HTMLElement>('[role="menu"]');
const items = (root: HTMLElement) => [...(menu(root)?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
async function open(root: HTMLElement) { trigger(root).click(); await flushAll(); }
const visibleChildren = (element: Element) => [...element.children].filter((child) => !child.hasAttribute("hidden"));
const systemDescription = (root: HTMLElement) => document.getElementById(items(root)[2]?.getAttribute("aria-describedby") ?? "");

function stubDeviceScheme(initial: "light" | "dark") {
  const listeners = new Set<() => void>();
  const query = {
    matches: initial === "dark",
    media: "(prefers-color-scheme: dark)",
    addEventListener: vi.fn((_type: string, listener: () => void) => { listeners.add(listener); }),
    removeEventListener: vi.fn((_type: string, listener: () => void) => { listeners.delete(listener); }),
  };
  vi.stubGlobal("matchMedia", vi.fn(() => query));
  return {
    query,
    listeners,
    set(mode: "light" | "dark") { query.matches = mode === "dark"; for (const listener of [...listeners]) listener(); },
  };
}

async function press(target: HTMLElement, key: string, isComposing = false) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, isComposing, bubbles: true }));
  await flushAll();
}
afterEach(() => {
  for (const dispose of mounted.splice(0)) dispose();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.colorScheme = "";
  localStorage.clear();
  delete (window as unknown as Record<string, unknown>)[COLOR_SCHEME_RUNTIME_GLOBAL];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ThemeToggle appearance menu", () => {
  it("hydrates pending SSR, opens in place, and positions a manual popover", async () => {
    const root = await mount();
    expect(trigger(root).hasAttribute("data-zd-pending")).toBe(false);
    expect(trigger(root).getAttribute("aria-label")).toBe("Appearance: System");
    await open(root);
    expect(menu(root)?.parentElement).toBe(trigger(root).parentElement);
    expect(menu(root)?.getAttribute("popover")).toBe("manual");
    expect(menu(root)?.style.left).toMatch(/px$/);
    await vi.waitFor(() => expect(document.activeElement).toBe(items(root)[2]));
  });

  it("renders the R1-A compact list: three rows, no visible heading or footer, inline device status", async () => {
    stubDeviceScheme("dark");
    const root = await mount();
    await open(root);
    const list = menu(root)!;
    expect(list.getAttribute("aria-label")).toBe("Appearance");
    // Only the three option rows are visible children; the System description is hidden.
    expect(visibleChildren(list).map((child) => child.getAttribute("role"))).toEqual(["menuitemradio", "menuitemradio", "menuitemradio"]);
    expect(visibleChildren(list).map((child) => child.textContent).join("")).not.toContain("Follows device");
    const [light, dark, system] = items(root);
    // Accessible-name text excludes aria-hidden status/check spans.
    const nameText = (item: HTMLElement) => [...item.querySelectorAll("span:not([aria-hidden])")].map((span) => span.textContent).join("");
    expect([light, dark, system].map((item) => nameText(item!))).toEqual(["Light", "Dark", "System"]);
    expect(system!.querySelector("[data-zd-device-mode]")?.textContent).toBe("Dark");
    expect(system!.querySelector("[data-zd-device-mode]")?.getAttribute("aria-hidden")).toBe("true");
    expect(light!.querySelector("[data-zd-device-mode]")).toBeNull();
    expect(systemDescription(root)?.textContent?.trim()).toBe("Follows device · currently Dark");
    expect(systemDescription(root)?.hasAttribute("hidden")).toBe(true);
    expect(light!.hasAttribute("aria-describedby")).toBe(false);
    // Rows are reached with arrows; Tab / Shift+Tab leave the menu instead of cycling rows.
    expect(items(root).map((item) => item.getAttribute("tabindex"))).toEqual(["-1", "-1", "-1"]);
    // Selected state is a subtle fill + check; focus is a separate focus-visible outline.
    expect(system!.className).toContain("bg-accent/10");
    expect(light!.className).not.toContain("bg-accent/10");
    expect(light!.className).not.toContain("focus-visible:bg-accent");
    expect(system!.className).toContain("focus-visible:outline-accent");
    expect(system!.textContent).toContain("✓");
    expect(light!.textContent).not.toContain("✓");
  });

  it("keeps the device status independent of a manual preference and cleans up its listener", async () => {
    const device = stubDeviceScheme("dark");
    const root = await mount();
    const onPreference = vi.fn();
    const onScheme = vi.fn();
    window.addEventListener("theme-preference-changed", onPreference);
    window.addEventListener("color-scheme-changed", onScheme);
    applyThemePreference("light");
    await flushAll();
    onPreference.mockClear();
    onScheme.mockClear();
    await open(root);
    expect(items(root)[0]?.getAttribute("aria-checked")).toBe("true");
    expect(items(root)[2]!.querySelector("[data-zd-device-mode]")?.textContent).toBe("Dark");
    device.set("light");
    await flushAll();
    expect(items(root)[2]!.querySelector("[data-zd-device-mode]")?.textContent).toBe("Light");
    expect(systemDescription(root)?.textContent).toContain("currently Light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(items(root)[0]?.getAttribute("aria-checked")).toBe("true");
    expect(onPreference).not.toHaveBeenCalled();
    expect(onScheme).not.toHaveBeenCalled();
    window.removeEventListener("theme-preference-changed", onPreference);
    window.removeEventListener("color-scheme-changed", onScheme);
    expect(device.listeners.size).toBe(1);
    mounted.pop()!();
    expect(device.listeners.size).toBe(0);
    const remounted = await mount();
    expect(device.listeners.size).toBe(1);
    device.set("dark");
    await open(remounted);
    expect(items(remounted)[2]!.querySelector("[data-zd-device-mode]")?.textContent).toBe("Dark");
  });

  it("focuses without scrolling the document", async () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const root = await mount();
    await open(root);
    await vi.waitFor(() => expect(document.activeElement).toBe(items(root)[2]));
    await press(items(root)[2]!, "ArrowDown");
    await press(items(root)[0]!, "Escape");
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger(root)));
    expect(focus.mock.calls.length).toBeGreaterThanOrEqual(3);
    for (const call of focus.mock.calls) expect(call[0]).toEqual({ preventScroll: true });
    focus.mockRestore();
  });

  it("opens, closes, and opens again with keyboard focus and Escape ownership", async () => {
    const root = await mount();
    const onDocumentKeyDown = vi.fn();
    document.addEventListener("keydown", onDocumentKeyDown);
    await open(root);
    await press(items(root)[2]!, "Home");
    expect(document.activeElement).toBe(items(root)[0]);
    await press(items(root)[0]!, "ArrowUp");
    expect(document.activeElement).toBe(items(root)[2]);
    await press(items(root)[2]!, "ArrowDown");
    expect(document.activeElement).toBe(items(root)[0]);
    await press(items(root)[0]!, "End");
    expect(document.activeElement).toBe(items(root)[2]);
    await press(items(root)[2]!, "Escape", true);
    expect(menu(root)).not.toBeNull();
    await press(items(root)[2]!, "Escape");
    expect(menu(root)).toBeNull();
    expect(onDocumentKeyDown.mock.calls.filter(([event]) => event.key === "Escape" && !event.isComposing)).toHaveLength(0);
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger(root)));
    await open(root);
    expect(menu(root)).not.toBeNull();
    trigger(root).click();
    await flushAll();
    await open(root);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(document.activeElement).toBe(items(root)[2]);
    await press(trigger(root), "Escape");
    expect(menu(root)).toBeNull();
    document.removeEventListener("keydown", onDocumentKeyDown);
  });

  it("closes for outside pointer, navigation, Tab, and disposal", async () => {
    const root = await mount();
    await open(root);
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await flushAll();
    expect(menu(root)).toBeNull();
    await open(root);
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    await flushAll();
    expect(menu(root)).toBeNull();
    await open(root);
    await press(items(root)[0]!, "Tab");
    await vi.waitFor(() => expect(menu(root)).toBeNull());
    await open(root);
    mounted.pop()!();
    expect(root.isConnected).toBe(false);
  });

  it("updates theme, icon, and the other instance; keeps System across OS changes", async () => {
    const first = await mount();
    const second = await mount();
    await open(first);
    await open(second);
    expect(trigger(first).getAttribute("aria-controls")).not.toBe(trigger(second).getAttribute("aria-controls"));
    items(first)[0]!.click();
    await flushAll();
    expect(localStorage.getItem("zudo-doc-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(trigger(first).getAttribute("aria-label")).toBe("Appearance: Light");
    expect(trigger(second).getAttribute("aria-label")).toBe("Appearance: Light");
    expect(trigger(first).querySelector("svg circle")).not.toBeNull();
    expect(menu(second)).toBeNull();
    await open(first);
    items(first)[2]!.click();
    await flushAll();
    expect(localStorage.getItem("zudo-doc-theme")).toBe("system");
    document.documentElement.setAttribute("data-theme", "dark");
    window.dispatchEvent(new CustomEvent("color-scheme-changed"));
    await flushAll();
    await open(first);
    expect(items(first)[2]?.getAttribute("aria-checked")).toBe("true");
    expect(trigger(first).querySelector("svg path")?.getAttribute("d")).toMatch(/^M2\.5 3\.5H21\.5/);
  });

  it("uses opt-out defaults and translated labels", async () => {
    stubDeviceScheme("dark");
    const root = await mount({ defaultMode: "dark", respectPrefersColorScheme: false, pendingUntilHydrated: false,
      labels: { appearance: "外観", light: "ライト", dark: "ダーク", system: "システム", systemHelper: "現在は{mode}" } });
    expect(trigger(root).getAttribute("aria-label")).toBe("外観: ダーク");
    await open(root);
    expect(items(root)[1]?.getAttribute("aria-checked")).toBe("true");
    expect(menu(root)?.getAttribute("aria-label")).toBe("外観");
    expect(items(root)[2]!.querySelector("[data-zd-device-mode]")?.textContent).toBe("ダーク");
    expect(systemDescription(root)?.textContent?.trim()).toBe("現在はダーク");
  });

  it("sizes naturally at 236px, clamps to a narrow viewport and repositions on scroll and resize", async () => {
    const root = await mount();
    const button = trigger(root);
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({ top: 10, bottom: 50, left: 1000, right: 1040, width: 40, height: 40 } as DOMRect);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(150);
    vi.stubGlobal("innerWidth", 1440);
    vi.stubGlobal("innerHeight", 900);
    await open(root);
    expect(menu(root)?.style.width).toBe("236px");
    expect(menu(root)?.style.left).toBe(`${1040 - 236}px`);
    expect(menu(root)?.style.top).toBe("58px");
    // Natural height: no clamped max-height, no scroll container.
    expect(menu(root)?.style.maxHeight).toBe("none");
    expect(menu(root)?.style.overflow).toBe("visible");
    expect(menu(root)?.className).not.toContain("overflow-y-auto");
    trigger(root).click();
    await flushAll();

    vi.stubGlobal("innerWidth", 200);
    vi.stubGlobal("innerHeight", 400);
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({ top: 100, bottom: 140, left: 120, right: 160, width: 40, height: 40 } as DOMRect);
    await open(root);
    expect(menu(root)?.style.width).toBe("184px");
    expect(menu(root)?.style.left).toBe("8px");
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({ top: 200, bottom: 240, left: 120, right: 160, width: 40, height: 40 } as DOMRect);
    // Too little room below: the menu opens above the trigger.
    window.dispatchEvent(new Event("resize"));
    await flushAll();
    expect(menu(root)?.style.top).toBe(`${200 - 8 - 150}px`);
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({ top: 20, bottom: 60, left: 120, right: 160, width: 40, height: 40 } as DOMRect);
    window.dispatchEvent(new Event("scroll"));
    await flushAll();
    expect(menu(root)?.style.top).toBe("68px");
    expect(menu(root)?.style.maxHeight).toBe("none");
  });

  it("scrolls only as a last resort when the natural menu is taller than the viewport", async () => {
    const root = await mount();
    vi.stubGlobal("innerWidth", 400);
    vi.stubGlobal("innerHeight", 120);
    vi.spyOn(trigger(root), "getBoundingClientRect").mockReturnValue({ top: 10, bottom: 50, left: 300, right: 340, width: 40, height: 40 } as DOMRect);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(150);
    await open(root);
    expect(menu(root)?.style.maxHeight).toBe("104px");
    expect(menu(root)?.style.overflow).toBe("auto");
    expect(menu(root)?.style.top).toBe("8px");
  });
});
