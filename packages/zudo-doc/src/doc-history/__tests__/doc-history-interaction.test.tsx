/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DocHistoryData } from "../../island-types/index.js";
import { renderIsland, flushAll } from "../../__tests__/helpers/zudo-react.js";
import { DocHistory } from "../index.js";

const data: DocHistoryData = {
  slug: "guide", filePath: "src/content/docs/guide.mdx",
  entries: [
    { hash: "newhash1", date: "2026-09-03", author: "A", message: "new", content: "new\n" },
    { hash: "midHash2", date: "2026-09-02", author: "B", message: "mid", content: "mid\n" },
    { hash: "oldHash3", date: "2026-09-01", author: "C", message: "old", content: "old\n" },
  ],
};
let dispose: (() => void) | null = null;
afterEach(() => { dispose?.(); dispose = null; document.body.replaceChildren(); vi.unstubAllGlobals(); });

async function mount() {
  const view = await renderIsland(DocHistory, { slug: "guide" }, {
    identity: { component: "DocHistory", build: "test" }, mode: "mount",
  });
  dispose = view.dispose;
  expect(view.diagnostics).toEqual([]);
  return view.root;
}
async function settle() { await flushAll(); await Promise.resolve(); await flushAll(); }

describe("DocHistory interaction", () => {
  it("hydrates the static trigger and dialog without diagnostics", async () => {
    const view = await renderIsland(DocHistory, { slug: "guide" }, {
      identity: { component: "DocHistory", build: "test" },
    });
    dispose = view.dispose;
    expect(view.diagnostics).toEqual([]);
    expect(view.root.querySelector("[data-doc-history-trigger]")).not.toBeNull();
    expect(view.root.querySelector("[data-doc-history-panel]")).not.toBeNull();
  });

  it("opens, loads, shows errors and retries, then renders two comparisons with valid tables", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({ ok: true, json: async () => data });
    vi.stubGlobal("fetch", fetchMock);
    const root = await mount();
    root.querySelector<HTMLButtonElement>("[data-doc-history-trigger]")!.click();
    await settle();
    expect(root.textContent).toContain("Failed to load history (503)");
    root.querySelector<HTMLButtonElement>('[aria-label="Close history panel"]')!.click();
    await settle();
    root.querySelector<HTMLButtonElement>("[data-doc-history-trigger]")!.click();
    await settle();
    expect(root.textContent).toContain("Select two revisions");
    root.querySelector<HTMLButtonElement>("button[aria-label='Select revision oldHash as A']")!.click();
    await settle();
    root.querySelector<HTMLButtonElement>("button[aria-label='Select revision midHash as B']")!.click();
    await settle();
    root.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
      if (button.textContent?.trim() === "Compare") button.click();
    });
    await settle();
    await vi.waitFor(async () => {
      await settle();
      expect(root.querySelector("table tbody > tr")).not.toBeNull();
    });
    expect(root.textContent).toContain("oldHash");
    expect(root.textContent).toContain("midHash");
    const firstTable = root.querySelector("table");
    expect(firstTable?.querySelectorAll("tbody > tr").length).toBeGreaterThan(0);
    expect(firstTable?.querySelector("tbody > :not(tr)")).toBeNull();
    root.querySelector<HTMLButtonElement>("[aria-label='Back to revisions']")!.click();
    await settle();
    root.querySelector<HTMLButtonElement>("button[aria-label='Select revision newhash as B']")!.click();
    await settle();
    root.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
      if (button.textContent?.trim() === "Compare") button.click();
    });
    await settle();
    expect(root.textContent).toContain("newhash");
    expect(root.querySelector("table")).not.toBe(firstTable);
  });

  it("aborts pending fetch on close and disposal and ignores stale results", async () => {
    let resolveFetch!: (value: unknown) => void;
    const fetchMock = vi.fn(() => new Promise(resolve => { resolveFetch = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const root = await mount();
    root.querySelector<HTMLButtonElement>("[data-doc-history-trigger]")!.click();
    await settle();
    expect(root.querySelector(".page-loading-spinner")).not.toBeNull();
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const signal = calls[0]![1].signal as AbortSignal;
    root.querySelector<HTMLButtonElement>('[aria-label="Close history panel"]')!.click();
    await settle();
    expect(signal.aborted).toBe(true);
    resolveFetch({ ok: true, json: async () => data });
    await settle();
    expect(root.textContent).not.toContain("Select two revisions");
    root.querySelector<HTMLButtonElement>("[data-doc-history-trigger]")!.click();
    await settle();
    dispose!(); dispose = null;
    expect((calls[1]![1].signal as AbortSignal).aborted).toBe(true);
  });
});
