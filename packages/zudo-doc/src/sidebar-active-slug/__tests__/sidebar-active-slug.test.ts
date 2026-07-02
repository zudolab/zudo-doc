/**
 * Unit tests for the sidebar active-slug derivation helpers.
 *
 * Imports the real `findActiveSlug()` / `normalizePath()` production
 * implementation (extracted from `sidebar-tree-island/index.tsx` in
 * zudolab/zudo-doc#2528). These cover the pure logic that drives
 * `<SidebarTree>`'s hydration-time fallback: when the parent island wrapper
 * does not forward the SSR-supplied `currentSlug` through its prop boundary,
 * the hook seeds initial state by matching the current URL pathname against
 * the in-tree node hrefs.
 *
 * The suite used to mirror these helpers by hand against a dead
 * `src/components/sidebar-tree.tsx` host component; both the dead component
 * and the hand-rolled mirror are gone now that the real functions are
 * importable without pulling in JSX/Preact.
 */

import { describe, it, expect } from "vitest";
import type { SidebarNavNode } from "../../sidebar/types.js";
import { findActiveSlug, normalizePath } from "../index.js";

const tree: SidebarNavNode[] = [
  {
    slug: "guides",
    label: "Guides",
    position: 0,
    href: "/ja/docs/guides",
    hasPage: true,
    children: [
      {
        slug: "guides/sub-a",
        label: "Sub A",
        position: 0,
        href: "/ja/docs/guides/sub-a",
        hasPage: true,
        children: [
          {
            slug: "guides/sub-a/page-1",
            label: "Page 1",
            position: 0,
            href: "/ja/docs/guides/sub-a/page-1",
            hasPage: true,
            children: [],
          },
          {
            slug: "guides/sub-a/page-2",
            label: "Page 2",
            position: 1,
            href: "/ja/docs/guides/sub-a/page-2",
            hasPage: true,
            children: [],
          },
        ],
      },
      {
        slug: "guides/sub-b",
        label: "Sub B",
        position: 1,
        href: "/ja/docs/guides/sub-b",
        hasPage: true,
        children: [],
      },
    ],
  },
];

describe("findActiveSlug", () => {
  it("returns the slug for an exact pathname match on a leaf", () => {
    expect(findActiveSlug(tree, "/ja/docs/guides/sub-a/page-1")).toBe(
      "guides/sub-a/page-1",
    );
  });

  it("returns the slug for an exact pathname match on a category", () => {
    expect(findActiveSlug(tree, "/ja/docs/guides/sub-a")).toBe(
      "guides/sub-a",
    );
  });

  it("normalises a trailing slash before matching (deep path)", () => {
    // Sidebar URLs in the rendered HTML may carry a trailing slash; the hook
    // calls normalizePath() before delegating into findActiveSlug, so this
    // mirror test pre-normalises to match the contract.
    const pathname = normalizePath("/ja/docs/guides/sub-a/page-1/");
    expect(findActiveSlug(tree, pathname)).toBe("guides/sub-a/page-1");
  });

  it("returns undefined when the pathname is not in the tree", () => {
    expect(findActiveSlug(tree, "/ja/docs/unknown/page")).toBeUndefined();
  });

  it("returns undefined for an empty tree (hydration with no nodes)", () => {
    // Guards the fallback path: if the parent island hydrates `<SidebarTree>`
    // with `nodes=[]`, the URL-derivation gracefully reports no active slug
    // rather than throwing.
    expect(findActiveSlug([], "/ja/docs/guides/sub-a/page-1")).toBeUndefined();
  });
});
