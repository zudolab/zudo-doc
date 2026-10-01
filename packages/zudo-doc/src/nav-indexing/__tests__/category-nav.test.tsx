/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, it, expect } from "vitest";
import { CategoryNav } from "../category-nav.js";
import { hasClass, renderNav } from "./helpers.js";
import type { NavNode } from "../types.js";

function makeNode(
  label: string,
  href: string,
  opts: Partial<NavNode> = {},
): NavNode {
  return { label, href, hasPage: true, children: [], ...opts };
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
    const root = renderNav(CategoryNav({ children: [makeNode("Getting Started", "/docs/getting-started/")] }));
    expect(root.querySelector("nav")).not.toBeNull();
    expect(root.querySelector('a[href="/docs/getting-started/"]')?.textContent).toContain("Getting Started");
  });

  it("renders descriptions when present", () => {
    const root = renderNav(CategoryNav({
      children: [makeNode("Guide", "/docs/guide/", { description: "A helpful guide" })],
    }));
    expect(root.textContent).toContain("A helpful guide");
  });

  it("does not render description span when description is absent", () => {
    const root = renderNav(CategoryNav({ children: [makeNode("Guide", "/docs/guide/")] }));
    expect(root.querySelector(".text-muted")).toBeNull();
  });

  it("filters out nodes with hasPage === false", () => {
    const withPage = makeNode("Page", "/docs/page/");
    const noPage: NavNode = { label: "Category", hasPage: false, children: [] };
    const root = renderNav(CategoryNav({ children: [withPage, noPage] }));
    expect(root.textContent).toContain("Page");
    expect(root.textContent).not.toContain("Category");
  });

  it("renders multiple card links", () => {
    const root = renderNav(CategoryNav({ children: [
      makeNode("Alpha", "/docs/alpha/"),
      makeNode("Beta", "/docs/beta/"),
    ] }));
    expect(root.querySelector('a[href="/docs/alpha/"]')?.textContent).toContain("Alpha");
    expect(root.querySelector('a[href="/docs/beta/"]')?.textContent).toContain("Beta");
  });

  it("appends extra class to nav element", () => {
    const root = renderNav(CategoryNav({ children: [makeNode("X", "/docs/x/")], class: "mt-8" }));
    expect(root.querySelector("nav")?.classList.contains("mt-8")).toBe(true);
  });

  it("renders the title with text-fg and group-hover:text-accent classes", () => {
    const root = renderNav(CategoryNav({ children: [makeNode("Getting Started", "/docs/getting-started/")] }));
    expect(hasClass(root, "text-fg")).toBe(true);
    expect(hasClass(root, "group-hover:text-accent")).toBe(true);
    expect(hasClass(root, "group-focus-visible:text-accent")).toBe(true);
  });

  it("does not render a bare text-accent class anywhere", () => {
    const root = renderNav(CategoryNav({ children: [
      makeNode("Guide", "/docs/guide/", { description: "A helpful guide" }),
    ] }));
    expect(hasClass(root, "text-accent")).toBe(false);
  });
});
