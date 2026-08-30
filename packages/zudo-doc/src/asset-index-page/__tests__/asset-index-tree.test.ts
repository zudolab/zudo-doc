import { describe, expect, it } from "vitest";
import type { AssetIndexEntry } from "../../route-context-payload/types.js";
import { buildAssetTree } from "../index.js";

function entry(path: string, bytes = 1): AssetIndexEntry {
  const parts = path.split("/");
  return {
    path,
    name: parts.at(-1) ?? path,
    dir: parts.slice(0, -1).join("/"),
    kind: "text",
    mime: "text/plain",
    bytes,
  };
}

describe("buildAssetTree", () => {
  it("builds deep POSIX nesting, sorts directories before files, and aggregates subtrees", () => {
    const tree = buildAssetTree([
      entry("z-root.txt", 2),
      entry("scripts/setup/z-last.sh", 5),
      entry("scripts/a-first.sh", 3),
      entry("assets/logo.svg", 7),
      entry("a-root.txt", 11),
    ]);

    expect(tree.dirs.map((dir) => dir.name)).toEqual(["assets", "scripts"]);
    expect(tree.files.map((file) => file.path)).toEqual(["a-root.txt", "z-root.txt"]);
    expect(tree.fileCount).toBe(5);
    expect(tree.bytes).toBe(28);
    expect(tree.dirs[1]).toMatchObject({ name: "scripts", fileCount: 2, bytes: 8 });
    expect(tree.dirs[1]?.dirs[0]).toMatchObject({ name: "setup", fileCount: 1, bytes: 5 });
  });

  it("keeps a single root file directly on the root node", () => {
    const tree = buildAssetTree([entry("README.txt", 9)]);
    expect(tree.dirs).toEqual([]);
    expect(tree.files.map((file) => file.path)).toEqual(["README.txt"]);
    expect(tree).toMatchObject({ fileCount: 1, bytes: 9 });
  });
});
