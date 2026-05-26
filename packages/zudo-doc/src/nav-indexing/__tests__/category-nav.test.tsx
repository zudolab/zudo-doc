/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, it, expect } from "vitest";
import { CategoryNav } from "../category-nav";
import { serialize } from "./helpers";
import type { NavNode } from "../types";

function makeNode(
  label: string,
  href: string,
  opts: Partial<NavNode> = {},
): NavNode {
  return {
    label,
    href,
    hasPage: true,
    children: [],
    ...opts,
  };
}

describe("CategoryNav", () => {
  it("returns null when children is empty", () => {
    expect(CategoryNav({ children: [] })).toBeNull();
  });

  it("returns null when no children have hasPage === true", () => {
    const node: NavNode = { label: "X", hasPage: false, children: [] };
    expect(CategoryNav({ children: [node] })).toBeNull();
  });

  it("renders a nav with one card link", () => {
    const child = makeNode("Getting Started", "/docs/getting-started/");
    const html = serialize(CategoryNav({ children: [child] }));
    expect(html).toContain("<nav");
    expect(html).toContain('href="/docs/getting-started/"');
    expect(html).toContain("Getting Started");
  });

  it("renders descriptions when present", () => {
    const child = makeNode("Guide", "/docs/guide/", {
      description: "A helpful guide",
    });
    const html = serialize(CategoryNav({ children: [child] }));
    expect(html).toContain("A helpful guide");
  });

  it("does not render description span when description is absent", () => {
    const child = makeNode("Guide", "/docs/guide/");
    const html = serialize(CategoryNav({ children: [child] }));
    // description span should not be in output
    expect(html).not.toContain("text-muted");
  });

  it("filters out nodes with hasPage === false", () => {
    const withPage = makeNode("Page", "/docs/page/");
    const noPage: NavNode = { label: "Category", hasPage: false, children: [] };
    const html = serialize(CategoryNav({ children: [withPage, noPage] }));
    expect(html).toContain("Page");
    expect(html).not.toContain("Category");
  });

  it("renders multiple card links", () => {
    const children = [
      makeNode("Alpha", "/docs/alpha/"),
      makeNode("Beta", "/docs/beta/"),
    ];
    const html = serialize(CategoryNav({ children }));
    expect(html).toContain("Alpha");
    expect(html).toContain("Beta");
    expect(html).toContain('href="/docs/alpha/"');
    expect(html).toContain('href="/docs/beta/"');
  });

  it("appends extra class to nav element", () => {
    const child = makeNode("X", "/docs/x/");
    const html = serialize(CategoryNav({ children: [child], class: "mt-8" }));
    expect(html).toContain("mt-8");
  });
});
