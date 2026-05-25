import { describe, expect, it } from "vitest";
import { isPathLike, smartBreak } from "../smart-break";

describe("isPathLike", () => {
  it("returns false for empty input", () => {
    expect(isPathLike("")).toBe(false);
  });

  it("recognizes URL-like strings", () => {
    expect(isPathLike("https://example.com/foo")).toBe(true);
  });

  it("recognizes POSIX-style absolute and relative paths", () => {
    expect(isPathLike("/etc/passwd")).toBe(true);
    expect(isPathLike("./relative/path")).toBe(true);
    expect(isPathLike("../up/one")).toBe(true);
  });

  it("recognizes Windows drive paths", () => {
    expect(isPathLike("C:\\Users\\me")).toBe(true);
    expect(isPathLike("D:/Users/me")).toBe(true);
  });

  it("recognizes domain-plus-slash strings", () => {
    expect(isPathLike("example.com/foo")).toBe(true);
  });

  it("rejects prose with hyphens, slashes, or dots", () => {
    expect(isPathLike("and/or")).toBe(false);
    expect(isPathLike("well-known")).toBe(false);
    expect(isPathLike("state-of-the-art")).toBe(false);
    expect(isPathLike("UI/UX")).toBe(false);
    expect(isPathLike("1.2.3-beta.4")).toBe(false);
  });
});

describe("smartBreak", () => {
  it("returns the input unchanged when not path-like", () => {
    expect(smartBreak("Hello world")).toBe("Hello world");
    expect(smartBreak("UI/UX")).toBe("UI/UX");
  });

  it("returns a VNode for path-like inputs", () => {
    const result = smartBreak("https://example.com/foo");
    // VNode is an object; non-path-like returned the raw string.
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });
});
