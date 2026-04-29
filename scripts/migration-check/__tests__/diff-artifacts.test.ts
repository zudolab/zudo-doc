/**
 * diff-artifacts.test.ts
 *
 * Unit tests for diff-artifacts.mjs covering:
 *   (d) JSON deep-compare with shuffled keys (key-order drift = cosmetic)
 *   (e) Text line-set diff with shuffled lines (line-order drift = cosmetic)
 *   (f) Binary hash comparison
 *   Plus: artifact type detection, artifact directory walking, and
 *         presence categorization (only-in-a / only-in-b / present-in-both).
 */

import { join } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getArtifactType,
  deepSortObject,
  diffJson,
  diffText,
  diffBinary,
  walkArtifactsDir,
} from "../diff-artifacts.mjs";

const FIXTURES = join(import.meta.dirname, "fixtures");
const ARTIFACTS_A = join(FIXTURES, "s4-artifacts", "a");
const ARTIFACTS_B = join(FIXTURES, "s4-artifacts", "b");

// ── Artifact type detection ───────────────────────────────────────────────────

describe("getArtifactType", () => {
  it("returns 'json' for .json files", () => {
    expect(getArtifactType("search-index.json")).toBe("json");
    expect(getArtifactType("doc-history/index.json")).toBe("json");
  });

  it("returns 'json' for .webmanifest files", () => {
    expect(getArtifactType("manifest.webmanifest")).toBe("json");
  });

  it("returns 'binary' for .ico files", () => {
    expect(getArtifactType("favicon.ico")).toBe("binary");
  });

  it("returns 'binary' for image extensions", () => {
    expect(getArtifactType("icon.png")).toBe("binary");
    expect(getArtifactType("photo.jpg")).toBe("binary");
  });

  it("returns 'text' for known text artifact names", () => {
    expect(getArtifactType("robots.txt")).toBe("text");
    expect(getArtifactType("llms.txt")).toBe("text");
    expect(getArtifactType("llms-full.txt")).toBe("text");
    expect(getArtifactType("_redirects")).toBe("text");
    expect(getArtifactType("_headers")).toBe("text");
  });

  it("returns 'text' for unknown extensions (safe fallback)", () => {
    expect(getArtifactType("some-unknown-file.xyz")).toBe("text");
  });
});

// ── deepSortObject ────────────────────────────────────────────────────────────

describe("deepSortObject", () => {
  it("sorts top-level object keys alphabetically", () => {
    const result = deepSortObject({ z: 1, a: 2, m: 3 });
    expect(Object.keys(result)).toEqual(["a", "m", "z"]);
  });

  it("sorts keys recursively at all depths", () => {
    const obj = { z: { b: 1, a: 2 }, a: { y: 3, x: 4 } };
    const result = deepSortObject(obj) as Record<string, Record<string, number>>;
    expect(Object.keys(result)).toEqual(["a", "z"]);
    expect(Object.keys(result.a)).toEqual(["x", "y"]);
    expect(Object.keys(result.z)).toEqual(["a", "b"]);
  });

  it("preserves array element order (array order is semantic)", () => {
    const arr = [3, 1, 2];
    expect(deepSortObject(arr)).toEqual([3, 1, 2]);
  });

  it("handles arrays of objects (sorts keys in each element)", () => {
    const arr = [{ z: 1, a: 2 }, { m: 3, b: 4 }];
    const result = deepSortObject(arr) as Array<Record<string, number>>;
    expect(Object.keys(result[0])).toEqual(["a", "z"]);
    expect(Object.keys(result[1])).toEqual(["b", "m"]);
  });

  it("returns primitives unchanged", () => {
    expect(deepSortObject(42)).toBe(42);
    expect(deepSortObject("hello")).toBe("hello");
    expect(deepSortObject(null)).toBeNull();
    expect(deepSortObject(true)).toBe(true);
  });
});

// ── (d) JSON deep-compare ─────────────────────────────────────────────────────

describe("diffJson", () => {
  it("treats key-order drift as cosmetic (identical result)", () => {
    const a = JSON.stringify({ z: 1, a: 2 });
    const b = JSON.stringify({ a: 2, z: 1 });
    const result = diffJson(a, b);
    expect(result.identical).toBe(true);
    expect(result.entryCountDelta).toBe(0);
  });

  it("treats nested key-order drift as cosmetic", () => {
    const a = JSON.stringify({ x: { z: 1, a: 2 } });
    const b = JSON.stringify({ x: { a: 2, z: 1 } });
    const result = diffJson(a, b);
    expect(result.identical).toBe(true);
  });

  it("detects value differences as non-identical", () => {
    const a = JSON.stringify({ key: "value-a" });
    const b = JSON.stringify({ key: "value-b" });
    const result = diffJson(a, b);
    expect(result.identical).toBe(false);
  });

  it("reports entryCountDelta for arrays", () => {
    const a = JSON.stringify([1, 2, 3]);
    const b = JSON.stringify([1, 2, 3, 4, 5]);
    const result = diffJson(a, b);
    expect(result.entryCountDelta).toBe(2);
  });

  it("reports entryCountDelta of 0 when entry counts match", () => {
    const a = JSON.stringify({ a: 1, b: 2 });
    const b = JSON.stringify({ b: 2, a: 1 });
    const result = diffJson(a, b);
    expect(result.entryCountDelta).toBe(0);
  });

  it("reports keySetDelta when keys are added", () => {
    const a = JSON.stringify({ existing: 1 });
    const b = JSON.stringify({ existing: 1, newKey: 2 });
    const result = diffJson(a, b);
    expect(result.keySetDelta?.onlyInB).toContain("newKey");
    expect(result.keySetDelta?.onlyInA).toHaveLength(0);
  });

  it("reports keySetDelta when keys are removed", () => {
    const a = JSON.stringify({ keep: 1, removed: 2 });
    const b = JSON.stringify({ keep: 1 });
    const result = diffJson(a, b);
    expect(result.keySetDelta?.onlyInA).toContain("removed");
    expect(result.keySetDelta?.onlyInB).toHaveLength(0);
  });

  it("does not flag keySetDelta when key sets are identical", () => {
    const a = JSON.stringify({ a: 1, b: 2 });
    const b = JSON.stringify({ b: 99, a: 1 });
    const result = diffJson(a, b);
    expect(result.keySetDelta).toBeNull();
  });

  it("handles invalid JSON in A gracefully", () => {
    const result = diffJson("{ invalid", '{"ok": true}');
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("A: invalid JSON");
  });

  it("handles invalid JSON in B gracefully", () => {
    const result = diffJson('{"ok": true}', "{ invalid");
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("B: invalid JSON");
  });

  it("compares fixture a/search-index.json and b/search-index.json as identical (key order differs)", () => {
    const aContent = readFileSync(join(ARTIFACTS_A, "search-index.json"), "utf8");
    const bContent = readFileSync(join(ARTIFACTS_B, "search-index.json"), "utf8");
    const result = diffJson(aContent, bContent);
    expect(result.identical).toBe(true);
  });
});

// ── (e) Text line-set diff ────────────────────────────────────────────────────

describe("diffText", () => {
  it("treats line-order drift as cosmetic (identical result)", () => {
    const a = "line1\nline2\nline3";
    const b = "line3\nline1\nline2";
    const result = diffText(a, b);
    expect(result.identical).toBe(true);
    expect(result.addedLines).toHaveLength(0);
    expect(result.removedLines).toHaveLength(0);
  });

  it("flags added lines", () => {
    const a = "line1\nline2";
    const b = "line1\nline2\nnew-line";
    const result = diffText(a, b);
    expect(result.identical).toBe(false);
    expect(result.addedLines).toContain("new-line");
    expect(result.removedLines).toHaveLength(0);
  });

  it("flags removed lines", () => {
    const a = "line1\nline2\nremoved-line";
    const b = "line1\nline2";
    const result = diffText(a, b);
    expect(result.identical).toBe(false);
    expect(result.removedLines).toContain("removed-line");
    expect(result.addedLines).toHaveLength(0);
  });

  it("ignores empty lines", () => {
    const a = "line1\n\nline2\n\n";
    const b = "line2\nline1";
    const result = diffText(a, b);
    expect(result.identical).toBe(true);
  });

  it("ignores trailing whitespace on lines", () => {
    const a = "line1   \nline2";
    const b = "line1\nline2   ";
    const result = diffText(a, b);
    expect(result.identical).toBe(true);
  });

  it("compares fixture a/robots.txt and b/robots.txt as identical (line order differs)", () => {
    const aContent = readFileSync(join(ARTIFACTS_A, "robots.txt"), "utf8");
    const bContent = readFileSync(join(ARTIFACTS_B, "robots.txt"), "utf8");
    const result = diffText(aContent, bContent);
    expect(result.identical).toBe(true);
  });
});

// ── (f) Binary hash comparison ────────────────────────────────────────────────

describe("diffBinary", () => {
  it("reports identical for the same file compared to itself", async () => {
    const aPath = join(ARTIFACTS_A, "favicon.ico");
    const result = await diffBinary(aPath, aPath);
    expect(result.identical).toBe(true);
    expect(result.hashA).toBe(result.hashB);
    expect(result.sizeA).toBe(result.sizeB);
  });

  it("reports non-identical for different files", async () => {
    const aPath = join(ARTIFACTS_A, "favicon.ico");
    const bPath = join(ARTIFACTS_B, "favicon.ico");
    const result = await diffBinary(aPath, bPath);
    expect(result.identical).toBe(false);
    expect(result.hashA).not.toBe(result.hashB);
  });

  it("includes sizeA and sizeB in the result", async () => {
    const aPath = join(ARTIFACTS_A, "favicon.ico");
    const bPath = join(ARTIFACTS_B, "favicon.ico");
    const result = await diffBinary(aPath, bPath);
    expect(typeof result.sizeA).toBe("number");
    expect(typeof result.sizeB).toBe("number");
    expect(result.sizeA).toBeGreaterThan(0);
    expect(result.sizeB).toBeGreaterThan(0);
  });

  it("produces a 64-char hex SHA-256 hash", async () => {
    const aPath = join(ARTIFACTS_A, "favicon.ico");
    const result = await diffBinary(aPath, aPath);
    expect(result.hashA).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ── walkArtifactsDir ──────────────────────────────────────────────────────────

describe("walkArtifactsDir", () => {
  it("returns all files in the artifacts A dir", async () => {
    const files = await walkArtifactsDir(ARTIFACTS_A);
    expect(files).toContain("robots.txt");
    expect(files).toContain("search-index.json");
    expect(files).toContain("favicon.ico");
    expect(files).toContain("manifest.webmanifest");
  });

  it("returns all files in the artifacts B dir", async () => {
    const files = await walkArtifactsDir(ARTIFACTS_B);
    expect(files).toContain("robots.txt");
    expect(files).toContain("search-index.json");
    expect(files).toContain("favicon.ico");
    expect(files).toContain("llms.txt");
  });

  it("returns an empty array for a non-existent directory", async () => {
    const files = await walkArtifactsDir(join(FIXTURES, "nonexistent-dir"));
    expect(files).toEqual([]);
  });
});

// ── Presence categorization (integration) ─────────────────────────────────────

describe("presence categorization (A vs B artifact sets)", () => {
  it("correctly identifies manifest.webmanifest as only-in-a", async () => {
    const filesA = await walkArtifactsDir(ARTIFACTS_A);
    const filesB = await walkArtifactsDir(ARTIFACTS_B);
    const setB = new Set(filesB);
    const onlyInA = filesA.filter((f) => !setB.has(f));
    expect(onlyInA).toContain("manifest.webmanifest");
  });

  it("correctly identifies llms.txt as only-in-b", async () => {
    const filesA = await walkArtifactsDir(ARTIFACTS_A);
    const filesB = await walkArtifactsDir(ARTIFACTS_B);
    const setA = new Set(filesA);
    const onlyInB = filesB.filter((f) => !setA.has(f));
    expect(onlyInB).toContain("llms.txt");
  });

  it("correctly identifies shared artifacts as present-in-both", async () => {
    const filesA = await walkArtifactsDir(ARTIFACTS_A);
    const filesB = await walkArtifactsDir(ARTIFACTS_B);
    const setA = new Set(filesA);
    const setB = new Set(filesB);
    const inBoth = filesA.filter((f) => setB.has(f));
    expect(inBoth).toContain("robots.txt");
    expect(inBoth).toContain("search-index.json");
    expect(inBoth).toContain("favicon.ico");
    // manifest is only-in-a, llms.txt is only-in-b
    expect(setA.has("llms.txt")).toBe(false);
    expect(setB.has("manifest.webmanifest")).toBe(false);
  });
});
