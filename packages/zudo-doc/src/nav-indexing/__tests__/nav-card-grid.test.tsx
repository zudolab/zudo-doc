/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, it, expect } from "vitest";
import { NavCardGrid } from "../nav-card-grid";
import { serialize } from "./helpers";
import type { NavNode } from "../types";

function node(
  label: string,
  href: string,
  opts: Partial<NavNode> = {},
): NavNode {
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
    const child = node("Intro", "/docs/intro/");
    const html = serialize(NavCardGrid({ children: [child] }));
    expect(html).toContain('aria-label="Child pages"');
  });

  it("renders a card for each node with href", () => {
    const children = [
      node("Alpha", "/docs/alpha/"),
      node("Beta", "/docs/beta/"),
    ];
    const html = serialize(NavCardGrid({ children }));
    expect(html).toContain('href="/docs/alpha/"');
    expect(html).toContain("Alpha");
    expect(html).toContain('href="/docs/beta/"');
    expect(html).toContain("Beta");
  });

  it("renders description with group-hover:underline", () => {
    const child = node("Guide", "/docs/guide/", {
      description: "Learn the basics",
    });
    const html = serialize(NavCardGrid({ children: [child] }));
    expect(html).toContain("Learn the basics");
    expect(html).toContain("group-hover:underline");
  });

  it("skips nodes without href even if they have children", () => {
    const noHref: NavNode = {
      label: "Category",
      hasPage: false,
      children: [],
    };
    const withHref = node("Page", "/docs/page/");
    const html = serialize(NavCardGrid({ children: [noHref, withHref] }));
    expect(html).not.toContain("Category");
    expect(html).toContain("Page");
  });

  it("appends extra CSS class to nav element", () => {
    const child = node("X", "/x/");
    const html = serialize(NavCardGrid({ children: [child], class: "mt-4" }));
    expect(html).toContain("mt-4");
  });

  it("renders arrow SVG with text-accent class", () => {
    const child = node("X", "/x/");
    const html = serialize(NavCardGrid({ children: [child] }));
    expect(html).toContain("text-accent");
    expect(html).toContain("<svg");
  });
});
