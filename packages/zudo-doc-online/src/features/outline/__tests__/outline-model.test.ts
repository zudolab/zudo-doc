import { describe, expect, it } from "vitest";
import {
  buildOutlineTree,
  findCategoryRow,
  listMoveTargets,
  pageMetaFromSnapshot,
} from "../outline-model.js";
import { testSnapshot } from "./support.js";

describe("pageMetaFromSnapshot", () => {
  it("carries title, description and draft, and omits absent optionals", () => {
    const meta = pageMetaFromSnapshot(testSnapshot());
    expect(meta).toContainEqual({
      id: "page-alpha-index",
      title: "Alpha",
      description: "Everything in the alpha section.",
    });
    expect(meta).toContainEqual({ id: "page-alpha-one", title: "One" });
    expect(meta).toContainEqual({
      id: "page-alpha-two",
      title: "Two",
      draft: true,
    });
  });
});

describe("buildOutlineTree", () => {
  it("titles pages from the composed frontmatter, not from their slug", () => {
    const model = buildOutlineTree(testSnapshot());
    const alpha = findCategoryRow(model, "cat-alpha");
    expect(alpha?.pages.map((page) => page.title)).toEqual([
      "Alpha",
      "One",
      "Two",
    ]);
  });

  it("marks the first and last rows as un-movable in that direction", () => {
    const model = buildOutlineTree(testSnapshot());

    expect(model.categories.map((category) => category.canMoveUp)).toEqual([
      false,
      true,
      true,
    ]);
    expect(model.categories.map((category) => category.canMoveDown)).toEqual([
      true,
      true,
      false,
    ]);

    const pages = findCategoryRow(model, "cat-alpha")?.pages ?? [];
    expect(pages.map((page) => page.canMoveUp)).toEqual([false, true, true]);
    expect(pages.map((page) => page.canMoveDown)).toEqual([true, true, false]);
  });

  it("derives the top page from the categories rather than storing one", () => {
    const model = buildOutlineTree(testSnapshot());
    expect(model.topPage).toEqual({
      title: "Test Project",
      path: "/docs",
      categoryCount: 3,
      pageCount: 4,
    });
    // A derived top page is never an outline node.
    expect(
      model.categories.some((category) => category.id === "top-page"),
    ).toBe(false);
  });

  it("keeps draft pages in the projection and counts them", () => {
    const model = buildOutlineTree(testSnapshot());
    const alpha = findCategoryRow(model, "cat-alpha");
    expect(alpha?.draftCount).toBe(1);
    expect(alpha?.pages.find((page) => page.id === "page-alpha-two")?.draft).toBe(
      true,
    );
  });

  it("gives the index page the category's own path", () => {
    const model = buildOutlineTree(testSnapshot());
    const alpha = findCategoryRow(model, "cat-alpha");
    expect(alpha?.path).toBe("/docs/alpha");
    expect(alpha?.pages[0]).toMatchObject({ isIndex: true, path: "/docs/alpha" });
    expect(alpha?.pages[1]).toMatchObject({
      isIndex: false,
      path: "/docs/alpha/one",
    });
  });

  it("honours a custom base path", () => {
    const model = buildOutlineTree(testSnapshot(), { basePath: "/handbook" });
    expect(model.topPage.path).toBe("/handbook");
    expect(findCategoryRow(model, "cat-beta")?.path).toBe("/handbook/beta");
  });
});

describe("listMoveTargets", () => {
  it("excludes the page's current parent", () => {
    const targets = listMoveTargets(testSnapshot(), "page-alpha-one");
    expect(targets.map((target) => target.categoryId)).toEqual([
      "cat-beta",
      "cat-gamma",
    ]);
    expect(targets.every((target) => target.disabledReason === null)).toBe(true);
  });

  it("lists — but disables — a category that already uses the page's slug", () => {
    const targets = listMoveTargets(testSnapshot(), "page-alpha-index");
    expect(targets).toEqual([
      {
        categoryId: "cat-beta",
        title: "Beta",
        slug: "beta",
        disabledReason: "Already has a page at “index”",
      },
      {
        categoryId: "cat-gamma",
        title: "Gamma",
        slug: "gamma",
        disabledReason: null,
      },
    ]);
  });

  it("returns nothing for a page that is not in the outline", () => {
    expect(listMoveTargets(testSnapshot(), "page-missing")).toEqual([]);
  });
});

describe("findCategoryRow", () => {
  it("returns null for the whole-site scope and for an unknown id", () => {
    const model = buildOutlineTree(testSnapshot());
    expect(findCategoryRow(model, null)).toBeNull();
    expect(findCategoryRow(model, "cat-missing")).toBeNull();
  });
});
