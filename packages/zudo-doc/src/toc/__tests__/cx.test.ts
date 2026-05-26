import { describe, expect, it } from "vitest";
import { cx } from "../cx";

describe("cx", () => {
  it("joins truthy strings with spaces", () => {
    expect(cx("a", "b", "c")).toBe("a b c");
  });

  it("filters out falsy values", () => {
    expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("handles conditional expressions inline", () => {
    const isActive = true;
    const isOpen = false;
    expect(cx("base", isActive && "active", isOpen && "open")).toBe(
      "base active",
    );
  });

  it("flattens nested arrays", () => {
    expect(cx("a", ["b", ["c", "d"]], "e")).toBe("a b c d e");
  });

  it("includes object keys whose values are truthy", () => {
    expect(cx({ foo: true, bar: false, baz: 1 })).toBe("foo baz");
  });

  it("returns an empty string when nothing is truthy", () => {
    expect(cx(false, null, undefined, "")).toBe("");
  });
});
