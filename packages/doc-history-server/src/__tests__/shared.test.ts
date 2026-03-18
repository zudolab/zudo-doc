import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { getContentDirEntries } from "../shared.js";

describe("getContentDirEntries", () => {
  it("returns single entry with null key when no locales", () => {
    const result = getContentDirEntries("src/content/docs", []);
    expect(result).toEqual([[null, resolve("src/content/docs")]]);
  });

  it("returns entries for each locale plus default", () => {
    const result = getContentDirEntries("src/content/docs", [
      { key: "ja", dir: "src/content/docs-ja" },
      { key: "fr", dir: "src/content/docs-fr" },
    ]);
    expect(result).toEqual([
      [null, resolve("src/content/docs")],
      ["ja", resolve("src/content/docs-ja")],
      ["fr", resolve("src/content/docs-fr")],
    ]);
  });

  it("resolves paths to absolute", () => {
    const result = getContentDirEntries("relative/path", []);
    const [, dir] = result[0];
    expect(dir).toBe(resolve("relative/path"));
    // Absolute paths start with /
    expect(dir.startsWith("/")).toBe(true);
  });
});
