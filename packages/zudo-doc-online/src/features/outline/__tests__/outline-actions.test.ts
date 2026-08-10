import { describe, expect, it } from "vitest";
import { applyCommand } from "../../../core/outline/index.js";
import {
  describeCategoryDelete,
  describeCommand,
  describePageDelete,
  findPageSummary,
  moveCategoryCommand,
  movePageCommand,
  movePageToCategoryCommand,
  renamedFrontmatter,
  withPageFrontmatter,
} from "../outline-actions.js";
import { buildOutlineTree, findCategoryRow } from "../outline-model.js";
import { testSnapshot } from "./support.js";

const model = () => buildOutlineTree(testSnapshot());

describe("moveCategoryCommand", () => {
  it("targets the neighbouring index", () => {
    const categories = model().categories;
    expect(moveCategoryCommand(categories[1]!, "up")).toEqual({
      type: "move-category",
      categoryId: "cat-beta",
      toIndex: 0,
    });
    expect(moveCategoryCommand(categories[1]!, "down")).toEqual({
      type: "move-category",
      categoryId: "cat-beta",
      toIndex: 2,
    });
  });

  it("returns null at either end instead of an out-of-range index", () => {
    const categories = model().categories;
    expect(moveCategoryCommand(categories[0]!, "up")).toBeNull();
    expect(moveCategoryCommand(categories[2]!, "down")).toBeNull();
  });
});

describe("movePageCommand", () => {
  it("moves a page one slot within its own category", () => {
    const alpha = findCategoryRow(model(), "cat-alpha")!;
    expect(movePageCommand(alpha, alpha.pages[1]!, "down")).toEqual({
      type: "move-page",
      pageId: "page-alpha-one",
      toCategoryId: "cat-alpha",
      toIndex: 2,
    });
  });

  it("returns null at either end", () => {
    const alpha = findCategoryRow(model(), "cat-alpha")!;
    expect(movePageCommand(alpha, alpha.pages[0]!, "up")).toBeNull();
    expect(movePageCommand(alpha, alpha.pages[2]!, "down")).toBeNull();
  });

  it("produces the reorder the outline core actually performs", () => {
    // The command removes the page before re-inserting it, so `fromIndex ± 1`
    // is only correct because of that order — assert against the real core
    // rather than trusting the arithmetic.
    const snapshot = testSnapshot();
    const alpha = findCategoryRow(buildOutlineTree(snapshot), "cat-alpha")!;
    const command = movePageCommand(alpha, alpha.pages[1]!, "down");
    const result = applyCommand(snapshot.outline, command!);

    expect(result.ok).toBe(true);
    expect(
      result.ok
        ? result.doc.categories[0]?.pages.map((page) => page.id)
        : undefined,
    ).toEqual(["page-alpha-index", "page-alpha-two", "page-alpha-one"]);
  });
});

describe("movePageToCategoryCommand", () => {
  it("appends one past the target's last slot", () => {
    expect(
      movePageToCategoryCommand(testSnapshot(), "page-alpha-one", "cat-beta"),
    ).toEqual({
      type: "move-page",
      pageId: "page-alpha-one",
      toCategoryId: "cat-beta",
      toIndex: 1,
    });
  });

  it("appends at index 0 for an empty category, and the core accepts it", () => {
    const snapshot = testSnapshot();
    const command = movePageToCategoryCommand(
      snapshot,
      "page-alpha-one",
      "cat-gamma",
    );
    expect(command).toEqual({
      type: "move-page",
      pageId: "page-alpha-one",
      toCategoryId: "cat-gamma",
      toIndex: 0,
    });

    const result = applyCommand(snapshot.outline, command!);
    expect(result.ok && result.changed).toBe(true);
    expect(
      result.ok ? result.doc.categories[2]?.pages.map((p) => p.id) : undefined,
    ).toEqual(["page-alpha-one"]);
  });

  it("returns null for an unknown target category", () => {
    expect(
      movePageToCategoryCommand(testSnapshot(), "page-alpha-one", "cat-nope"),
    ).toBeNull();
  });
});

describe("delete copy", () => {
  it("names how many pages a category takes with it", () => {
    const tree = model();
    expect(describeCategoryDelete(findCategoryRow(tree, "cat-alpha")!)).toBe(
      "Delete “Alpha” and the 3 pages inside it?",
    );
    expect(describeCategoryDelete(findCategoryRow(tree, "cat-beta")!)).toBe(
      "Delete “Beta” and the 1 page inside it?",
    );
    expect(describeCategoryDelete(findCategoryRow(tree, "cat-gamma")!)).toBe(
      "Delete “Gamma”? It holds no pages.",
    );
  });

  it("names the page for a page delete", () => {
    const alpha = findCategoryRow(model(), "cat-alpha")!;
    expect(describePageDelete(alpha.pages[2]!)).toBe("Delete “Two”?");
  });
});

describe("renamedFrontmatter", () => {
  it("keeps description and draft, which savePage would otherwise erase", () => {
    const snapshot = testSnapshot();
    expect(
      renamedFrontmatter(findPageSummary(snapshot, "page-alpha-index")!, "Start"),
    ).toEqual({
      title: "Start",
      description: "Everything in the alpha section.",
    });
    expect(
      renamedFrontmatter(findPageSummary(snapshot, "page-alpha-two")!, "Second"),
    ).toEqual({ title: "Second", draft: true });
  });
});

describe("withPageFrontmatter", () => {
  it("patches one page and adopts the revision the write reported", () => {
    const snapshot = testSnapshot(4);
    const next = withPageFrontmatter(
      snapshot,
      "page-alpha-one",
      { title: "Renamed" },
      5,
    );

    expect(next.revision).toBe(5);
    expect(findPageSummary(next, "page-alpha-one")).toEqual({
      id: "page-alpha-one",
      slug: "one",
      categoryId: "cat-alpha",
      title: "Renamed",
    });
    // Untouched pages and the outline itself are carried through unchanged.
    expect(next.pages).toHaveLength(snapshot.pages.length);
    expect(next.outline).toBe(snapshot.outline);
    expect(findPageSummary(next, "page-alpha-two")?.title).toBe("Two");
  });

  it("drops a description that the new frontmatter no longer carries", () => {
    const next = withPageFrontmatter(
      testSnapshot(),
      "page-alpha-index",
      { title: "Alpha" },
      9,
    );
    expect(findPageSummary(next, "page-alpha-index")).not.toHaveProperty(
      "description",
    );
  });
});

describe("describeCommand", () => {
  it("names the command for the conflict banner", () => {
    expect(describeCommand({ type: "add-category", title: "New" })).toBe(
      "Add category",
    );
    expect(
      describeCommand({
        type: "move-page",
        pageId: "p",
        toCategoryId: "c",
        toIndex: 0,
      }),
    ).toBe("Move page");
  });
});
