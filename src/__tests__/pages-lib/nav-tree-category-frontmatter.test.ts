/**
 * nav-tree-category-frontmatter.test.ts
 *
 * Coverage for the category-metadata-via-frontmatter capability on the HOST's
 * own `buildNavTree` (src/utils/docs.ts), parallel to the framework builder
 * tests in packages/zudo-doc/src/sidebar-tree/__tests__/build-tree.test.ts.
 *
 * Asserts the frontmatter-first fallback chains (category_no_page,
 * category_sort_order) and — the subtle correctness point — that a
 * `category_no_page` index.mdx behaves exactly like a `_category_.json` noPage
 * category: hasPage false, no href, and DROPPED from flattenTree so it can
 * never surface as a prev/next pagination target for a route that was excluded.
 */

import { describe, it, expect } from "vitest";
import {
  buildNavTree,
  flattenTree,
  findNode,
  type CategoryMeta,
} from "@/utils/docs";
import type { DocPageEntry } from "@takazudo/zudo-doc/doc-page-props";

function entry(slug: string, data: Partial<DocPageEntry["data"]> = {}): DocPageEntry {
  return {
    slug,
    data: { title: data.title ?? slug, ...data },
    body: "",
    module_specifier: `mdx://docs/${slug}`,
    Content: () => ({ type: "div", props: {}, key: null }),
  };
}

describe("buildNavTree — category frontmatter", () => {
  it("treats a category_no_page index.mdx like a _category_.json noPage category", () => {
    const tree = buildNavTree([
      entry("guides/index", {
        title: "Guides",
        sidebar_label: "Guides",
        sidebar_position: 3,
        category_no_page: true,
      }),
      entry("guides/intro", { title: "Intro" }),
    ]);
    const guides = findNode(tree, "guides")!;
    expect(guides.label).toBe("Guides");
    expect(guides.position).toBe(3);
    expect(guides.href).toBeUndefined();
    expect(guides.hasPage).toBe(false);
  });

  it("drops a category_no_page node from flattenTree (no prev/next 404 target)", () => {
    const tree = buildNavTree([
      entry("guides/index", { title: "Guides", category_no_page: true }),
      entry("guides/intro", { title: "Intro", sidebar_position: 1 }),
      entry("guides/advanced", { title: "Advanced", sidebar_position: 2 }),
    ]);
    const flatSlugs = flattenTree(tree).map((n) => n.slug);
    expect(flatSlugs).not.toContain("guides");
    expect(flatSlugs).toEqual(["guides/intro", "guides/advanced"]);
  });

  it("frontmatter category_no_page wins over a sidecar without noPage", () => {
    const meta = new Map<string, CategoryMeta>([
      ["guides", { label: "Sidecar Label" }],
    ]);
    const tree = buildNavTree(
      [
        entry("guides/index", { title: "Guides", category_no_page: true }),
        entry("guides/intro", { title: "Intro" }),
      ],
      "en",
      meta,
    );
    const guides = findNode(tree, "guides")!;
    expect(guides.href).toBeUndefined();
    expect(guides.hasPage).toBe(false);
  });

  it("respects category_sort_order=desc from index.mdx frontmatter", () => {
    const tree = buildNavTree([
      entry("log/index", { title: "Changelog", category_sort_order: "desc" }),
      entry("log/2025-01", { title: "2025-01", sidebar_position: 1 }),
      entry("log/2025-02", { title: "2025-02", sidebar_position: 2 }),
    ]);
    const log = findNode(tree, "log")!;
    expect(log.children.map((c) => c.slug)).toEqual([
      "log/2025-02",
      "log/2025-01",
    ]);
  });

  it("frontmatter category_sort_order wins over a _category_.json sortOrder", () => {
    const meta = new Map<string, CategoryMeta>([["log", { sortOrder: "asc" }]]);
    const tree = buildNavTree(
      [
        entry("log/index", { title: "Changelog", category_sort_order: "desc" }),
        entry("log/a", { title: "A", sidebar_position: 1 }),
        entry("log/b", { title: "B", sidebar_position: 2 }),
      ],
      "en",
      meta,
    );
    const log = findNode(tree, "log")!;
    expect(log.children.map((c) => c.slug)).toEqual(["log/b", "log/a"]);
  });

  it("a normal category index (no category_no_page) is unaffected", () => {
    const tree = buildNavTree([
      entry("guides/index", { title: "Guides", sidebar_position: 1 }),
      entry("guides/intro", { title: "Intro" }),
    ]);
    const guides = findNode(tree, "guides")!;
    expect(guides.hasPage).toBe(true);
    expect(guides.href).toBeDefined();
    expect(flattenTree(tree).map((n) => n.slug)).toContain("guides");
  });
});
