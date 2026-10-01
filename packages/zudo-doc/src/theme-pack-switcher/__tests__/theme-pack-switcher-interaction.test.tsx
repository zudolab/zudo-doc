/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushAll, renderIsland } from "../../__tests__/helpers/zudo-react.js";
import { ThemePackSwitcher, type ThemePackSwitcherProps } from "../index.js";
import {
  THEME_PACK_ATTR, THEME_PACK_CHANGED_EVENT, THEME_PACK_RUNTIME_GLOBAL,
  THEME_PACK_STORAGE_KEY,
} from "../theme-pack-sync.js";

const ORDER: ThemePackSwitcherProps["order"] = [
  { slug: "default", name: "Default", mode: "light", description: "The stock look." },
  { slug: "foundry", name: "Foundry", mode: "dark", description: "Industrial dark pack." },
];
const props: ThemePackSwitcherProps = { active: "foundry", order: ORDER, base: "/", pendingUntilHydrated: false };
const disposers: Array<() => void> = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute(THEME_PACK_ATTR);
  document.documentElement.removeAttribute("data-theme");
  localStorage.removeItem(THEME_PACK_STORAGE_KEY);
  delete (window as unknown as Record<string, unknown>)[THEME_PACK_RUNTIME_GLOBAL];
  document.body.replaceChildren();
});

async function view(next: ThemePackSwitcherProps = props) {
  const result = await renderIsland(ThemePackSwitcher, next, { identity: { component: "ThemePackSwitcher", build: "test" } });
  disposers.push(result.dispose);
  expect(result.diagnostics).toEqual([]);
  return result;
}
async function openDialog(root: HTMLElement) {
  const launcher = root.querySelector<HTMLButtonElement>("[data-switcher-launcher]")!;
  launcher.click(); await flushAll();
  expect(root.querySelector("[data-switcher-card]")).not.toBeNull();
  root.querySelector<HTMLButtonElement>('[aria-label="Browse all theme packs"]')!.click();
  await flushAll();
  const dialog = root.querySelector<HTMLDialogElement>("dialog")!;
  expect(dialog.open).toBe(true);
  expect(root.querySelector("[data-switcher-card]")).toBeNull();
  return { dialog, launcher };
}

const META = {
  schemaVersion: 1, slug: "default", name: "Default", description: "The stock look.", mode: "light", version: "1",
  fonts: { sans: "System", mono: "System", loaded: [] },
  preview: { light: { bg: "#fff", fg: "#111", accent: "#06f", syntax: { keyword: "#a00", string: "#0a0", comment: "#666", callable: "#00a" } },
    dark: { bg: "#111", fg: "#fff", accent: "#09f", syntax: { keyword: "#f00", string: "#0f0", comment: "#aaa", callable: "#00f" } } },
};

describe("ThemePackSwitcher and ThemePackDialog", () => {
  it("keeps the launcher guarded before hydration, then enables it on activation", async () => {
    const result = await renderIsland(ThemePackSwitcher, { ...props, pendingUntilHydrated: true }, {
      identity: { component: "ThemePackSwitcher", build: "test" },
      beforeActivate: (root) => {
        const launcher = root.querySelector<HTMLButtonElement>("[data-switcher-launcher]")!;
        expect(launcher.getAttribute("data-zd-pending")).toBe("");
        expect(launcher.getAttribute("aria-disabled")).toBe("true");
        launcher.click();
        expect(root.querySelector("[data-switcher-card]")).toBeNull();
      },
    });
    disposers.push(result.dispose);
    expect(result.diagnostics).toEqual([]);
    const launcher = result.root.querySelector<HTMLButtonElement>("[data-switcher-launcher]")!;
    expect(launcher.hasAttribute("data-zd-pending")).toBe(false);
    launcher.click(); await flushAll();
    expect(result.root.querySelector("[data-switcher-card]")).not.toBeNull();
  });

  it("opens, loads keyed cards, applies default, follows external updates, and restores focus on close", async () => {
    document.documentElement.setAttribute(THEME_PACK_ATTR, "foundry");
    (window as unknown as Record<string, unknown>)[THEME_PACK_RUNTIME_GLOBAL] = { base: "/", packs: { default: "1", foundry: "1" }, configured: "foundry" };
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ schemaVersion: 1, packs: [META] }) }));
    vi.stubGlobal("fetch", fetchMock);
    const { root } = await view();
    const { dialog, launcher } = await openDialog(root);
    await vi.waitFor(() => expect(dialog.querySelectorAll('button[aria-label^="Apply "]')).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(dialog.querySelector('[aria-hidden="true"][style*="background-color"]')?.getAttribute("style")).toContain("#fff");
    document.documentElement.setAttribute("data-theme", "dark");
    window.dispatchEvent(new Event("color-scheme-changed"));
    await flushAll();
    expect(dialog.querySelector('[aria-hidden="true"][style*="background-color"]')?.getAttribute("style")).toContain("#111");
    dialog.querySelector<HTMLButtonElement>('button[aria-label^="Apply "]')!.click();
    await flushAll();
    expect(document.documentElement.getAttribute(THEME_PACK_ATTR)).toBe("default");
    expect(dialog.querySelector('button[aria-pressed="true"]')).not.toBeNull();
    document.documentElement.setAttribute(THEME_PACK_ATTR, "foundry");
    window.dispatchEvent(new CustomEvent(THEME_PACK_CHANGED_EVENT, { detail: { pack: "foundry", previous: "default" } }));
    await flushAll();
    expect(dialog.querySelector('button[aria-pressed="false"]')).not.toBeNull();
    dialog.close(); await flushAll();
    expect(document.activeElement).toBe(launcher);
  });

  it("aborts an in-flight registry request on close and retries on reopen", async () => {
    let aborted = 0;
    const fetchMock = vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => { aborted++; reject(new DOMException("aborted", "AbortError")); });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { root } = await view();
    const { dialog, launcher } = await openDialog(root);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    dialog.close(); await flushAll();
    expect(aborted).toBe(1);
    expect(document.activeElement).toBe(launcher);
    await openDialog(root);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the flyout width and wraps a long description", async () => {
    document.documentElement.setAttribute(THEME_PACK_ATTR, "foundry");
    const { root } = await view({ ...props, order: [{ ...ORDER[1]!, description: "unbroken".repeat(30) }] });
    root.querySelector<HTMLButtonElement>("[data-switcher-launcher]")!.click();
    await flushAll();
    const card = root.querySelector<HTMLElement>("[data-switcher-card]")!;
    expect(card.className).toContain("w-[360px]");
    expect(card.className).toContain("max-w-[calc(100vw_-_2rem)]");
    expect(card.querySelector("p.text-caption.break-words")?.textContent).toContain("unbroken");
  });

  it("shows a parser error and retries after a malformed registry response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ schemaVersion: 1, packs: [{ slug: "broken" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ schemaVersion: 1, packs: [META] }) });
    vi.stubGlobal("fetch", fetchMock);
    const { root } = await view();
    const { dialog } = await openDialog(root);
    await vi.waitFor(() => expect(dialog.textContent).toContain("Could not load theme previews."));
    const retry = Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent === "Retry")!;
    retry.click(); await flushAll();
    await vi.waitFor(() => expect(dialog.querySelectorAll('button[aria-label^="Apply "]')).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not fetch when only the default pack exists and disposes its listeners", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const { root, dispose } = await view({ ...props, active: "default", order: [ORDER[0]!] });
    await openDialog(root);
    expect(root.textContent).toContain("No other theme packs are configured");
    expect(fetchMock).not.toHaveBeenCalled();
    dispose(); disposers.pop();
    window.dispatchEvent(new CustomEvent(THEME_PACK_CHANGED_EVENT));
  });
});
