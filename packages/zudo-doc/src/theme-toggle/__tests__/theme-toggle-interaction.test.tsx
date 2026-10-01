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
    expect(items(root).map((item) => item.textContent?.trim())).toEqual(["Light", "Dark", "System✓"]);
    expect(document.activeElement).toBe(items(root)[2]);
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
    expect(menu(first)?.textContent).toContain("currently Dark");
  });

  it("uses opt-out defaults and translated labels", async () => {
    const root = await mount({ defaultMode: "dark", respectPrefersColorScheme: false, pendingUntilHydrated: false,
      labels: { appearance: "外観", light: "ライト", dark: "ダーク", system: "システム", systemHelper: "現在は{mode}" } });
    expect(trigger(root).getAttribute("aria-label")).toBe("外観: ダーク");
    await open(root);
    expect(items(root)[1]?.getAttribute("aria-checked")).toBe("true");
    expect(menu(root)?.textContent).toContain("現在はダーク");
  });

  it("repositions on scroll and resize within a narrow viewport", async () => {
    const root = await mount();
    vi.stubGlobal("innerWidth", 200);
    vi.stubGlobal("innerHeight", 400);
    const button = trigger(root);
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({ top: 100, bottom: 140, left: 120, right: 160, width: 40, height: 40 } as DOMRect);
    await open(root);
    expect(menu(root)?.style.width).toBe("184px");
    expect(menu(root)?.style.left).toBe("8px");
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({ top: 200, bottom: 240, left: 120, right: 160, width: 40, height: 40 } as DOMRect);
    window.dispatchEvent(new Event("resize"));
    expect(menu(root)?.style.top).toBe("148px");
    window.dispatchEvent(new Event("scroll"));
    expect(menu(root)?.style.maxHeight).toMatch(/px$/);
  });
});
