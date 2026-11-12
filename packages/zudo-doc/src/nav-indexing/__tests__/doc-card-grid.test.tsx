/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, it, expect } from "vitest";
import { DocCardGrid } from "../doc-card-grid.js";
import { hasClass, renderNav } from "./helpers.js";
import type { DocCardItem } from "../doc-card-grid.js";

describe("DocCardGrid", () => {
  it("returns null when items is empty", () => {
    expect(DocCardGrid({ items: [] })).toBeNull();
  });

  it("renders a nav element with default aria-label", () => {
    const root = renderNav(DocCardGrid({ items: [{ href: "/docs/a/", title: "Alpha" }] }));
    expect(root.querySelector('nav[aria-label="Child pages"]')).not.toBeNull();
  });

  it("uses a custom ariaLabel when provided", () => {
    const root = renderNav(DocCardGrid({ items: [{ href: "/docs/a/", title: "A" }], ariaLabel: "Related docs" }));
    expect(root.querySelector('nav[aria-label="Related docs"]')).not.toBeNull();
  });

  it("renders one link per item", () => {
    const items: DocCardItem[] = [
      { href: "/docs/a/", title: "Alpha" },
      { href: "/docs/b/", title: "Beta" },
    ];
    const root = renderNav(DocCardGrid({ items }));
    expect(root.querySelector('a[href="/docs/a/"]')?.textContent).toContain("Alpha");
    expect(root.querySelector('a[href="/docs/b/"]')?.textContent).toContain("Beta");
    expect(root.querySelectorAll("nav > a")).toHaveLength(2);
  });

  it("renders descriptions when present", () => {
    const root = renderNav(DocCardGrid({ items: [{ href: "/docs/a/", title: "Alpha", description: "The first letter" }] }));
    expect(root.textContent).toContain("The first letter");
  });

  it("does not render description span when absent", () => {
    const root = renderNav(DocCardGrid({ items: [{ href: "/docs/a/", title: "Alpha" }] }));
    expect(root.querySelector(".text-small.text-muted")).toBeNull();
  });

  it("appends extra CSS class to nav element", () => {
    const root = renderNav(DocCardGrid({ items: [{ href: "/a/", title: "A" }], class: "mb-8" }));
    expect(root.querySelector("nav")?.classList.contains("mb-8")).toBe(true);
  });

  it("renders the arrow SVG with text-muted and group-hover:text-accent classes", () => {
    const root = renderNav(DocCardGrid({ items: [{ href: "/a/", title: "A" }] }));
    expect(root.querySelector("svg")).not.toBeNull();
    expect(hasClass(root, "text-muted")).toBe(true);
    expect(hasClass(root, "group-hover:text-accent")).toBe(true);
  });

  it("does not render a bare text-accent class anywhere", () => {
    const root = renderNav(DocCardGrid({ items: [{ href: "/a/", title: "A", description: "desc" }] }));
    expect(hasClass(root, "text-accent")).toBe(false);
  });

  it("keeps the one-to-two column default when layout is omitted", () => {
    const root = renderNav(DocCardGrid({ items: [{ href: "/a/", title: "A" }] }));
    const nav = root.querySelector("nav")!;
    expect(nav.className).toBe("grid grid-cols-1 gap-x-hsp-lg gap-y-vsp-md sm:grid-cols-2");
    expect(nav.hasAttribute("data-layout")).toBe(false);
    expect(nav.getAttribute("style")).toBeNull();
  });

  it("uses the available-width layout capped at three columns for layout=auto", () => {
    const root = renderNav(DocCardGrid({ items: [{ href: "/a/", title: "A" }], layout: "auto", class: "extra" }));
    const nav = root.querySelector("nav")!;
    expect(nav.getAttribute("data-layout")).toBe("auto");
    expect(nav.className).toBe("grid gap-x-hsp-lg gap-y-vsp-md extra");
    expect(nav.getAttribute("style")).toContain(
      "repeat(auto-fit, minmax(min(100%, max(18rem, calc((100% - 2 * var(--spacing-hsp-lg)) / 3))), 1fr))",
    );
  });
});
