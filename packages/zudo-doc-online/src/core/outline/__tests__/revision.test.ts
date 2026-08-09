import { describe, expect, it } from "vitest";

import {
  outlineRevisionHash,
  outlinesEqual,
  stableHash,
  stableStringify,
} from "../revision";
import type { OutlineDoc } from "../types";
import { testDoc } from "./support";

describe("stableStringify", () => {
  it("is insensitive to key insertion order", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("sorts keys at every depth", () => {
    expect(stableStringify({ outer: { z: 1, a: { y: 1, b: 2 } } })).toBe(
      '{"outer":{"a":{"b":2,"y":1},"z":1}}',
    );
  });

  it("treats array order as meaningful", () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it("erases undefined the way JSON.stringify does", () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(stableStringify([1, undefined])).toBe("[1,null]");
    expect(stableStringify(undefined)).toBe("null");
  });

  it("writes non-finite numbers as null", () => {
    expect(stableStringify(Number.NaN)).toBe("null");
    expect(stableStringify(Number.POSITIVE_INFINITY)).toBe("null");
  });

  it("handles the primitive cases", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(true)).toBe("true");
    expect(stableStringify(false)).toBe("false");
    expect(stableStringify("hi")).toBe('"hi"');
    expect(stableStringify(1.5)).toBe("1.5");
  });
});

describe("stableHash", () => {
  it("is deterministic and fixed-width", () => {
    const hash = stableHash("aurora");
    expect(hash).toBe(stableHash("aurora"));
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("separates inputs that differ by one character", () => {
    expect(stableHash("aurora")).not.toBe(stableHash("aurorb"));
    expect(stableHash("")).not.toBe(stableHash("a"));
  });

  it("hashes non-ASCII input by its UTF-8 bytes", () => {
    expect(stableHash("はじめに")).toMatch(/^[0-9a-f]{16}$/);
    expect(stableHash("はじめに")).not.toBe(stableHash("はじめ"));
  });
});

describe("outlineRevisionHash", () => {
  it("ignores key order but not content", () => {
    const doc = testDoc();
    const reordered = JSON.parse(
      JSON.stringify({
        categories: doc.categories,
        projectTitle: doc.projectTitle,
        schemaVersion: doc.schemaVersion,
      }),
    ) as OutlineDoc;

    expect(outlineRevisionHash(reordered)).toBe(outlineRevisionHash(doc));

    const renamed = testDoc();
    renamed.projectTitle = "Different";
    expect(outlineRevisionHash(renamed)).not.toBe(outlineRevisionHash(doc));
  });

  it("changes when page order changes", () => {
    const doc = testDoc();
    const swapped = testDoc();
    swapped.categories[0]?.pages.reverse();
    expect(outlineRevisionHash(swapped)).not.toBe(outlineRevisionHash(doc));
  });
});

describe("outlinesEqual", () => {
  it("compares logically, not by reference", () => {
    expect(outlinesEqual(testDoc(), testDoc())).toBe(true);

    const changed = testDoc();
    const category = changed.categories[0];
    if (category) category.title = "Renamed";
    expect(outlinesEqual(testDoc(), changed)).toBe(false);
  });
});
