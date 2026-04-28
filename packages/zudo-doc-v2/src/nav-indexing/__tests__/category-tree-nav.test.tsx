/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, it, expect } from "vitest";
import { CategoryTreeNav } from "../category-tree-nav";
import { serialize } from "./helpers";
import type { NavNode } from "../types";

function leaf(label: string, href: string): NavNode {
  return { label, href, hasPage: true, children: [] };
}

function category(
  label: string,
  children: NavNode[],
  href?: string,
): NavNode {
  return { label, href, hasPage: !!href, children };
}

describe("CategoryTreeNav", () => {
  it("returns null when children is empty", () => {
    expect(CategoryTreeNav({ children: [] })).toBeNull();
  });

  it("returns null when all nodes have hasPage false and no children", () => {
    const node: NavNode = { label: "X", hasPage: false, children: [] };
    expect(CategoryTreeNav({ children: [node] })).toBeNull();
  });

  it("renders a nav with a list for leaf nodes", () => {
    const child = leaf("Introduction", "/docs/intro/");
    const html = serialize(CategoryTreeNav({ children: [child] }));
    expect(html).toContain("<nav");
    expect(html).toContain("<ul");
    expect(html).toContain('href="/docs/intro/"');
    expect(html).toContain("Introduction");
  });

  it("renders plain text for nodes without href", () => {
    const node = category("Reference", [leaf("API", "/docs/api/")]);
    const html = serialize(CategoryTreeNav({ children: [node] }));
    // Category label should be plain text (span), not a link
    expect(html).toContain("<span");
    expect(html).toContain("Reference");
  });

  it("renders nested children", () => {
    const node = category("Guide", [leaf("Setup", "/docs/setup/")]);
    const html = serialize(CategoryTreeNav({ children: [node] }));
    expect(html).toContain("Guide");
    expect(html).toContain("Setup");
    expect(html).toContain('href="/docs/setup/"');
  });

  it("includes description after colon when present", () => {
    const child = leaf("API", "/docs/api/");
    (child as NavNode).description = "Reference material";
    const html = serialize(CategoryTreeNav({ children: [child] }));
    expect(html).toContain(": Reference material");
  });

  it("does not render children beyond maxDepth", () => {
    const deep = category("Grandchild", [leaf("Leaf", "/docs/leaf/")]);
    const mid = category("Child", [deep]);
    const root = category("Root", [mid]);
    const html = serialize(CategoryTreeNav({ children: [root], maxDepth: 1 }));
    // Should render Root and Child but not Grandchild
    expect(html).toContain("Root");
    expect(html).toContain("Child");
    expect(html).not.toContain("Grandchild");
  });

  it("renders linked category when it has an href", () => {
    const node = category("Guide", [leaf("Setup", "/docs/setup/")], "/docs/guide/");
    const html = serialize(CategoryTreeNav({ children: [node] }));
    expect(html).toContain('href="/docs/guide/"');
  });
});
