import { describe, it, expect } from "vitest";
import {
  buildSidebarTree,
  findSidebarNode,
  flattenSidebarTree,
} from "../build-tree.ts";
import type {
  CategoryMeta,
  CollectionEntryLike,
  SidebarFrontmatter,
} from "../types.ts";

type Entry = CollectionEntryLike<SidebarFrontmatter>;

/** Tiny test factory to keep the table-style assertions readable. */
function entry(
  id: string,
  data: Partial<SidebarFrontmatter> = {},
  overrides: Partial<Entry> = {},
): Entry {
  return {
    id,
    data: { title: data.title ?? id, ...data },
    ...overrides,
  };
}

describe("buildSidebarTree", () => {
  it("returns an empty tree when no entries are given", () => {
    expect(buildSidebarTree([], "en")).toEqual([]);
  });

  it("creates a leaf node for a single-segment id", () => {
    const tree = buildSidebarTree(
      [entry("intro", { title: "Intro", sidebar_position: 1 })],
      "en",
    );
    expect(tree).toHaveLength(1);
    expect(tree[0]!.type).toBe("doc");
    expect(tree[0]!.id).toBe("intro");
    expect(tree[0]!.label).toBe("Intro");
    expect(tree[0]!.hasPage).toBe(true);
    expect(tree[0]!.sidebar_position).toBe(1);
  });

  it("derives a slug from the id by stripping a trailing /index", () => {
    const tree = buildSidebarTree(
      [entry("getting-started/index", { title: "Getting Started" })],
      "en",
    );
    expect(tree[0]!.id).toBe("getting-started");
  });

  it("creates nested categories from multi-segment ids", () => {
    const tree = buildSidebarTree(
      [
        entry("guides/intro", { title: "Intro", sidebar_position: 1 }),
        entry("guides/advanced", { title: "Advanced", sidebar_position: 2 }),
      ],
      "en",
    );
    expect(tree).toHaveLength(1);
    const guides = tree[0]!;
    expect(guides.type).toBe("category");
    expect(guides.id).toBe("guides");
    expect(guides.hasPage).toBe(false);
    expect(guides.children.map((c) => c.id)).toEqual([
      "guides/intro",
      "guides/advanced",
    ]);
  });

  it("treats a single-segment id as the category index when children exist", () => {
    const tree = buildSidebarTree(
      [
        entry("guides/index", { title: "Guides Home", sidebar_position: 0 }),
        entry("guides/intro", { title: "Intro", sidebar_position: 1 }),
      ],
      "en",
    );
    const guides = tree[0]!;
    expect(guides.type).toBe("doc"); // has a backing index page
    expect(guides.hasPage).toBe(true);
    expect(guides.label).toBe("Guides Home");
    expect(guides.children).toHaveLength(1);
  });

  it("falls back to Title-Cased segment name for directory-only categories", () => {
    const tree = buildSidebarTree(
      [entry("getting-started/intro", { title: "Intro" })],
      "en",
    );
    const cat = tree[0]!;
    expect(cat.type).toBe("category");
    expect(cat.label).toBe("Getting Started");
  });

  it("prefers sidebar_label over title", () => {
    const tree = buildSidebarTree(
      [
        entry("intro", {
          title: "Long Introduction",
          sidebar_label: "Intro",
        }),
      ],
      "en",
    );
    expect(tree[0]!.label).toBe("Intro");
  });

  it("filters out unlisted and standalone docs by default", () => {
    const tree = buildSidebarTree(
      [
        entry("a", { title: "A" }),
        entry("b", { title: "B", unlisted: true }),
        entry("c", { title: "C", standalone: true }),
      ],
      "en",
    );
    expect(tree.map((n) => n.id)).toEqual(["a"]);
  });

  it("honours a custom isNavVisible predicate", () => {
    const tree = buildSidebarTree(
      [
        entry("a", { title: "A" }),
        entry("b", { title: "B", unlisted: true }),
      ],
      "en",
      { isNavVisible: () => true }, // override: include everything
    );
    expect(tree.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });

  it("sorts siblings by sidebar_position then by id", () => {
    const tree = buildSidebarTree(
      [
        entry("z", { title: "Z", sidebar_position: 1 }),
        entry("a", { title: "A", sidebar_position: 1 }), // tie → alpha
        entry("m", { title: "M", sidebar_position: 0 }),
      ],
      "en",
    );
    expect(tree.map((n) => n.id)).toEqual(["m", "a", "z"]);
  });

  it("respects a category's sortOrder=desc on its children", () => {
    const meta = new Map<string, CategoryMeta>([
      ["log", { sortOrder: "desc", label: "Changelog" }],
    ]);
    const tree = buildSidebarTree(
      [
        entry("log/2025-01", { title: "2025-01", sidebar_position: 1 }),
        entry("log/2025-02", { title: "2025-02", sidebar_position: 2 }),
      ],
      "en",
      { categoryMeta: meta },
    );
    expect(tree[0]!.children.map((c) => c.id)).toEqual([
      "log/2025-02",
      "log/2025-01",
    ]);
    expect(tree[0]!.sortOrder).toBe("desc");
  });

  it("applies category meta (label, position, description, noPage)", () => {
    const meta = new Map<string, CategoryMeta>([
      [
        "guides",
        {
          label: "Guides",
          position: 5,
          description: "Walkthroughs",
          noPage: true,
        },
      ],
    ]);
    const tree = buildSidebarTree(
      [entry("guides/intro", { title: "Intro" })],
      "en",
      { categoryMeta: meta },
    );
    const guides = tree[0]!;
    expect(guides.label).toBe("Guides");
    expect(guides.description).toBe("Walkthroughs");
    expect(guides.sidebar_position).toBe(5);
    // noPage suppresses the href even though children exist
    expect(guides.href).toBeUndefined();
  });

  it("uses the default href builder when none is supplied", () => {
    const tree = buildSidebarTree([entry("intro", { title: "Intro" })], "en");
    expect(tree[0]!.href).toBe("/en/docs/intro/");
  });

  it("calls a custom buildHref for every node with an href", () => {
    const calls: Array<[string, string]> = [];
    const tree = buildSidebarTree(
      [
        entry("intro", { title: "Intro" }),
        entry("guides/a", { title: "A" }),
      ],
      "en",
      {
        buildHref: (slug, locale) => {
          calls.push([slug, locale]);
          return `/x/${locale}/${slug}`;
        },
      },
    );
    expect(tree.find((n) => n.id === "intro")!.href).toBe("/x/en/intro");
    expect(calls).toContainEqual(["intro", "en"]);
    // The directory-only category also gets an href because it has children.
    const guides = tree.find((n) => n.id === "guides")!;
    expect(guides.href).toBe("/x/en/guides");
  });

  it("prefers entry.data.slug, then entry.slug, then derives from id", () => {
    const tree = buildSidebarTree(
      [
        entry("foo/index", { title: "From data.slug", slug: "renamed" }),
        // zfb-style: top-level slug field
        {
          id: "ignored",
          slug: "from-slug",
          data: { title: "From slug" },
        },
        entry("derived/index", { title: "Derived" }),
      ],
      "en",
    );
    const ids = tree.map((n) => n.id).sort();
    expect(ids).toEqual(["derived", "from-slug", "renamed"]);
  });
});

describe("findSidebarNode", () => {
  it("locates a node anywhere in the tree", () => {
    const tree = buildSidebarTree(
      [
        entry("a/b/c", { title: "C" }),
        entry("a/sibling", { title: "Sibling" }),
      ],
      "en",
    );
    expect(findSidebarNode(tree, "a/b/c")?.label).toBe("C");
    expect(findSidebarNode(tree, "a/sibling")?.label).toBe("Sibling");
    expect(findSidebarNode(tree, "missing")).toBeUndefined();
  });
});

describe("flattenSidebarTree", () => {
  it("returns only nodes with a backing page in DFS order", () => {
    const tree = buildSidebarTree(
      [
        entry("a", { title: "A", sidebar_position: 1 }),
        entry("b/c", { title: "BC", sidebar_position: 1 }),
        entry("b/d", { title: "BD", sidebar_position: 2 }),
      ],
      "en",
    );
    expect(flattenSidebarTree(tree).map((n) => n.id)).toEqual([
      "a",
      "b/c",
      "b/d",
    ]);
  });
});
