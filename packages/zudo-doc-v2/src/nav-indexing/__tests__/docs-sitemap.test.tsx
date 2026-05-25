/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, it, expect } from "vitest";
import { DocsSitemap } from "../docs-sitemap";
import { serialize } from "./helpers";
import type { NavNode } from "../types";

function leaf(label: string, href: string, desc?: string): NavNode {
  return { label, href, hasPage: true, children: [], description: desc };
}

function category(label: string, children: NavNode[], href?: string): NavNode {
  return { label, href, hasPage: !!href, children };
}

describe("DocsSitemap", () => {
  it("returns null for empty tree", () => {
    expect(DocsSitemap({ tree: [] })).toBeNull();
  });

  it("renders a details/summary for each top-level node", () => {
    const tree = [
      category("Guide", [leaf("Intro", "/docs/guide/intro/")]),
      category("Reference", [leaf("API", "/docs/ref/api/")]),
    ];
    const html = serialize(DocsSitemap({ tree }));
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    // Two top-level sections
    const detailsCount = (html.match(/<details/g) || []).length;
    expect(detailsCount).toBe(2);
  });

  it("renders flat leaf links inside each section", () => {
    const tree = [
      category("Guide", [
        leaf("Setup", "/docs/guide/setup/"),
        leaf("Config", "/docs/guide/config/"),
      ]),
    ];
    const html = serialize(DocsSitemap({ tree }));
    expect(html).toContain('href="/docs/guide/setup/"');
    expect(html).toContain('href="/docs/guide/config/"');
    expect(html).toContain("Setup");
    expect(html).toContain("Config");
  });

  it("flattens nested leaves depth-first", () => {
    const tree = [
      category("Guide", [
        category("Advanced", [
          leaf("Deep", "/docs/guide/advanced/deep/"),
        ]),
        leaf("Simple", "/docs/guide/simple/"),
      ]),
    ];
    const html = serialize(DocsSitemap({ tree }));
    expect(html).toContain("Deep");
    expect(html).toContain("Simple");
  });

  it("renders category heading as a link when href is set", () => {
    const tree = [
      category("Guide", [leaf("X", "/docs/guide/x/")], "/docs/guide/"),
    ];
    const html = serialize(DocsSitemap({ tree }));
    expect(html).toContain('href="/docs/guide/"');
  });

  it("renders category heading as plain text when href is absent", () => {
    const tree = [category("Reference", [leaf("API", "/docs/ref/api/")])];
    const html = serialize(DocsSitemap({ tree }));
    expect(html).toContain("<span>Reference</span>");
    expect(html).not.toContain('"Reference"');
  });

  it("shows leaf description when present", () => {
    const tree = [
      category("G", [leaf("X", "/x/", "A helpful page")]),
    ];
    const html = serialize(DocsSitemap({ tree }));
    expect(html).toContain("A helpful page");
  });

  it("renders with open attribute on details", () => {
    const tree = [category("G", [leaf("X", "/x/")])];
    const html = serialize(DocsSitemap({ tree }));
    expect(html).toContain(" open");
  });
});
