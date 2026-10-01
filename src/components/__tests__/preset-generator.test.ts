/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushAll, renderIsland } from "../../../packages/zudo-doc/src/__tests__/helpers/zudo-react.js";
import PresetGenerator from "../preset-generator.js";

const dispose: Array<() => void> = [];
afterEach(() => { for (const fn of dispose.splice(0)) fn(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function mount(mode: "mount" | "hydrate" = "hydrate", beforeActivate?: (root: HTMLElement) => void) {
  const view = await renderIsland(PresetGenerator, {}, { identity: { component: "PresetGenerator", build: "test" }, mode, beforeActivate });
  dispose.push(view.dispose);
  expect(view.diagnostics).toEqual([]);
  return view.root;
}
function input(root: HTMLElement, label: string) { const node = root.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`); expect(node).not.toBeNull(); return node!; }
function select(root: HTMLElement, label: string) { const node = root.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`); expect(node).not.toBeNull(); return node!; }
async function change(node: HTMLInputElement | HTMLSelectElement, value: string | boolean) {
  if (typeof value === "boolean") node.checked = value; else node.value = value;
  node.dispatchEvent(new Event(node instanceof HTMLSelectElement || node.type === "checkbox" || node.type === "radio" ? "change" : "input", { bubbles: true }));
  await flushAll();
}
async function generate(root: HTMLElement) {
  [...root.querySelectorAll("button")].find((button) => button.textContent?.includes("Generate Preset"))!.click();
  await flushAll();
  const dialog = root.querySelector("dialog")!;
  expect(dialog).not.toBeNull();
  return { dialog, json: () => JSON.parse(dialog.querySelector("code")!.textContent!) as Record<string, unknown> };
}

describe("PresetGenerator island", () => {
  it("SSR hydrates and text, selects, radio groups and booleans update successive output snapshots", async () => {
    const root = await mount();
    await change(input(root, "Project name"), "first-docs");
    await change(select(root, "Default language"), "ja");
    await change(input(root, "Additional language codes"), "en");
    await change(select(root, "Theme pack"), "beacon");
    await change(select(root, "Package manager"), "npm");
    await change(root.querySelector<HTMLInputElement>('input[name="colorSchemeMode"][value="single"]')!, true);
    await change(select(root, "Color scheme"), "Default Light");
    await change(input(root, "Project name"), "second-docs");
    const { dialog, json } = await generate(root);
    expect(json()).toMatchObject({ projectName: "second-docs", defaultLang: "ja", additionalLangs: ["en"], colorSchemeMode: "single", themePack: "beacon" });
    dialog.querySelector<HTMLButtonElement>("button:last-child")!.click();
    await flushAll();
    await change(root.querySelector<HTMLInputElement>('input[name="colorSchemeMode"][value="light-dark"]')!, true);
    await change(root.querySelector<HTMLInputElement>('input[name="defaultMode"][value="light"]')!, true);
    await change(root.querySelector<HTMLInputElement>('input[type="checkbox"]')!, false);
    const second = await generate(root);
    expect(second.json()).toMatchObject({ colorSchemeMode: "light-dark", defaultMode: "light" });
  });

  it("validates input, reconciles dirty feature hydration, reorders and resets header rows", async () => {
    const root = await mount("hydrate", (host) => { const feature = [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((node) => node.parentElement?.textContent?.includes("Full-text search")); if (feature) feature.checked = false; });
    await change(input(root, "Additional language codes"), "ja, ja");
    expect(root.querySelector('[role="alert"]')?.textContent).toContain("Duplicate");
    expect([...root.querySelectorAll("button")].find((button) => button.textContent?.includes("Generate Preset"))?.disabled).toBe(true);
    await change(input(root, "Additional language codes"), "");
    const dirty = await generate(root);
    expect(dirty.json().features).not.toContain("search");
    dirty.dialog.querySelector<HTMLButtonElement>("button:last-child")!.click(); await flushAll();
    const includeSearch = input(root, "Include Search");
    expect(includeSearch.checked).toBe(true);
    await change(includeSearch, false);
    expect(input(root, "Include Search").checked).toBe(false);
    await change(input(root, "Include Search"), true);
    root.querySelector<HTMLButtonElement>('button[aria-label="Move Search up"]')!.click();
    await flushAll();
    expect(root.querySelector<HTMLButtonElement>('button[aria-label="Move Search up"]')?.disabled).toBe(true);
    const first = await generate(root);
    expect((first.json().headerRightItems as Array<unknown>).length).toBe(2);
    first.dialog.querySelector<HTMLButtonElement>("button:last-child")!.click(); await flushAll();
    [...root.querySelectorAll("button")].find((button) => button.textContent?.includes("Reset to default"))!.click(); await flushAll();
    expect(input(root, "Include Theme toggle").checked).toBe(true);
    expect(input(root, "Include Search").checked).toBe(true);
  });

  it("updates every conditional meta control, feature toggle and system preference in JSON", async () => {
    const root = await mount("mount");
    const checkbox = (text: string) => {
      const label = [...root.querySelectorAll("label")].find((node) => node.textContent?.includes(text) && node.querySelector('input[type="checkbox"]'));
      expect(label).toBeDefined();
      return label!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    };
    await change(checkbox("SEO description meta"), false);
    await change(checkbox("Keywords (comma-separated)"), true);
    await change(input(root, "Keywords (comma-separated)"), "docs, test");
    await change(checkbox("OGP image"), true);
    await change(input(root, "OGP image path"), "/new-og.png");
    await change(checkbox("og:site_name"), false);
    await change(checkbox("Twitter card"), true);
    await change(select(root, "Twitter card type"), "summary_large_image");
    await change(input(root, "twitter:site handle"), "@site");
    await change(input(root, "twitter:creator handle"), "@creator");
    await change(checkbox("CJK-friendly"), false);
    await change(checkbox("Respect system preference"), false);
    await change(checkbox("Full-text search"), false);
    const { json } = await generate(root);
    expect(json()).toMatchObject({
      cjkFriendly: false, respectPrefersColorScheme: false,
      metaTags: { description: false, keywords: "docs, test", ogImage: "/new-og.png", ogSiteName: false,
        twitterCard: "summary_large_image", twitterSite: "@site", twitterCreator: "@creator" },
    });
    expect(json().features).not.toContain("search");
  });

  it("ignores clipboard completion after modal disposal", async () => {
    let resolveCopy!: () => void;
    const writeText = vi.fn(() => new Promise<void>((resolve) => { resolveCopy = resolve; }));
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const root = await mount("mount");
    const { dialog } = await generate(root);
    dialog.querySelector<HTMLButtonElement>("button")!.click();
    dialog.querySelector<HTMLButtonElement>("button:last-child")!.click();
    await flushAll();
    resolveCopy();
    await flushAll();
    expect(root.querySelector("dialog")).toBeNull();
  });

  it("copies JSON and CLI, including execCommand fallback, and disposes the modal", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const root = await mount("mount");
    const { dialog } = await generate(root);
    dialog.querySelector<HTMLButtonElement>("button")!.click(); await flushAll();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"projectName"'));
    const cli = dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await change(cli, true);
    expect(dialog.querySelector("code")?.textContent).toContain("--");
    writeText.mockRejectedValueOnce(new Error("denied"));
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });
    dialog.querySelector<HTMLButtonElement>("button")!.click(); await flushAll();
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(dialog.querySelector("textarea")).toBeNull();
    dialog.querySelector<HTMLButtonElement>("button:last-child")!.click(); await flushAll();
    expect(root.querySelector("dialog")).toBeNull();
  });
});
