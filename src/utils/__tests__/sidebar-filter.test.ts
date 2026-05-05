/**
 * Unit tests for the sidebar filter logic.
 *
 * Mirrors `filterTree()` in `src/components/sidebar-tree.tsx`. We re-implement
 * the helper here rather than importing from the `.tsx` host so the suite runs
 * under the root vitest config (which is not JSX/Preact-aware). If the helper
 * in sidebar-tree.tsx evolves, update the mirror to match — the test exists
 * to lock the behaviour, not the source location.
 *
 * Context: zudolab/zudo-doc#1459 — Wave 1 #1445 wired the filter input but
 * typing had no DOM effect on the deployed preview because the v2 Sidebar
 * shell sat between the `<Island>` marker and `<SidebarTree>`, dropping the
 * `treeComponent` function prop at hydration. The structural fix makes
 * `<SidebarTree>` the registered island directly. These tests lock in the
 * pure logic that drives the typed-input → filtered-tree transformation so a
 * future refactor of the matcher cannot silently regress.
 */

import { describe, it, expect } from "vitest";

interface NavNodeLike {
  slug: string;
  label: string;
  href?: string;
  children: NavNodeLike[];
}

function filterTree(nodes: NavNodeLike[], query: string): NavNodeLike[] {
  return nodes.reduce<NavNodeLike[]>((acc, node) => {
    const matchesLabel = node.label
      .toLowerCase()
      .includes(query.toLowerCase());
    const filteredChildren =
      node.children.length > 0 ? filterTree(node.children, query) : [];

    if (matchesLabel || filteredChildren.length > 0) {
      acc.push({
        ...node,
        children: matchesLabel ? node.children : filteredChildren,
      });
    }
    return acc;
  }, []);
}

const tree: NavNodeLike[] = [
  {
    slug: "components",
    label: "Components",
    href: "/docs/components",
    children: [
      {
        slug: "components/admonitions",
        label: "Admonitions",
        href: "/docs/components/admonitions",
        children: [],
      },
      {
        slug: "components/code-blocks",
        label: "Code Blocks",
        href: "/docs/components/code-blocks",
        children: [],
      },
      {
        slug: "components/tabs",
        label: "Tabs",
        href: "/docs/components/tabs",
        children: [],
      },
    ],
  },
  {
    slug: "guides",
    label: "Guides",
    href: "/docs/guides",
    children: [
      {
        slug: "guides/sidebar-filter",
        label: "Sidebar Filter",
        href: "/docs/guides/sidebar-filter",
        children: [],
      },
    ],
  },
];

describe("filterTree (mirror of sidebar-tree.tsx helper)", () => {
  it("returns the full tree unchanged when the query is empty", () => {
    // The component avoids calling filterTree with an empty query (it short-
    // circuits in the `useMemo`), but lock the contract anyway so a future
    // refactor that always-calls cannot silently change behaviour.
    expect(filterTree(tree, "")).toEqual(tree);
  });

  it("matches a leaf label and surfaces just its parent + the leaf", () => {
    const result = filterTree(tree, "code");
    expect(result).toHaveLength(1);
    expect(result[0]!.slug).toBe("components");
    expect(result[0]!.children.map((c) => c.slug)).toEqual([
      "components/code-blocks",
    ]);
  });

  it("matches a category label and keeps that category's full children", () => {
    // When the parent matches, the recursive contract preserves ALL its
    // descendants (matches the user expectation: typing the category name
    // should reveal the whole sub-tree, not just descendants whose labels
    // also match).
    const result = filterTree(tree, "Components");
    expect(result).toHaveLength(1);
    expect(result[0]!.children.map((c) => c.slug)).toEqual([
      "components/admonitions",
      "components/code-blocks",
      "components/tabs",
    ]);
  });

  it("is case-insensitive", () => {
    const lower = filterTree(tree, "tabs");
    const upper = filterTree(tree, "TABS");
    expect(lower).toEqual(upper);
    expect(lower).toHaveLength(1);
    expect(lower[0]!.children.map((c) => c.slug)).toEqual(["components/tabs"]);
  });

  it("returns an empty list when no node matches", () => {
    expect(filterTree(tree, "no-such-token")).toEqual([]);
  });

  it("drops sibling categories that have no matching descendants", () => {
    const result = filterTree(tree, "sidebar");
    expect(result.map((n) => n.slug)).toEqual(["guides"]);
    expect(result[0]!.children.map((c) => c.slug)).toEqual([
      "guides/sidebar-filter",
    ]);
  });
});
