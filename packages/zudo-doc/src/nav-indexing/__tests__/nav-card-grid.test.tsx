/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, it, expect } from "vitest";
import { NavCardGrid } from "../nav-card-grid.js";
import { hasClass, renderNav } from "./helpers.js";
import type { NavNode } from "../types.js";

function node(label: string, href: string, opts: Partial<NavNode> = {}): NavNode {
  return { label, href, hasPage: true, children: [], ...opts };
}

describe("NavCardGrid", () => {
  it("returns null when children is empty", () => {
    expect(NavCardGrid({ children: [] })).toBeNull();
  });

  it("returns null when no children have href", () => {
    const noHref: NavNode = { label: "X", hasPage: true, children: [] };
    expect(NavCardGrid({ children: [noHref] })).toBeNull();
  });

  it("renders nav with aria-label='Child pages'", () => {
    const root = renderNav(NavCardGrid({ children: [node("Intro", "/docs/intro/")] }));
    expect(root.querySelector('nav[aria-label="Child pages"]')).not.toBeNull();
  });

  it("renders a card for each node with href", () => {
    const root = renderNav(NavCardGrid({ children: [node("Alpha", "/docs/alpha/"), node("Beta", "/docs/beta/")] }));
    expect(root.querySelector('a[href="/docs/alpha/"]')?.textContent).toContain("Alpha");
    expect(root.querySelector('a[href="/docs/beta/"]')?.textContent).toContain("Beta");
  });

  it("renders description with group-hover:underline", () => {
    const root = renderNav(NavCardGrid({ children: [node("Guide", "/docs/guide/", { description: "Learn the basics" })] }));
    expect(root.textContent).toContain("Learn the basics");
    expect(hasClass(root, "group-hover:underline")).toBe(true);
  });

  it("skips nodes without href even if they have children", () => {
    const noHref: NavNode = { label: "Category", hasPage: false, children: [] };
    const root = renderNav(NavCardGrid({ children: [noHref, node("Page", "/docs/page/")] }));
    expect(root.textContent).not.toContain("Category");
    expect(root.querySelector('a[href="/docs/page/"]')?.textContent).toContain("Page");
  });

  it("appends extra CSS class to nav element", () => {
    const root = renderNav(NavCardGrid({ children: [node("X", "/x/")], class: "mt-4" }));
    expect(root.querySelector("nav")?.classList.contains("mt-4")).toBe(true);
  });

  it("renders arrow SVG with text-muted and group-hover:text-accent classes", () => {
    const root = renderNav(NavCardGrid({ children: [node("X", "/x/")] }));
    expect(root.querySelector("svg")).not.toBeNull();
    expect(hasClass(root, "text-muted")).toBe(true);
    expect(hasClass(root, "group-hover:text-accent")).toBe(true);
  });

  it("does not render a bare text-accent class anywhere", () => {
    const root = renderNav(NavCardGrid({ children: [node("X", "/x/", { description: "desc" })] }));
    expect(hasClass(root, "text-accent")).toBe(false);
  });
});
