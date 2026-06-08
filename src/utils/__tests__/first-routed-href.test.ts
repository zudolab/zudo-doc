/**
 * Unit tests for `firstRoutedHref()` in `src/utils/docs.ts`.
 *
 * This is the helper that backs CategoryNav's `categories=` mode: a
 * `category_no_page` category has no route of its own, so its card must link to
 * the first routed descendant page instead of a dead `/docs/<slug>/` URL.
 *
 * Regression context: zudolab/zudo-doc#1985 — the claude overview page rendered
 * `<CategoryNav categories={["claude-md","claude-skills","claude-agents"]} />`,
 * and the wrapper fabricated `docsUrl(slug)` hrefs for those noPage categories,
 * producing 3 broken links (`/docs/claude-md/` etc. have no route). These tests
 * lock the "link to first routed child, skip if none" behaviour.
 */

import { describe, it, expect } from "vitest";

import { firstRoutedHref, type NavNode } from "@/utils/docs";

function node(
  partial: Partial<NavNode> & { slug: string; hasPage: boolean },
): NavNode {
  return {
    slug: partial.slug,
    label: partial.label ?? partial.slug,
    position: partial.position ?? 0,
    hasPage: partial.hasPage,
    href: partial.href,
    children: partial.children ?? [],
  };
}

describe("firstRoutedHref", () => {
  it("returns the first routed child's href for a noPage category", () => {
    // Mirrors the real claude-md shape: a routeless category whose first child
    // is the `root` CLAUDE.md page.
    const claudeMd = node({
      slug: "claude-md",
      hasPage: false,
      children: [
        node({ slug: "root", hasPage: true, href: "/docs/claude-md/root/" }),
        node({ slug: "src", hasPage: true, href: "/docs/claude-md/src/" }),
      ],
    });

    expect(firstRoutedHref(claudeMd)).toBe("/docs/claude-md/root/");
  });

  it("prefers the earliest routed child (document order)", () => {
    const cat = node({
      slug: "cat",
      hasPage: false,
      children: [
        node({ slug: "a", hasPage: true, href: "/docs/cat/a/" }),
        node({ slug: "b", hasPage: true, href: "/docs/cat/b/" }),
      ],
    });

    expect(firstRoutedHref(cat)).toBe("/docs/cat/a/");
  });

  it("descends depth-first when the first child is itself routeless", () => {
    const cat = node({
      slug: "cat",
      hasPage: false,
      children: [
        // First child is a noPage subcategory; its leaf is the first routed page.
        node({
          slug: "sub",
          hasPage: false,
          children: [
            node({ slug: "leaf", hasPage: true, href: "/docs/cat/sub/leaf/" }),
          ],
        }),
        node({ slug: "later", hasPage: true, href: "/docs/cat/later/" }),
      ],
    });

    expect(firstRoutedHref(cat)).toBe("/docs/cat/sub/leaf/");
  });

  it("returns undefined when no descendant has a page (card is skipped)", () => {
    const cat = node({
      slug: "cat",
      hasPage: false,
      children: [
        node({ slug: "empty-sub", hasPage: false, children: [] }),
      ],
    });

    expect(firstRoutedHref(cat)).toBeUndefined();
  });

  it("returns undefined for a leaf with no children", () => {
    expect(firstRoutedHref(node({ slug: "x", hasPage: true, children: [] }))).toBeUndefined();
  });

  it("ignores a hasPage child that has no href", () => {
    // hasPage without an href is not a real route — keep descending.
    const cat = node({
      slug: "cat",
      hasPage: false,
      children: [
        node({ slug: "noHref", hasPage: true }),
        node({ slug: "real", hasPage: true, href: "/docs/cat/real/" }),
      ],
    });

    expect(firstRoutedHref(cat)).toBe("/docs/cat/real/");
  });
});
