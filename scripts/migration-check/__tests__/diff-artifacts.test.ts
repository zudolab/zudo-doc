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
  extractAstroCanonicalBasename,
  buildAstroCanonicalMap,
} from "../diff-artifacts.mjs";

const FIXTURES = join(import.meta.dirname, "fixtures");
const ARTIFACTS_A = join(FIXTURES, "s4-artifacts", "a");
const ARTIFACTS_B = join(FIXTURES, "s4-artifacts", "b");

// Local success-shape aliases for the diff-artifacts return unions.
// The source helpers return `success | error`; tests in this file always assert
// the success path explicitly, so we narrow at the call site via `as`.
type DiffJsonSuccess = {
  identical: boolean;
  entryCountDelta: number;
  keySetDelta: { onlyInA: string[]; onlyInB: string[] } | null;
};

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
    expect(getArtifactType("image-wide.webp")).toBe("binary");
    expect(getArtifactType("logo.svg")).toBe("binary");
    expect(getArtifactType("_astro/image-wide.D1YdccyX_1EtJL4.webp")).toBe("binary");
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
    const result = deepSortObject({ z: 1, a: 2, m: 3 }) as Record<string, number>;
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
    const result = diffJson(a, b) as DiffJsonSuccess;
    expect(result.identical).toBe(true);
    expect(result.entryCountDelta).toBe(0);
  });

  it("treats nested key-order drift as cosmetic", () => {
    const a = JSON.stringify({ x: { z: 1, a: 2 } });
    const b = JSON.stringify({ x: { a: 2, z: 1 } });
    const result = diffJson(a, b) as DiffJsonSuccess;
    expect(result.identical).toBe(true);
  });

  it("detects value differences as non-identical", () => {
    const a = JSON.stringify({ key: "value-a" });
    const b = JSON.stringify({ key: "value-b" });
    const result = diffJson(a, b) as DiffJsonSuccess;
    expect(result.identical).toBe(false);
  });

  it("reports entryCountDelta for arrays", () => {
    const a = JSON.stringify([1, 2, 3]);
    const b = JSON.stringify([1, 2, 3, 4, 5]);
    const result = diffJson(a, b) as DiffJsonSuccess;
    expect(result.entryCountDelta).toBe(2);
  });

  it("reports entryCountDelta of 0 when entry counts match", () => {
    const a = JSON.stringify({ a: 1, b: 2 });
    const b = JSON.stringify({ b: 2, a: 1 });
    const result = diffJson(a, b) as DiffJsonSuccess;
    expect(result.entryCountDelta).toBe(0);
  });

  it("reports keySetDelta when keys are added", () => {
    const a = JSON.stringify({ existing: 1 });
    const b = JSON.stringify({ existing: 1, newKey: 2 });
    const result = diffJson(a, b) as DiffJsonSuccess;
    expect(result.keySetDelta?.onlyInB).toContain("newKey");
    expect(result.keySetDelta?.onlyInA).toHaveLength(0);
  });

  it("reports keySetDelta when keys are removed", () => {
    const a = JSON.stringify({ keep: 1, removed: 2 });
    const b = JSON.stringify({ keep: 1 });
    const result = diffJson(a, b) as DiffJsonSuccess;
    expect(result.keySetDelta?.onlyInA).toContain("removed");
    expect(result.keySetDelta?.onlyInB).toHaveLength(0);
  });

  it("does not flag keySetDelta when key sets are identical", () => {
    const a = JSON.stringify({ a: 1, b: 2 });
    const b = JSON.stringify({ b: 99, a: 1 });
    const result = diffJson(a, b) as DiffJsonSuccess;
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
    const result = diffJson(aContent, bContent) as DiffJsonSuccess;
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

// ── extractAstroCanonicalBasename ─────────────────────────────────────────────

describe("extractAstroCanonicalBasename", () => {
  it("strips Astro content hash and returns canonical basename", () => {
    expect(extractAstroCanonicalBasename("_astro/image-wide.D1YdccyX_1EtJL4.webp")).toBe(
      "image-wide.webp",
    );
  });

  it("handles hashes with underscores and hyphens (base64url charset)", () => {
    expect(extractAstroCanonicalBasename("_astro/image-small.A1B2C3D4_efgh.webp")).toBe(
      "image-small.webp",
    );
  });

  it("handles different extensions (png, jpg)", () => {
    expect(extractAstroCanonicalBasename("_astro/logo.ABCDEFGH12345678.png")).toBe("logo.png");
    expect(extractAstroCanonicalBasename("_astro/photo.abcdefgh.jpg")).toBe("photo.jpg");
  });

  it("returns null for paths not under _astro/", () => {
    expect(extractAstroCanonicalBasename("img/image-enlarge/image-wide.webp")).toBeNull();
    expect(extractAstroCanonicalBasename("favicon.ico")).toBeNull();
    expect(extractAstroCanonicalBasename("robots.txt")).toBeNull();
  });

  it("returns null when hash segment is shorter than 8 characters", () => {
    // 7 chars is too short — likely not a content hash
    expect(extractAstroCanonicalBasename("_astro/image.short.webp")).toBeNull();
    expect(extractAstroCanonicalBasename("_astro/image.abc1234.webp")).toBeNull();
  });

  it("returns null when filename has no hash pattern (no dot-separated segments)", () => {
    expect(extractAstroCanonicalBasename("_astro/image-wide.webp")).toBeNull();
  });

  it("returns null for nested _astro paths (subdirectory inside _astro/)", () => {
    // Only top-level _astro/<name>.<HASH>.<ext> is supported
    expect(extractAstroCanonicalBasename("_astro/sub/image.D1YdccyX.webp")).toBeNull();
  });
});

// ── buildAstroCanonicalMap ────────────────────────────────────────────────────

describe("buildAstroCanonicalMap", () => {
  it("builds a map of canonical basename → actual path for _astro paths", () => {
    const paths = [
      "_astro/image-wide.D1YdccyX_1EtJL4.webp",
      "_astro/image-small.ABCDEFGH12345678.webp",
      "robots.txt",
      "img/image-enlarge/image-opt-out.webp",
    ];
    const map = buildAstroCanonicalMap(paths);
    expect(map.size).toBe(2);
    expect(map.get("image-wide.webp")).toBe("_astro/image-wide.D1YdccyX_1EtJL4.webp");
    expect(map.get("image-small.webp")).toBe("_astro/image-small.ABCDEFGH12345678.webp");
  });

  it("ignores non-_astro paths", () => {
    const paths = ["robots.txt", "search-index.json", "favicon.ico"];
    const map = buildAstroCanonicalMap(paths);
    expect(map.size).toBe(0);
  });

  it("returns empty map for empty input", () => {
    const map = buildAstroCanonicalMap([]);
    expect(map.size).toBe(0);
  });

  it("last writer wins when two _astro paths canonicalize to the same basename", () => {
    // Unlikely in practice, but the Map will hold the last one written
    const paths = [
      "_astro/image-wide.HASH00001234.webp",
      "_astro/image-wide.HASH99998765.webp",
    ];
    const map = buildAstroCanonicalMap(paths);
    expect(map.size).toBe(1);
    expect(map.has("image-wide.webp")).toBe(true);
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
