/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, it, expect } from "vitest";
import { DocsSitemap } from "../docs-sitemap.js";
import { hasClass, renderNav } from "./helpers.js";
import type { NavNode } from "../types.js";

function leaf(label: string, href: string, description?: string): NavNode {
  return { label, href, hasPage: true, children: [], description };
}

function category(label: string, children: NavNode[], href?: string): NavNode {
  return { label, href, hasPage: !!href, children };
}

describe("DocsSitemap", () => {
  it("returns null for empty tree", () => {
    expect(DocsSitemap({ tree: [] })).toBeNull();
  });

  it("renders a details/summary for each top-level node", () => {
    const root = renderNav(DocsSitemap({ tree: [
      category("Guide", [leaf("Intro", "/docs/guide/intro/")]),
      category("Reference", [leaf("API", "/docs/ref/api/")]),
    ] }));
    expect(root.querySelectorAll("details")).toHaveLength(2);
    expect(root.querySelectorAll("summary")).toHaveLength(2);
    expect(root.querySelectorAll("details[open]")).toHaveLength(2);
  });

  it("renders flat leaf links inside each section", () => {
    const root = renderNav(DocsSitemap({ tree: [category("Guide", [
      leaf("Setup", "/docs/guide/setup/"),
      leaf("Config", "/docs/guide/config/"),
    ])] }));
    expect(root.querySelector('a[href="/docs/guide/setup/"]')?.textContent).toBe("Setup");
    expect(root.querySelector('a[href="/docs/guide/config/"]')?.textContent).toBe("Config");
  });

  it("flattens nested leaves depth-first", () => {
    const root = renderNav(DocsSitemap({ tree: [category("Guide", [
      category("Advanced", [leaf("Deep", "/docs/guide/advanced/deep/")]),
      leaf("Simple", "/docs/guide/simple/"),
    ])] }));
    const links = Array.from(root.querySelectorAll("details a[href]")).map((link) => link.textContent);
    expect(links).toEqual(["Deep", "Simple"]);
  });

  it("renders category heading as a link when href is set", () => {
    const root = renderNav(DocsSitemap({ tree: [category("Guide", [leaf("X", "/docs/guide/x/")], "/docs/guide/")] }));
    expect(root.querySelector('summary a[href="/docs/guide/"]')?.textContent).toBe("Guide");
  });

  it("renders category heading as plain text when href is absent", () => {
    const root = renderNav(DocsSitemap({ tree: [category("Reference", [leaf("API", "/docs/ref/api/")])] }));
    expect(root.querySelector("summary > span:last-child")?.textContent).toBe("Reference");
    expect(root.querySelector('summary a[href]')).toBeNull();
  });

  it("shows leaf description when present", () => {
    const root = renderNav(DocsSitemap({ tree: [category("G", [leaf("X", "/x/", "A helpful page")])] }));
    expect(root.textContent).toContain("A helpful page");
  });

  it("keeps leaf and category heading links on text-fg with no bare text-accent or underline token", () => {
    const root = renderNav(DocsSitemap({ tree: [category("Guide", [leaf("Setup", "/docs/guide/setup/")], "/docs/guide/")] }));
    expect(hasClass(root, "text-accent")).toBe(false);
    expect(hasClass(root, "underline")).toBe(false);
    expect(hasClass(root, "hover:text-accent")).toBe(true);
    expect(hasClass(root, "hover:underline")).toBe(true);
    expect(hasClass(root, "focus:underline")).toBe(true);
    expect(hasClass(root, "focus-visible:text-accent")).toBe(true);
    expect(hasClass(root, "focus-visible:underline")).toBe(true);
    expect(hasClass(root, "zd-hide-details-marker")).toBe(true);
    expect(root.querySelector("summary a")?.className).toContain("hover:text-accent");
    expect(root.querySelector("details li a")?.className).toContain("focus-visible:underline");
  });
});
