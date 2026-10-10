/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { h } from "@takazudo/zfb/zudo-react";
import { flushAll, renderIsland, renderSsr } from "../../__tests__/helpers/zudo-react.js";
import { getActiveHeadingId } from "../use-active-heading.js";
import { Toc } from "../toc.js";
import type { HeadingItem } from "../types.js";

const HEADINGS: HeadingItem[] = [
  { depth: 2, slug: "a", text: "A" },
  { depth: 3, slug: "b", text: "B" },
  { depth: 2, slug: "c", text: "C" },
];

const mounted: Array<() => void> = [];
let originalInnerHeight: PropertyDescriptor | undefined;
let capturedInnerHeight = false;

afterEach(() => {
  for (const dispose of mounted.splice(0)) dispose();
  document.body.replaceChildren();
  if (capturedInnerHeight) {
    if (originalInnerHeight) {
      Object.defineProperty(window, "innerHeight", originalInnerHeight);
    } else {
      Reflect.deleteProperty(window, "innerHeight");
    }
    originalInnerHeight = undefined;
    capturedInnerHeight = false;
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function addHeadingTargets(initialTops: Record<string, number>) {
  if (!capturedInnerHeight) {
    originalInnerHeight = Object.getOwnPropertyDescriptor(window, "innerHeight");
    capturedInnerHeight = true;
  }
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });

  const tops = new Map(Object.entries(initialTops));
  for (const id of Object.keys(initialTops)) {
    const element = document.createElement("h2");
    element.id = id;
    vi.spyOn(element, "getBoundingClientRect").mockImplementation(
      () => ({ top: tops.get(id) ?? 0 }) as DOMRect,
    );
    document.body.append(element);
  }
  return (id: string, top: number) => tops.set(id, top);
}

function activeLink(root: HTMLElement): HTMLAnchorElement | null {
  return root.querySelector<HTMLAnchorElement>('a[aria-current="true"]');
}

async function mountToc() {
  const view = await renderIsland(Toc, { headings: HEADINGS }, {
    identity: { component: "Toc", build: "use-active-heading-test" },
  });
  mounted.push(view.dispose);
  expect(view.diagnostics).toEqual([]);
  return view;
}

/**
 * Build a stub HTMLElement-ish object with a fixed `top` value. The
 * scroll-spy code only reads `getBoundingClientRect().top`, so a tiny
 * stand-in is enough — no jsdom required.
 */
function makeEl(top: number): HTMLElement {
  return {
    getBoundingClientRect: () => ({ top }) as DOMRect,
  } as HTMLElement;
}

function makeMap(entries: Array<[string, number]>): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  for (const [id, top] of entries) map.set(id, makeEl(top));
  return map;
}

describe("getActiveHeadingId", () => {
  const VIEWPORT = 800;

  it("returns null for an empty heading list", () => {
    expect(getActiveHeadingId([], new Map(), VIEWPORT)).toBeNull();
  });

  it("returns the last heading when every heading has scrolled above the threshold", () => {
    const ids = ["a", "b", "c"];
    const map = makeMap([
      ["a", -500],
      ["b", -300],
      ["c", -100],
    ]);
    expect(getActiveHeadingId(ids, map, VIEWPORT)).toBe("c");
  });

  it("activates the first heading when it is the first visible AND above the viewport midline", () => {
    const ids = ["a", "b", "c"];
    // a is below SCROLL_MARGIN_TOP (80) and above viewport/2 (400)
    const map = makeMap([
      ["a", 100],
      ["b", 500],
      ["c", 900],
    ]);
    expect(getActiveHeadingId(ids, map, VIEWPORT)).toBe("a");
  });

  it("returns null when only the first heading is visible but it sits below the viewport midline", () => {
    const ids = ["a", "b"];
    const map = makeMap([
      ["a", 500], // visible (>=80) but below 400 midline
      ["b", 1200],
    ]);
    expect(getActiveHeadingId(ids, map, VIEWPORT)).toBeNull();
  });

  it("activates the predecessor of the first visible heading when the first visible sits below the midline", () => {
    const ids = ["a", "b", "c"];
    // a scrolled past, b is first visible but below midline → activate a
    const map = makeMap([
      ["a", -50],
      ["b", 600],
      ["c", 1200],
    ]);
    expect(getActiveHeadingId(ids, map, VIEWPORT)).toBe("a");
  });

  it("activates the first visible heading when its top crosses the midline", () => {
    const ids = ["a", "b", "c"];
    // a scrolled past, b is first visible AND above the midline → activate b
    const map = makeMap([
      ["a", -50],
      ["b", 200],
      ["c", 900],
    ]);
    expect(getActiveHeadingId(ids, map, VIEWPORT)).toBe("b");
  });

  it("skips headings whose elements are missing from the map", () => {
    const ids = ["a", "missing", "c"];
    const map = makeMap([
      ["a", -50],
      ["c", 200], // first found visible — above midline → activate c
    ]);
    expect(getActiveHeadingId(ids, map, VIEWPORT)).toBe("c");
  });

  it("uses the threshold inclusively — a heading with top exactly at SCROLL_MARGIN_TOP counts as visible", () => {
    const ids = ["a"];
    // top === 80 hits the >= comparison; with viewport 800, midline 400 ⇒ active
    const map = makeMap([["a", 80]]);
    expect(getActiveHeadingId(ids, map, VIEWPORT)).toBe("a");
  });
});

describe("Toc scroll spy", () => {
  it("keeps SSR neutral, then derives the active link from the current browser position", async () => {
    addHeadingTargets({ a: 100, b: 500, c: 900 });
    const html = renderSsr(h(Toc, { headings: HEADINGS }));
    expect(html).not.toContain("aria-current=");

    const view = await mountToc();
    expect(activeLink(view.root)?.getAttribute("href")).toBe("#a");
    expect(activeLink(view.root)?.className).toContain("bg-fg");
    expect(view.root.querySelector('a[href="#b"]')?.className).toContain("text-muted");
  });

  it("debounces scroll and resize, activates clicked links immediately, and reconciles at scrollend", async () => {
    vi.useFakeTimers();
    const setTop = addHeadingTargets({ a: 100, b: 500, c: 900 });
    const view = await mountToc();
    expect(activeLink(view.root)?.getAttribute("href")).toBe("#a");

    setTop("a", -50);
    setTop("b", 200);
    window.dispatchEvent(new Event("scroll"));
    await vi.advanceTimersByTimeAsync(199);
    await flushAll();
    expect(activeLink(view.root)?.getAttribute("href")).toBe("#a");
    await vi.advanceTimersByTimeAsync(1);
    await flushAll();
    expect(activeLink(view.root)?.getAttribute("href")).toBe("#b");

    setTop("a", 100);
    setTop("b", 600);
    window.dispatchEvent(new Event("resize"));
    await vi.advanceTimersByTimeAsync(200);
    await flushAll();
    expect(activeLink(view.root)?.getAttribute("href")).toBe("#a");

    setTop("b", 200);
    view.root.querySelector<HTMLAnchorElement>('a[href="#b"]')!.click();
    await flushAll();
    expect(activeLink(view.root)?.getAttribute("href")).toBe("#b");

    setTop("a", -50);
    setTop("b", 600);
    window.dispatchEvent(new Event("scroll"));
    await vi.advanceTimersByTimeAsync(200);
    await flushAll();
    expect(activeLink(view.root)?.getAttribute("href")).toBe("#b");

    window.dispatchEvent(new Event("scrollend"));
    await flushAll();
    expect(activeLink(view.root)?.getAttribute("href")).toBe("#a");
  });

  it("reconciles after the fallback timeout when the browser emits no scrollend", async () => {
    vi.useFakeTimers();
    const setTop = addHeadingTargets({ a: 100, b: 500, c: 900 });
    const view = await mountToc();
    expect(activeLink(view.root)?.getAttribute("href")).toBe("#a");

    setTop("a", -50);
    view.root.querySelector<HTMLAnchorElement>('a[href="#b"]')!.click();
    await flushAll();
    expect(activeLink(view.root)?.getAttribute("href")).toBe("#b");

    setTop("b", 600);
    window.dispatchEvent(new Event("scroll"));
    await vi.advanceTimersByTimeAsync(1500);
    await flushAll();
    expect(activeLink(view.root)?.getAttribute("href")).toBe("#a");
  });

  it("clears pending scroll work and listeners when the scope is disposed", async () => {
    vi.useFakeTimers();
    const setTop = addHeadingTargets({ a: 100, b: 500, c: 900 });
    const view = await mountToc();
    expect(activeLink(view.root)?.getAttribute("href")).toBe("#a");

    setTop("b", 200);
    window.dispatchEvent(new Event("scroll"));
    view.dispose();
    mounted.pop();
    await vi.advanceTimersByTimeAsync(200);
    await flushAll();

    expect(activeLink(view.root)?.getAttribute("href")).toBe("#a");
  });
});
