import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  loadCategoryMeta,
  clearCategoryMetaCache,
} from "../category-meta.ts";

function makeFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sidebar-tree-cm-"));
  fs.mkdirSync(path.join(root, "guides"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "guides", "_category_.json"),
    JSON.stringify({ label: "Guides", position: 3, sortOrder: "asc" }),
  );
  fs.mkdirSync(path.join(root, "log"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "log", "_category_.json"),
    JSON.stringify({ label: "Log", sortOrder: "desc", noPage: true }),
  );
  // A directory without a _category_.json — should not show up in the map.
  fs.mkdirSync(path.join(root, "no-meta"), { recursive: true });
  // A nested category to confirm recursion.
  fs.mkdirSync(path.join(root, "guides", "deep"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "guides", "deep", "_category_.json"),
    JSON.stringify({ label: "Deep" }),
  );
  // A malformed category file — must be tolerated, not crash.
  fs.mkdirSync(path.join(root, "broken"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "broken", "_category_.json"),
    "{ this is not valid JSON",
  );
  return root;
}

describe("loadCategoryMeta", () => {
  beforeEach(() => {
    clearCategoryMetaCache();
  });

  it("reads _category_.json for every directory that has one", () => {
    const dir = makeFixture();
    const meta = loadCategoryMeta(dir);
    expect(meta.get("guides")).toEqual({
      label: "Guides",
      position: 3,
      description: undefined,
      sortOrder: "asc",
      noPage: undefined,
    });
    expect(meta.get("log")).toEqual({
      label: "Log",
      position: undefined,
      description: undefined,
      sortOrder: "desc",
      noPage: true,
    });
  });

  it("recurses into subdirectories", () => {
    const dir = makeFixture();
    const meta = loadCategoryMeta(dir);
    expect(meta.get(path.join("guides", "deep"))?.label).toBe("Deep");
  });

  it("skips directories without _category_.json", () => {
    const dir = makeFixture();
    const meta = loadCategoryMeta(dir);
    expect(meta.has("no-meta")).toBe(false);
  });

  it("tolerates malformed JSON without throwing", () => {
    const dir = makeFixture();
    const meta = loadCategoryMeta(dir);
    expect(meta.has("broken")).toBe(false);
  });

  it("returns an empty map when contentDir does not exist", () => {
    const meta = loadCategoryMeta(path.join(os.tmpdir(), "definitely-does-not-exist-zzz"));
    expect(meta.size).toBe(0);
  });

  it("memoises results per absolute contentDir", () => {
    const dir = makeFixture();
    const a = loadCategoryMeta(dir);
    const b = loadCategoryMeta(dir);
    expect(a).toBe(b);
  });
});
