import { describe, expect, it } from "vitest";
import {
  assertValidCategoryListOptions,
  isCanonicalCategorySlug,
  resolveCategoryList,
  resolveCategoryListLead,
  type CategoryListNode,
  type CategoryListResolved,
} from "../model.js";
import { rankWidth } from "../../note-tray-model/index.js";

function leaf(slug: string, extra: Partial<CategoryListNode> = {}): CategoryListNode {
  return { slug, label: slug.split("/").at(-1)!, href: `/docs/${slug}/`, hasPage: true, children: [], ...extra };
}

/** A descending dated tray with twelve posts (ranks 12..1 in display order). */
function datedTray(): CategoryListNode {
  const children = Array.from({ length: 12 }, (_, i) => {
    const rank = 12 - i;
    return leaf(`blog/post-${rank}`, {
      label: `Post ${rank}`,
      rank,
      date: `2026-01-${String(rank).padStart(2, "0")}`,
      ...(rank === 12 ? { updated: "2026-02-01", description: "  Latest.  " } : {}),
    });
  });
  return {
    slug: "blog",
    label: "Blog",
    href: "/docs/blog/",
    hasPage: true,
    shape: "note-tray",
    noteTrayDated: true,
    children,
  };
}

const TREE: CategoryListNode[] = [
  datedTray(),
  {
    slug: "notes",
    label: "Notes",
    href: "/docs/notes/",
    hasPage: true,
    shape: "note-tray",
    children: [leaf("notes/a", { rank: 1 }), leaf("notes/b", { rank: 2 }), leaf("notes/c", { rank: 3 })],
  },
  {
    slug: "guides",
    label: "Guides",
    href: "/docs/guides/",
    hasPage: true,
    children: [
      leaf("guides/setup", { label: "Setup", date: "2026-03-01" }),
      {
        // Grouping-only node: no page of its own, auto-index href.
        slug: "guides/advanced",
        label: "Advanced",
        href: "/docs/guides/advanced/",
        hasPage: false,
        children: [
          leaf("guides/advanced/tuning", { label: "Tuning" }),
          {
            // Nested category with a real landing page.
            slug: "guides/advanced/deep",
            label: "Deep",
            href: "/docs/guides/advanced/deep/",
            hasPage: true,
            children: [leaf("guides/advanced/deep/one", { label: "One" })],
          },
        ],
      },
      leaf("guides/deploy", { label: "Deploy", rank: 3 }),
    ],
  },
  // A no-page category: items but no archive.
  {
    slug: "reference",
    label: "Reference",
    hasPage: false,
    children: [leaf("reference/api", { label: "API" })],
  },
  // A category whose documents are all hidden (only its landing page remains).
  { slug: "empty", label: "Empty", href: "/docs/empty/", hasPage: true, children: [] },
];

function ok(result: ReturnType<typeof resolveCategoryList>): CategoryListResolved {
  if (result.status !== "ok") throw new Error(`expected ok, got ${result.status}`);
  return result;
}

describe("resolveCategoryList — note trays", () => {
  it("keeps canonical order and category ranks after the limit (12, 11, 10, 09)", () => {
    const result = ok(resolveCategoryList(TREE, "blog", { limit: 4 }));
    expect(result.items.map((i) => i.rank)).toEqual([12, 11, 10, 9]);
    expect(result.total).toBe(12);
    expect(result.rankWidth).toBe(2);
    expect(result.category).toEqual({ slug: "blog", label: "Blog", href: "/docs/blog/", kind: "note-tray", dated: true });
  });

  it("takes rank width from the whole tray, not the excerpt", () => {
    const big: CategoryListNode = {
      ...datedTray(),
      children: Array.from({ length: 120 }, (_, i) => leaf(`blog/p${i}`, { rank: i + 1 })),
    };
    const result = ok(resolveCategoryList([big], "blog", { limit: 3 }));
    expect(result.rankWidth).toBe(rankWidth(120));
    expect(result.rankWidth).toBe(3);
  });

  it("ignores scope and never flattens nested children of a tray item", () => {
    const tray: CategoryListNode = {
      slug: "t",
      label: "T",
      href: "/docs/t/",
      hasPage: true,
      shape: "note-tray",
      children: [leaf("t/a", { rank: 1, children: [leaf("t/a/x")] })],
    };
    const result = ok(resolveCategoryList([tray], "t", { limit: 10, scope: "descendants" }));
    expect(result.items.map((i) => i.slug)).toEqual(["t/a"]);
  });

  it("trims descriptions and carries dates", () => {
    const [first] = ok(resolveCategoryList(TREE, "blog", { limit: 1 })).items;
    expect(first).toMatchObject({ description: "Latest.", date: "2026-01-12", updated: "2026-02-01" });
  });

  it("an undated tray is not dated", () => {
    expect(ok(resolveCategoryList(TREE, "notes", { limit: 9 })).category.dated).toBe(false);
  });
});

describe("resolveCategoryList — ordinary categories", () => {
  it("lists every real document below the category in tree order by default", () => {
    const result = ok(resolveCategoryList(TREE, "guides", { limit: 10 }));
    expect(result.items.map((i) => i.slug)).toEqual([
      "guides/setup",
      "guides/advanced/tuning",
      "guides/advanced/deep",
      "guides/advanced/deep/one",
      "guides/deploy",
    ]);
    // Grouping-only nodes and the category's own landing page are not items.
    expect(result.items.some((i) => i.slug === "guides" || i.slug === "guides/advanced")).toBe(false);
    expect(result.category.kind).toBe("tree");
    expect(result.rankWidth).toBeUndefined();
  });

  it("never invents ranks for ordinary categories", () => {
    const result = ok(resolveCategoryList(TREE, "guides", { limit: 10 }));
    expect(result.items.every((i) => i.rank === undefined)).toBe(true);
  });

  it("records the subcategory path between the category and the item", () => {
    const result = ok(resolveCategoryList(TREE, "guides", { limit: 10 }));
    const paths = Object.fromEntries(result.items.map((i) => [i.slug, i.path]));
    expect(paths["guides/setup"]).toEqual([]);
    expect(paths["guides/advanced/tuning"]).toEqual(["Advanced"]);
    expect(paths["guides/advanced/deep/one"]).toEqual(["Advanced", "Deep"]);
  });

  it("scope direct lists only direct document children", () => {
    const result = ok(resolveCategoryList(TREE, "guides", { limit: 10, scope: "direct" }));
    expect(result.items.map((i) => i.slug)).toEqual(["guides/setup", "guides/deploy"]);
    expect(result.total).toBe(2);
  });

  it("counts before the limit and never pads", () => {
    const limited = ok(resolveCategoryList(TREE, "guides", { limit: 2 }));
    expect(limited.items).toHaveLength(2);
    expect(limited.total).toBe(5);
    const over = ok(resolveCategoryList(TREE, "guides", { limit: 50 }));
    expect(over.items).toHaveLength(5);
  });

  it("finds nested categories by exact canonical slug", () => {
    const result = ok(resolveCategoryList(TREE, "guides/advanced/deep", { limit: 5 }));
    expect(result.items.map((i) => i.slug)).toEqual(["guides/advanced/deep/one"]);
  });

  it("does not prefix-match a category", () => {
    expect(resolveCategoryList(TREE, "guide", { limit: 5 }).status).toBe("not-found");
    expect(resolveCategoryList(TREE, "blo", { limit: 5 }).status).toBe("not-found");
  });

  it("keeps items when the category has no archive page", () => {
    const result = ok(resolveCategoryList(TREE, "reference", { limit: 5 }));
    expect(result.category.href).toBeUndefined();
    expect(result.items.map((i) => i.slug)).toEqual(["reference/api"]);
  });

  it("a category whose documents are all hidden resolves to an empty list", () => {
    const result = ok(resolveCategoryList(TREE, "empty", { limit: 5, isCategoryIndex: () => true }));
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("targeting a plain document is not-category", () => {
    expect(
      resolveCategoryList(TREE, "guides/setup", { limit: 5, isCategoryIndex: () => false }).status,
    ).toBe("not-category");
  });

  it("resolves canonical tags through tagsFor and deduplicates them", () => {
    const result = ok(
      resolveCategoryList(TREE, "guides", { limit: 1, tagsFor: () => ["a", "b", "a"] }),
    );
    expect(result.items[0]!.tags).toEqual(["a", "b"]);
  });
});

describe("resolveCategoryListLead", () => {
  const tray = ok(resolveCategoryList(TREE, "blog", { limit: 1 })).category;
  const undated = ok(resolveCategoryList(TREE, "notes", { limit: 1 })).category;
  const tree = ok(resolveCategoryList(TREE, "guides", { limit: 1 })).category;

  it("auto follows the source shape", () => {
    expect(resolveCategoryListLead(undefined, tray)).toBe("date");
    expect(resolveCategoryListLead("auto", undated)).toBe("rank");
    expect(resolveCategoryListLead("auto", tree)).toBe("none");
  });

  it("rank on an ordinary category resolves to none", () => {
    expect(resolveCategoryListLead("rank", tree)).toBe("none");
    expect(resolveCategoryListLead("rank", tray)).toBe("rank");
  });

  it("explicit date and none are honored", () => {
    expect(resolveCategoryListLead("date", tree)).toBe("date");
    expect(resolveCategoryListLead("none", tray)).toBe("none");
  });
});

describe("assertValidCategoryListOptions", () => {
  const valid = { category: "blog", limit: 3 };

  it("accepts the minimal and the full option set", () => {
    expect(() => assertValidCategoryListOptions(valid, "x")).not.toThrow();
    expect(() =>
      assertValidCategoryListOptions(
        {
          ...valid,
          layout: "list",
          scope: "direct",
          lead: "rank",
          showDescription: false,
          showDate: true,
          showUpdated: true,
          showTags: true,
          showPath: true,
          showCount: true,
          showArchive: false,
          archiveLabel: "All posts",
        },
        "x",
      ),
    ).not.toThrow();
  });

  it.each([undefined, 0, -1, 1.5, "3", Number.NaN])("rejects limit %j", (limit) => {
    expect(() => assertValidCategoryListOptions({ category: "blog", limit }, "home.sections[1]")).toThrow(
      /home\.sections\[1\]\.limit .*positive integer/,
    );
  });

  it.each(["", "/blog", "blog/", "https://x.test/blog", "a b", "a//b", "../x", 3])(
    "rejects category %j",
    (category) => {
      expect(() => assertValidCategoryListOptions({ category, limit: 1 }, "x")).toThrow(/x\.category/);
    },
  );

  it("rejects discarded and unknown layouts and enum values", () => {
    for (const layout of ["article", "compact", "grid"]) {
      expect(() => assertValidCategoryListOptions({ ...valid, layout }, "x")).toThrow(/x\.layout/);
    }
    expect(() => assertValidCategoryListOptions({ ...valid, scope: "all" }, "x")).toThrow(/x\.scope/);
    expect(() => assertValidCategoryListOptions({ ...valid, lead: "number" }, "x")).toThrow(/x\.lead/);
  });

  it("rejects non-boolean toggles, a non-string label and unknown keys", () => {
    expect(() => assertValidCategoryListOptions({ ...valid, showTags: "yes" }, "x")).toThrow(/x\.showTags/);
    expect(() => assertValidCategoryListOptions({ ...valid, archiveLabel: 1 }, "x")).toThrow(/archiveLabel/);
    expect(() => assertValidCategoryListOptions({ ...valid, sort: "date" }, "x")).toThrow(/unknown key "sort"/);
    expect(() => assertValidCategoryListOptions({ ...valid, type: "x" }, "x", ["type"])).not.toThrow();
  });

  it("isCanonicalCategorySlug accepts nested slugs", () => {
    expect(isCanonicalCategorySlug("guides/layout-demos")).toBe(true);
  });
});
