/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, it, expect } from "vitest";
import { DocCardGrid } from "../doc-card-grid";
import { serialize } from "./helpers";
import type { DocCardItem } from "../doc-card-grid";

describe("DocCardGrid", () => {
  it("returns null when items is empty", () => {
    expect(DocCardGrid({ items: [] })).toBeNull();
  });

  it("renders a nav element with default aria-label", () => {
    const items: DocCardItem[] = [{ href: "/docs/a/", title: "Alpha" }];
    const html = serialize(DocCardGrid({ items }));
    expect(html).toContain('<nav aria-label="Child pages"');
  });

  it("uses a custom ariaLabel when provided", () => {
    const items: DocCardItem[] = [{ href: "/docs/a/", title: "A" }];
    const html = serialize(DocCardGrid({ items, ariaLabel: "Related docs" }));
    expect(html).toContain('aria-label="Related docs"');
  });

  it("renders one link per item", () => {
    const items: DocCardItem[] = [
      { href: "/docs/a/", title: "Alpha" },
      { href: "/docs/b/", title: "Beta" },
    ];
    const html = serialize(DocCardGrid({ items }));
    expect(html).toContain('href="/docs/a/"');
    expect(html).toContain('href="/docs/b/"');
    expect(html).toContain("Alpha");
    expect(html).toContain("Beta");
  });

  it("renders descriptions when present", () => {
    const items: DocCardItem[] = [
      {
        href: "/docs/a/",
        title: "Alpha",
        description: "The first letter",
      },
    ];
    const html = serialize(DocCardGrid({ items }));
    expect(html).toContain("The first letter");
  });

  it("does not render description span when absent", () => {
    const items: DocCardItem[] = [{ href: "/docs/a/", title: "Alpha" }];
    const html = serialize(DocCardGrid({ items }));
    // description span uses text-muted class
    expect(html).not.toContain("text-small text-muted");
  });

  it("appends extra CSS class to nav element", () => {
    const items: DocCardItem[] = [{ href: "/a/", title: "A" }];
    const html = serialize(DocCardGrid({ items, class: "mb-8" }));
    expect(html).toContain("mb-8");
  });

  it("renders the arrow SVG with text-accent class", () => {
    const items: DocCardItem[] = [{ href: "/a/", title: "A" }];
    const html = serialize(DocCardGrid({ items }));
    expect(html).toContain("text-accent");
    expect(html).toContain("<svg");
  });
});
