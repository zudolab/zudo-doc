/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { SiteTreeNavDemo } from "../site-tree-nav-demo.js";
import { hasClass, renderNav } from "./helpers.js";
import type { NavNode } from "../types.js";

function leaf(label: string, href: string, description?: string): NavNode {
  return { label, href, description, hasPage: true, children: [] };
}

function category(label: string, slug: string, children: NavNode[]): NavNode {
  return { label, href: `/docs/${slug}`, hasPage: true, children };
}

describe("SiteTreeNavDemo", () => {
  it("renders parsed details sections, preserves order, and flattens page leaves", () => {
    const root = renderNav(SiteTreeNavDemo({
      ariaLabel: "Documentation index",
      categoryOrder: ["reference", "guide"],
      tree: [
        category("Guide", "guide", [
          { label: "Basics", hasPage: false, children: [leaf("Setup", "/docs/guide/setup", "Install the app")] },
        ]),
        category("Reference", "reference", [leaf("API", "/docs/reference/api")]),
      ],
    }));
    expect(root.querySelector('nav[aria-label="Documentation index"]')).not.toBeNull();
    const sections = Array.from(root.querySelectorAll("details"));
    expect(sections).toHaveLength(2);
    expect(sections[0]?.querySelector("summary a")?.textContent).toBe("Reference");
    expect(sections[1]?.querySelector("summary a")?.textContent).toBe("Guide");
    expect(root.querySelector('a[href="/docs/guide/setup"]')?.textContent).toBe("Setup");
    expect(root.textContent).toContain("Install the app");
    expect(hasClass(root, "zd-hide-details-marker")).toBe(true);
  });

  it("filters ignored categories and returns null when nothing remains", () => {
    const hidden = category("Hidden", "hidden", [leaf("Private", "/docs/hidden/private")]);
    expect(SiteTreeNavDemo({ tree: [hidden], categoryIgnore: ["hidden"] })).toBeNull();
    const root = renderNav(SiteTreeNavDemo({
      tree: [hidden, category("Visible", "visible", [leaf("Public", "/docs/visible/public")])],
      categoryIgnore: ["hidden"],
    }));
    expect(root.textContent).toContain("Visible");
    expect(root.textContent).not.toContain("Private");
  });
});
