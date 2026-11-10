import { diffLines as diffLines8 } from "diff8";
import { diffLines as diffLines9 } from "diff";
import { describe, expect, it } from "vitest";
import { diffLines as loaded } from "../diff-loader.js";

// The published peer is `^8.0.0 || ^9.0.0`. Compare view only calls
// `diffLines(old, next)` and reads `added` / `removed` / `value`, which 9.0.0
// kept. 9.0.0's breaking changes are in patch parsing and formatting.
function lineChanges(diffLines: typeof diffLines9) {
  return diffLines("alpha\n", "beta\n").map((change) => ({
    added: change.added,
    removed: change.removed,
    value: change.value,
  }));
}

const expected = [
  { added: false, removed: true, value: "alpha\n" },
  { added: true, removed: false, value: "beta\n" },
];

describe("diff peer majors", () => {
  it("accepts diff 8.0.4 diffLines results", () => {
    expect(lineChanges(diffLines8)).toEqual(expected);
  });

  it("accepts diff 9 diffLines results", () => {
    expect(lineChanges(diffLines9)).toEqual(expected);
  });

  it("loads diffLines from the installed peer through the package loader", () => {
    expect(loaded).toEqual(expect.any(Function));
    expect(lineChanges(loaded!)).toEqual(expected);
  });
});
