/**
 * Unit tests for the sidebar filter logic.
 *
 * Imports the real `filterTree()` production implementation (extracted from
 * `sidebar-tree-island/index.tsx` in zudolab/zudo-doc#2528 — the tests used to
 * mirror this helper by hand against a dead `src/components/sidebar-tree.tsx`
 * host component; both the dead component and the hand-rolled mirror are gone
 * now that the real function is importable and JSX-free).
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
import type { SidebarNavNode } from "../../sidebar/types.js";
import { filterTree } from "../index.js";

const tree: SidebarNavNode[] = [
  {
    slug: "components",
    label: "Components",
    position: 0,
    href: "/docs/components",
    hasPage: true,
    children: [
      {
        slug: "components/admonitions",
        label: "Admonitions",
        position: 0,
        href: "/docs/components/admonitions",
        hasPage: true,
        children: [],
      },
      {
        slug: "components/code-blocks",
        label: "Code Blocks",
        position: 1,
        href: "/docs/components/code-blocks",
        hasPage: true,
        children: [],
      },
      {
        slug: "components/tabs",
        label: "Tabs",
        position: 2,
        href: "/docs/components/tabs",
        hasPage: true,
        children: [],
      },
    ],
  },
  {
    slug: "guides",
    label: "Guides",
    position: 1,
    href: "/docs/guides",
    hasPage: true,
    children: [
      {
        slug: "guides/sidebar-filter",
        label: "Sidebar Filter",
        position: 0,
        href: "/docs/guides/sidebar-filter",
        hasPage: true,
        children: [],
      },
    ],
  },
];

describe("filterTree", () => {
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
