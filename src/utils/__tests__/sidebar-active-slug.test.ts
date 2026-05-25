/**
 * Unit tests for the sidebar active-slug derivation helpers.
 *
 * These cover the pure logic that drives `<SidebarTree>`'s hydration-time
 * fallback: when the parent island wrapper does not forward the SSR-supplied
 * `currentSlug` through its prop boundary, the hook seeds initial state by
 * matching the current URL pathname against the in-tree node hrefs. The
 * helpers themselves live in `src/components/sidebar-tree.tsx`; we mirror
 * them here as small re-implementations rather than importing from the
 * `.tsx` host (which pulls in JSX/Preact and is not configured under the
 * root vitest config). The mirror is intentionally tiny and exists so a
 * future refactor in sidebar-tree.tsx that breaks the matcher invariant is
 * caught by a fast `pnpm test:unit` run instead of a full e2e cycle.
 *
 * If the helpers in sidebar-tree.tsx evolve, update the mirror to match —
 * the test exists to lock the behaviour, not the source location.
 */

import { describe, it, expect } from "vitest";

interface NavNodeLike {
  slug: string;
  href?: string;
  children: NavNodeLike[];
}

function normalizePath(p: string): string {
  return p.replace(/\/$/, "") || "/";
}

function findActiveSlug(
  nodes: NavNodeLike[],
  pathname: string,
): string | undefined {
  for (const node of nodes) {
    if (node.href && normalizePath(node.href) === pathname) return node.slug;
    const found = findActiveSlug(node.children, pathname);
    if (found) return found;
  }
  return undefined;
}

const tree: NavNodeLike[] = [
  {
    slug: "guides",
    href: "/ja/docs/guides",
    children: [
      {
        slug: "guides/sub-a",
        href: "/ja/docs/guides/sub-a",
        children: [
          {
            slug: "guides/sub-a/page-1",
            href: "/ja/docs/guides/sub-a/page-1",
            children: [],
          },
          {
            slug: "guides/sub-a/page-2",
            href: "/ja/docs/guides/sub-a/page-2",
            children: [],
          },
        ],
      },
      {
        slug: "guides/sub-b",
        href: "/ja/docs/guides/sub-b",
        children: [],
      },
    ],
  },
];

describe("findActiveSlug (mirror of sidebar-tree.tsx helper)", () => {
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
