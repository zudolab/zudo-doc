import { describe, expect, it } from "vitest";
import { getActiveHeadingId } from "../use-active-heading";

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
