import { beforeAll, describe, expect, it } from "vitest";
import type { ProjectSnapshot } from "../../../store/index";
import {
  buildEditorTree,
  buildMovePageCommand,
  countTreePages,
  findTreePage,
  knownPageIds,
  overlayPageMeta,
  pageFileName,
  pagePath,
} from "../page-index";
import { INSTALLATION_ID, THEMING_ID, createEditorTestStore } from "./support";

let snapshot: ProjectSnapshot;

beforeAll(async () => {
  snapshot = await createEditorTestStore().loadSnapshot();
});

describe("buildEditorTree", () => {
  it("joins outline structure with frontmatter titles and draft flags", () => {
    const tree = buildEditorTree(snapshot);
    const installation = findTreePage(tree, INSTALLATION_ID);

    expect(tree.map((category) => category.title)).toEqual([
      "Getting started",
      "Guides",
      "Reference",
    ]);
    expect(installation).toMatchObject({
      title: "Installation",
      description: "Prerequisites, install commands, and the first run.",
      draft: true,
      categorySlug: "getting-started",
      position: 3,
      categorySize: 4,
    });
  });

  it("falls back to the slug for a PageRef with no matching summary", () => {
    const orphaned: ProjectSnapshot = { ...snapshot, pages: [] };
    const page = findTreePage(buildEditorTree(orphaned), INSTALLATION_ID);
    expect(page?.title).toBe("installation");
    expect(page?.draft).toBe(false);
  });

  it("counts and indexes every page", () => {
    const tree = buildEditorTree(snapshot);
    expect(countTreePages(tree)).toBe(14);
    expect(knownPageIds(tree).has(THEMING_ID)).toBe(true);
    expect(knownPageIds(tree).has("page-that-never-was")).toBe(false);
  });
});

describe("overlayPageMeta", () => {
  it("prefers an open session's live frontmatter over the snapshot", () => {
    const tree = buildEditorTree(snapshot);
    const overlaid = overlayPageMeta(
      tree,
      new Map([[INSTALLATION_ID, { title: "Setting up", draft: false }]]),
    );

    expect(findTreePage(overlaid, INSTALLATION_ID)).toMatchObject({
      title: "Setting up",
      draft: false,
      description: "",
    });
    // Untouched pages keep their identity so memoized children can skip work.
    expect(findTreePage(overlaid, THEMING_ID)).toBe(findTreePage(tree, THEMING_ID));
  });

  it("returns the same tree when nothing is open", () => {
    const tree = buildEditorTree(snapshot);
    expect(overlayPageMeta(tree, new Map())).toBe(tree);
  });
});

describe("path helpers", () => {
  it("renders the URL path and the on-disk file name", () => {
    const page = findTreePage(buildEditorTree(snapshot), INSTALLATION_ID);
    expect(page && pagePath(page)).toBe("getting-started/installation");
    expect(page && pageFileName(page)).toBe("installation.mdx");
  });
});

describe("buildMovePageCommand", () => {
  const page = () => {
    const found = findTreePage(buildEditorTree(snapshot), INSTALLATION_ID);
    if (!found) throw new Error("fixture page missing");
    return found;
  };

  it("converts a 1-based position into a 0-based outline command", () => {
    expect(buildMovePageCommand(page(), 1)).toEqual({
      type: "move-page",
      pageId: INSTALLATION_ID,
      toCategoryId: "cat-getting-started",
      toIndex: 0,
    });
  });

  it("clamps an out-of-range position instead of rejecting it", () => {
    expect(buildMovePageCommand(page(), 99)?.toIndex).toBe(3);
    expect(buildMovePageCommand(page(), -4)?.toIndex).toBe(0);
  });

  it("returns null for a no-op or unparseable position", () => {
    expect(buildMovePageCommand(page(), 3)).toBeNull();
    expect(buildMovePageCommand(page(), Number.NaN)).toBeNull();
  });
});
