/**
 * Verifies that `buildNavTree` uses WeakMap identity memoization:
 *   - Same array reference → same NavNode[] result reference (cache hit).
 *   - Different array reference (but same content) → new result (cache miss).
 *
 * These properties are the acceptance gate for S18 (issue #1902):
 *   - With the old O(n log n) string-key approach, EVERY call was O(n log n)
 *     because the key was rebuilt each time regardless of cache hit/miss.
 *   - With the WeakMap approach, a cache hit is O(1): no docs iteration.
 *
 * The test uses minimal DocsEntry stubs — only the fields `buildNavTree`
 * reads (id, data.{slug, sidebar_position, sidebar_label, title, description,
 * unlisted, standalone}).
 */

import { describe, it, expect } from "vitest";
import { buildNavTree } from "../docs";
import type { DocsEntry } from "@/types/docs-entry";

/** Minimal DocsEntry factory. Only sets fields that buildNavTree reads. */
function makeEntry(id: string, title: string = id): DocsEntry {
  return {
    id,
    collection: "docs",
    slug: id,
    data: {
      title,
      sidebar_position: undefined,
      sidebar_label: undefined,
      description: undefined,
      unlisted: false,
      standalone: false,
      slug: undefined,
      draft: false,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const ENTRIES: DocsEntry[] = [
  makeEntry("intro", "Introduction"),
  makeEntry("guides/start", "Getting Started"),
  makeEntry("guides/advanced", "Advanced"),
];

describe("buildNavTree — WeakMap identity memoization", () => {
  it("returns the same NavNode[] reference for the same docs array (cache hit)", () => {
    const result1 = buildNavTree(ENTRIES, "en");
    const result2 = buildNavTree(ENTRIES, "en");
    // Exact same reference: WeakMap hit, O(1) — no re-computation
    expect(result1).toBe(result2);
  });

  it("returns a new result for a structurally identical but different array (cache miss)", () => {
    const copy = [...ENTRIES]; // same entries, different array reference
    const resultOriginal = buildNavTree(ENTRIES, "en");
    const resultCopy = buildNavTree(copy, "en");
    // Different array reference → different WeakMap key → new result
    expect(resultOriginal).not.toBe(resultCopy);
    // But structural content is equivalent
    expect(resultCopy).toEqual(resultOriginal);
  });

  it("cache is keyed per lang: same docs + different lang → different result", () => {
    const resultEn = buildNavTree(ENTRIES, "en");
    const resultJa = buildNavTree(ENTRIES, "ja");
    expect(resultEn).not.toBe(resultJa);
  });

  it("repeated calls with same docs + lang return the same reference (multiple hits)", () => {
    const calls = Array.from({ length: 10 }, () => buildNavTree(ENTRIES, "en"));
    // All calls should return the exact same reference
    for (const result of calls) {
      expect(result).toBe(calls[0]);
    }
  });
});
