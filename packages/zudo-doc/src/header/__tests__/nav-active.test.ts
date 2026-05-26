import { describe, it, expect } from "vitest";
import {
  computeActiveNavPath,
  isNavItemActive,
  pathForMatch,
  type NavItemLike,
} from "../nav-active";

describe("pathForMatch", () => {
  it("returns the path unchanged when lang is undefined", () => {
    expect(pathForMatch("/docs/intro", undefined, "en")).toBe("/docs/intro");
  });

  it("returns the path unchanged when lang equals the default locale", () => {
    expect(pathForMatch("/docs/intro", "en", "en")).toBe("/docs/intro");
  });

  it("strips the leading locale segment for non-default locales", () => {
    expect(pathForMatch("/ja/docs/intro", "ja", "en")).toBe("/docs/intro");
  });

  it("only strips the locale at the very start of the path", () => {
    // A path that merely contains the locale code mid-path must be left
    // intact — otherwise nav matching gets confused by content slugs
    // that happen to share a prefix with a locale code.
    expect(pathForMatch("/docs/ja-tutorial", "ja", "en")).toBe(
      "/docs/ja-tutorial",
    );
  });

  it("handles an empty path safely", () => {
    expect(pathForMatch("", "ja", "en")).toBe("");
  });
});

describe("computeActiveNavPath", () => {
  const nav: NavItemLike[] = [
    { path: "/docs/" },
    {
      path: "/learn/",
      children: [
        { path: "/learn/getting-started/" },
        { path: "/learn/advanced/" },
      ],
    },
    { path: "/blog/" },
  ];

  it("returns undefined when nothing matches", () => {
    expect(computeActiveNavPath(nav, "/about/")).toBeUndefined();
  });

  it("returns the matching top-level path", () => {
    expect(computeActiveNavPath(nav, "/docs/")).toBe("/docs/");
  });

  it("matches when the active page is nested under a top-level path", () => {
    expect(computeActiveNavPath(nav, "/docs/intro/")).toBe("/docs/");
  });

  it("prefers the most specific (longest) child path over its parent", () => {
    expect(
      computeActiveNavPath(nav, "/learn/getting-started/setup/"),
    ).toBe("/learn/getting-started/");
  });

  it("falls back to the parent when no child matches", () => {
    expect(computeActiveNavPath(nav, "/learn/foo/")).toBe("/learn/");
  });

  it("handles items with no children at all", () => {
    expect(computeActiveNavPath(nav, "/blog/post-1/")).toBe("/blog/");
  });
});

describe("isNavItemActive", () => {
  const item: NavItemLike = {
    path: "/learn/",
    children: [{ path: "/learn/advanced/" }, { path: "/learn/intro/" }],
  };

  it("returns true when the active path equals the item's path", () => {
    expect(isNavItemActive(item, "/learn/")).toBe(true);
  });

  it("returns true when the active path equals one of the children", () => {
    expect(isNavItemActive(item, "/learn/advanced/")).toBe(true);
    expect(isNavItemActive(item, "/learn/intro/")).toBe(true);
  });

  it("returns false when no path matches", () => {
    expect(isNavItemActive(item, "/docs/")).toBe(false);
  });

  it("returns false when the active path is undefined", () => {
    expect(isNavItemActive(item, undefined)).toBe(false);
  });

  it("works for items with no children", () => {
    const flat: NavItemLike = { path: "/blog/" };
    expect(isNavItemActive(flat, "/blog/")).toBe(true);
    expect(isNavItemActive(flat, "/docs/")).toBe(false);
  });
});
