import { describe, expect, it } from "vitest";
import {
  assetRawHref,
  assetViewerHref,
  decodeAuthoredHref,
  encodeAssetPathForUrl,
  matchExclude,
  normalizeAssetPath,
  validateAssetViewerSettings,
} from "../index.js";

describe("asset path normalization and URL round trips", () => {
  it("builds an extension-bearing viewer URL with the required trailing slash", () => {
    expect(assetViewerHref({ base: "/", routePrefix: "files", path: "img/logo.svg" })).toBe("/files/img/logo.svg/");
  });

  it.each([
    ["folder/hello world.ts", "folder/hello%20world.ts"],
    ["資料/設計図.svg", "%E8%B3%87%E6%96%99/%E8%A8%AD%E8%A8%88%E5%9B%B3.svg"],
    ["literal%/hash#query?.txt", "literal%25/hash%23query%3F.txt"],
  ])("encodes %s per segment", (path, encoded) => {
    expect(encodeAssetPathForUrl(path)).toBe(encoded);
    const rawHref = assetRawHref({ base: "/project/", dir: "downloads", path });
    expect(rawHref).toBe(`/project/downloads/${encoded}`);
    expect(decodeAuthoredHref(rawHref, { base: "/project", dir: "downloads" })).toEqual({ path });
  });

  it("accepts root-relative authored links before zfb applies a non-empty base", () => {
    expect(decodeAuthoredHref("/downloads/foo.js", { base: "/project", dir: "downloads" })).toEqual({ path: "foo.js" });
    // Prefer the raw authored namespace when its first segment happens to be
    // identical to the configured base.
    expect(decodeAuthoredHref("/project/downloads/foo.js", { base: "/project", dir: "project/downloads" })).toEqual({ path: "foo.js" });
  });

  it("decodes exactly once and preserves fragments", () => {
    expect(decodeAuthoredHref("/assets/100%2525.txt#L20", { base: "", dir: "assets" })).toEqual({ path: "100%25.txt", fragment: "#L20" });
    expect(assetViewerHref({ base: "/project", routePrefix: "files", path: "100%25.txt", fragment: "#L20" })).toBe("/project/files/100%2525.txt/#L20");
  });

  it("distinguishes literal encoded punctuation from queries and fragments", () => {
    expect(decodeAuthoredHref("/assets/a%3Fb%23c.txt#part", { base: "/", dir: "assets" })).toEqual({ path: "a?b#c.txt", fragment: "#part" });
    expect(decodeAuthoredHref("/assets/a.txt?download=1", { base: "", dir: "assets" })).toBeNull();
    expect(decodeAuthoredHref("/assets/a%2Fb.txt", { base: "", dir: "assets" })).toBeNull();
    expect(decodeAuthoredHref("https://example.test/assets/a.txt", { base: "", dir: "assets" })).toBeNull();
  });

  it("normalizes Unicode to NFC", () => {
    expect(normalizeAssetPath("cafe\u0301/menu.txt")).toBe("caf\u00e9/menu.txt");
  });

  it.each(["", "/a", "a/", "a//b", "a/./b", "a/../b", "a\\b", "a\0b"])("rejects invalid path %j", (path) => {
    expect(() => normalizeAssetPath(path)).toThrow();
  });
});

describe("asset viewer settings", () => {
  it("accepts distinct multi-segment paths", () => {
    expect(() => validateAssetViewerSettings({ dir: "downloads/public", routePrefix: "files/view" })).not.toThrow();
  });

  it.each([
    [{ dir: "", routePrefix: "files" }, "must not be empty"],
    [{ dir: "/assets", routePrefix: "files" }, "relative"],
    [{ dir: "assets/", routePrefix: "files" }, "relative"],
    [{ dir: "assets/../private", routePrefix: "files" }, "dot segments"],
    [{ dir: "assets", routePrefix: "assets" }, "must be different"],
    [{ dir: "assets/client", routePrefix: "files" }, "reserved"],
    [{ dir: "assets", routePrefix: "assets/client" }, "reserved"],
  ])("rejects invalid settings", (settings, message) => {
    expect(() => validateAssetViewerSettings(settings)).toThrow(message);
  });
});

describe("matchExclude", () => {
  it.each([
    ["draft.js", ["*.js"], true],
    ["nested/draft.js", ["*.js"], false],
    ["nested/draft.js", ["**/*.js"], true],
    ["draft.js", ["**/*.js"], true],
    ["a/b/c.txt", ["a/**"], true],
    ["a/x.txt", ["a/?.txt"], true],
    ["a/xy.txt", ["a/?.txt"], false],
    ["icons/logo.svg", ["**/*.{png,svg}"], true],
    ["icons/logo.jpg", ["**/*.{png,svg}"], false],
  ])("matches %s against %j", (path, globs, expected) => {
    expect(matchExclude(path, globs)).toBe(expected);
  });
});
