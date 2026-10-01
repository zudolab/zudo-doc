/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, it, expect } from "vitest";
import { CategoryTreeNav } from "../category-tree-nav.js";
import { hasClass, renderNav } from "./helpers.js";
import type { NavNode } from "../types.js";

function leaf(label: string, href: string): NavNode {
  return { label, href, hasPage: true, children: [] };
}

function category(label: string, children: NavNode[], href?: string): NavNode {
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
    const root = renderNav(CategoryTreeNav({ children: [leaf("Introduction", "/docs/intro/")] }));
    expect(root.querySelector("nav ul")).not.toBeNull();
    expect(root.querySelector('a[href="/docs/intro/"]')?.textContent).toBe("Introduction");
  });

  it("renders plain text for nodes without href", () => {
    const root = renderNav(CategoryTreeNav({ children: [category("Reference", [leaf("API", "/docs/api/")])] }));
    expect(root.querySelector("span")?.textContent).toBe("Reference");
    expect(root.querySelector('a[href="/docs/reference"]')).toBeNull();
  });

  it("renders nested children", () => {
    const root = renderNav(CategoryTreeNav({ children: [category("Guide", [leaf("Setup", "/docs/setup/")])] }));
    expect(root.textContent).toContain("Guide");
    expect(root.querySelector('a[href="/docs/setup/"]')?.textContent).toBe("Setup");
  });

  it("includes description after colon when present", () => {
    const child = leaf("API", "/docs/api/");
    child.description = "Reference material";
    const root = renderNav(CategoryTreeNav({ children: [child] }));
    expect(root.textContent).toContain(": Reference material");
  });

  it("does not render children beyond maxDepth", () => {
    const deep = category("Grandchild", [leaf("Leaf", "/docs/leaf/")]);
    const mid = category("Child", [deep]);
    const rootNode = category("Root", [mid]);
    const root = renderNav(CategoryTreeNav({ children: [rootNode], maxDepth: 1 }));
    expect(root.textContent).toContain("Root");
    expect(root.textContent).toContain("Child");
    expect(root.textContent).not.toContain("Grandchild");
  });

  it("renders linked category when it has an href", () => {
    const root = renderNav(CategoryTreeNav({ children: [category("Guide", [leaf("Setup", "/docs/setup/")], "/docs/guide/")] }));
    expect(root.querySelector('a[href="/docs/guide/"]')?.textContent).toBe("Guide");
  });

  it("renders links with text-fg and hover:text-accent classes", () => {
    const root = renderNav(CategoryTreeNav({ children: [leaf("Introduction", "/docs/intro/")] }));
    expect(hasClass(root, "text-fg")).toBe(true);
    expect(hasClass(root, "hover:text-accent")).toBe(true);
    expect(hasClass(root, "focus-visible:text-accent")).toBe(true);
  });

  it("does not render a bare text-accent class anywhere", () => {
    const root = renderNav(CategoryTreeNav({ children: [leaf("Introduction", "/docs/intro/")] }));
    expect(hasClass(root, "text-accent")).toBe(false);
  });
});
