import { describe, expect, it } from "vitest";

import { applyCommand } from "../commands";
import { MAX_SLUG_BYTES } from "../slugs";
import type { OutlineCommand, OutlineDoc } from "../types";
import {
  deepFreeze,
  expectFail,
  expectOk,
  pageIds,
  pageSlugs,
  sequentialIds,
  testDoc,
} from "./support";

const createId = sequentialIds;

describe("add-category", () => {
  it("appends a category with a derived slug and selects it", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "add-category", title: "  How To Guides  " },
        { createId: createId() },
      ),
    );

    expect(result.changed).toBe(true);
    expect(result.selectedId).toBe("category-1");
    const added = result.doc.categories.at(-1);
    expect(added).toEqual({
      id: "category-1",
      slug: "how-to-guides",
      title: "How To Guides",
      pages: [],
    });
  });

  it("uses an explicit slug verbatim", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "add-category", title: "How To Guides", slug: "howto" },
        { createId: createId() },
      ),
    );
    expect(result.doc.categories.at(-1)?.slug).toBe("howto");
  });

  it("dedupes a derived slug against existing categories", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "add-category", title: "Alpha" },
        { createId: createId() },
      ),
    );
    expect(result.doc.categories.at(-1)?.slug).toBe("alpha-2");
  });

  it("rejects an empty title", () => {
    expect(
      expectFail(applyCommand(testDoc(), { type: "add-category", title: "  " }))
        .code,
    ).toBe("invalid-title");
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "add-category",
          title: 7,
        } as unknown as OutlineCommand),
      ).code,
    ).toBe("invalid-title");
  });

  it("rejects an explicit slug that is already taken", () => {
    const failure = expectFail(
      applyCommand(testDoc(), {
        type: "add-category",
        title: "Another",
        slug: "alpha",
      }),
    );
    expect(failure.code).toBe("slug-conflict");
  });

  it("reports each slug validation problem with its own code", () => {
    const cases: Array<[string, string]> = [
      ["", "slug-empty"],
      ["a".repeat(MAX_SLUG_BYTES + 1), "slug-too-long"],
      ["café", "slug-not-normalized"],
      ["Intro", "slug-not-lowercase"],
      ["a/b", "slug-invalid-characters"],
    ];
    for (const [slug, code] of cases) {
      const failure = expectFail(
        applyCommand(testDoc(), { type: "add-category", title: "X", slug }),
      );
      expect(failure.code, slug).toBe(code);
    }
  });
});

describe("rename-category", () => {
  it("changes the title and leaves the slug alone", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "rename-category", categoryId: "cat-a", title: "  Renamed  " },
        { selectedId: "page-a2" },
      ),
    );
    expect(result.changed).toBe(true);
    expect(result.doc.categories[0]?.title).toBe("Renamed");
    expect(result.doc.categories[0]?.slug).toBe("alpha");
    expect(result.selectedId).toBe("page-a2");
  });

  it("is a no-op when the title is unchanged", () => {
    const doc = testDoc();
    const result = expectOk(
      applyCommand(doc, {
        type: "rename-category",
        categoryId: "cat-a",
        title: "Alpha",
      }),
    );
    expect(result.changed).toBe(false);
    expect(result.doc).toBe(doc);
  });

  it("rejects an unknown category", () => {
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "rename-category",
          categoryId: "nope",
          title: "X",
        }),
      ).code,
    ).toBe("category-not-found");
  });

  it("rejects an empty title", () => {
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "rename-category",
          categoryId: "cat-a",
          title: "",
        }),
      ).code,
    ).toBe("invalid-title");
  });
});

describe("remove-category", () => {
  it("removes the category and its pages", () => {
    const result = expectOk(
      applyCommand(testDoc(), { type: "remove-category", categoryId: "cat-a" }),
    );
    expect(result.changed).toBe(true);
    expect(result.doc.categories.map((category) => category.id)).toEqual([
      "cat-b",
      "cat-c",
    ]);
  });

  it("repairs a selection that pointed at the removed category", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "remove-category", categoryId: "cat-a" },
        { selectedId: "cat-a" },
      ),
    );
    expect(result.selectedId).toBe("cat-b");
  });

  it("repairs a selection that pointed at a page inside the removed category", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "remove-category", categoryId: "cat-a" },
        { selectedId: "page-a2" },
      ),
    );
    expect(result.selectedId).toBe("cat-b");
  });

  it("falls back to the previous category when the last one goes", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "remove-category", categoryId: "cat-c" },
        { selectedId: "cat-c" },
      ),
    );
    expect(result.selectedId).toBe("cat-b");
  });

  it("clears the selection when the outline empties out", () => {
    let doc = testDoc();
    for (const categoryId of ["cat-a", "cat-b"]) {
      doc = expectOk(applyCommand(doc, { type: "remove-category", categoryId }))
        .doc;
    }
    const result = expectOk(
      applyCommand(
        doc,
        { type: "remove-category", categoryId: "cat-c" },
        { selectedId: "cat-c" },
      ),
    );
    expect(result.doc.categories).toEqual([]);
    expect(result.selectedId).toBeNull();
  });

  it("leaves an unrelated selection alone", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "remove-category", categoryId: "cat-c" },
        { selectedId: "page-a1" },
      ),
    );
    expect(result.selectedId).toBe("page-a1");
  });

  it("rejects an unknown category", () => {
    expect(
      expectFail(
        applyCommand(testDoc(), { type: "remove-category", categoryId: "nope" }),
      ).code,
    ).toBe("category-not-found");
  });
});

describe("move-category", () => {
  it("moves a category to a new index", () => {
    const result = expectOk(
      applyCommand(testDoc(), {
        type: "move-category",
        categoryId: "cat-a",
        toIndex: 2,
      }),
    );
    expect(result.doc.categories.map((category) => category.id)).toEqual([
      "cat-b",
      "cat-c",
      "cat-a",
    ]);
  });

  it("is a no-op when the index is unchanged", () => {
    const doc = testDoc();
    const result = expectOk(
      applyCommand(doc, {
        type: "move-category",
        categoryId: "cat-a",
        toIndex: 0,
      }),
    );
    expect(result.changed).toBe(false);
    expect(result.doc).toBe(doc);
  });

  it("rejects indices outside the list", () => {
    for (const toIndex of [-1, 3, 1.5, Number.NaN]) {
      expect(
        expectFail(
          applyCommand(testDoc(), {
            type: "move-category",
            categoryId: "cat-a",
            toIndex,
          }),
        ).code,
        String(toIndex),
      ).toBe("index-out-of-range");
    }
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "move-category",
          categoryId: "cat-a",
          toIndex: "1",
        } as unknown as OutlineCommand),
      ).code,
    ).toBe("index-out-of-range");
  });

  it("rejects an unknown category", () => {
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "move-category",
          categoryId: "nope",
          toIndex: 0,
        }),
      ).code,
    ).toBe("category-not-found");
  });
});

describe("add-page", () => {
  it("appends a page, selects it, and echoes the title back as meta", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "add-page", categoryId: "cat-a", title: "Quick Start" },
        { createId: createId() },
      ),
    );

    expect(result.changed).toBe(true);
    expect(result.selectedId).toBe("page-1");
    expect(pageIds(result.doc, "cat-a")).toEqual([
      "page-a1",
      "page-a2",
      "page-a3",
      "page-1",
    ]);
    expect(result.meta?.createdPage).toEqual({
      id: "page-1",
      slug: "quick-start",
      title: "Quick Start",
    });
  });

  it("never stores the title on the page itself", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "add-page", categoryId: "cat-a", title: "Quick Start" },
        { createId: createId() },
      ),
    );
    expect(Object.keys(result.doc.categories[0]?.pages.at(-1) ?? {}).sort()).toEqual(
      ["id", "slug"],
    );
  });

  it("dedupes a derived slug within the category only", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "add-page", categoryId: "cat-a", title: "One" },
        { createId: createId() },
      ),
    );
    expect(pageSlugs(result.doc, "cat-a")).toEqual([
      "one",
      "two",
      "three",
      "one-2",
    ]);
  });

  it("allows a slug that is only taken in a different category", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "add-page", categoryId: "cat-b", title: "One" },
        { createId: createId() },
      ),
    );
    expect(pageSlugs(result.doc, "cat-b")).toEqual(["solo", "one"]);
  });

  it("adopts an explicitly supplied page id", () => {
    const result = expectOk(
      applyCommand(testDoc(), {
        type: "add-page",
        categoryId: "cat-a",
        title: "Imported",
        pageId: "page-imported",
      }),
    );
    expect(result.selectedId).toBe("page-imported");
  });

  it("rejects a blank explicit page id", () => {
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "add-page",
          categoryId: "cat-a",
          title: "X",
          pageId: "   ",
        }),
      ).code,
    ).toBe("invalid-page-id");
  });

  it("rejects an explicit page id that is already used by a page or a category", () => {
    for (const pageId of ["page-b1", "cat-b"]) {
      expect(
        expectFail(
          applyCommand(testDoc(), {
            type: "add-page",
            categoryId: "cat-a",
            title: "X",
            pageId,
          }),
        ).code,
        pageId,
      ).toBe("page-id-conflict");
    }
  });

  it("rejects an explicit slug already used in the same category", () => {
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "add-page",
          categoryId: "cat-a",
          title: "X",
          slug: "two",
        }),
      ).code,
    ).toBe("slug-conflict");
  });

  it("rejects an unknown category and an empty title", () => {
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "add-page",
          categoryId: "nope",
          title: "X",
        }),
      ).code,
    ).toBe("category-not-found");
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "add-page",
          categoryId: "cat-a",
          title: "",
        }),
      ).code,
    ).toBe("invalid-title");
  });

  it("mints an id through the default factory when none is injected", () => {
    const result = expectOk(
      applyCommand(testDoc(), {
        type: "add-page",
        categoryId: "cat-a",
        title: "Defaulted",
      }),
    );
    expect(result.selectedId).toMatch(/^page-[0-9a-f-]{36}$/);
  });
});

describe("set-page-slug", () => {
  it("changes the slug and keeps the selection", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "set-page-slug", pageId: "page-a2", slug: "second" },
        { selectedId: "page-a2" },
      ),
    );
    expect(pageSlugs(result.doc, "cat-a")).toEqual(["one", "second", "three"]);
    expect(result.selectedId).toBe("page-a2");
  });

  it("is a no-op when the slug already matches", () => {
    const doc = testDoc();
    const result = expectOk(
      applyCommand(doc, { type: "set-page-slug", pageId: "page-a2", slug: "two" }),
    );
    expect(result.changed).toBe(false);
    expect(result.doc).toBe(doc);
  });

  it("rejects a slug used by a sibling", () => {
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "set-page-slug",
          pageId: "page-a2",
          slug: "three",
        }),
      ).code,
    ).toBe("slug-conflict");
  });

  it("allows a slug that is only taken in another category", () => {
    const result = expectOk(
      applyCommand(testDoc(), {
        type: "set-page-slug",
        pageId: "page-a2",
        slug: "solo",
      }),
    );
    expect(pageSlugs(result.doc, "cat-a")).toEqual(["one", "solo", "three"]);
  });

  it("rejects an invalid slug with a specific code", () => {
    const cases: Array<[string, string]> = [
      ["", "slug-empty"],
      ["a".repeat(MAX_SLUG_BYTES + 1), "slug-too-long"],
      ["café", "slug-not-normalized"],
      ["Two", "slug-not-lowercase"],
      ["a b", "slug-invalid-characters"],
    ];
    for (const [slug, code] of cases) {
      expect(
        expectFail(
          applyCommand(testDoc(), {
            type: "set-page-slug",
            pageId: "page-a2",
            slug,
          }),
        ).code,
        slug,
      ).toBe(code);
    }
  });

  it("rejects an unknown page", () => {
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "set-page-slug",
          pageId: "nope",
          slug: "x",
        }),
      ).code,
    ).toBe("page-not-found");
  });
});

describe("remove-page", () => {
  it("removes the page", () => {
    const result = expectOk(
      applyCommand(testDoc(), { type: "remove-page", pageId: "page-a2" }),
    );
    expect(result.changed).toBe(true);
    expect(pageIds(result.doc, "cat-a")).toEqual(["page-a1", "page-a3"]);
  });

  it("selects the following sibling", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "remove-page", pageId: "page-a2" },
        { selectedId: "page-a2" },
      ),
    );
    expect(result.selectedId).toBe("page-a3");
  });

  it("selects the preceding sibling when the last page goes", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "remove-page", pageId: "page-a3" },
        { selectedId: "page-a3" },
      ),
    );
    expect(result.selectedId).toBe("page-a2");
  });

  it("falls back to the parent category when the only page goes", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "remove-page", pageId: "page-b1" },
        { selectedId: "page-b1" },
      ),
    );
    expect(result.selectedId).toBe("cat-b");
  });

  it("leaves an unrelated selection alone", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        { type: "remove-page", pageId: "page-a2" },
        { selectedId: "cat-b" },
      ),
    );
    expect(result.selectedId).toBe("cat-b");
  });

  it("rejects an unknown page", () => {
    expect(
      expectFail(
        applyCommand(testDoc(), { type: "remove-page", pageId: "nope" }),
      ).code,
    ).toBe("page-not-found");
  });
});

describe("move-page", () => {
  it("reorders within a category", () => {
    const result = expectOk(
      applyCommand(testDoc(), {
        type: "move-page",
        pageId: "page-a1",
        toCategoryId: "cat-a",
        toIndex: 2,
      }),
    );
    expect(pageIds(result.doc, "cat-a")).toEqual([
      "page-a2",
      "page-a3",
      "page-a1",
    ]);
  });

  it("moves across parents and keeps the selection", () => {
    const result = expectOk(
      applyCommand(
        testDoc(),
        {
          type: "move-page",
          pageId: "page-a2",
          toCategoryId: "cat-b",
          toIndex: 0,
        },
        { selectedId: "page-a2" },
      ),
    );
    expect(pageIds(result.doc, "cat-a")).toEqual(["page-a1", "page-a3"]);
    expect(pageIds(result.doc, "cat-b")).toEqual(["page-a2", "page-b1"]);
    expect(result.selectedId).toBe("page-a2");
  });

  it("appends past the last index of a different category", () => {
    const result = expectOk(
      applyCommand(testDoc(), {
        type: "move-page",
        pageId: "page-a2",
        toCategoryId: "cat-b",
        toIndex: 1,
      }),
    );
    expect(pageIds(result.doc, "cat-b")).toEqual(["page-b1", "page-a2"]);
  });

  it("moves into an empty category", () => {
    const result = expectOk(
      applyCommand(testDoc(), {
        type: "move-page",
        pageId: "page-a2",
        toCategoryId: "cat-c",
        toIndex: 0,
      }),
    );
    expect(pageIds(result.doc, "cat-c")).toEqual(["page-a2"]);
  });

  it("is a no-op when the page is already at that index", () => {
    const doc = testDoc();
    const result = expectOk(
      applyCommand(doc, {
        type: "move-page",
        pageId: "page-a2",
        toCategoryId: "cat-a",
        toIndex: 1,
      }),
    );
    expect(result.changed).toBe(false);
    expect(result.doc).toBe(doc);
  });

  it("rejects an index past the end of the destination", () => {
    // Within a category the page vacates its slot, so 3 is one too far.
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "move-page",
          pageId: "page-a1",
          toCategoryId: "cat-a",
          toIndex: 3,
        }),
      ).code,
    ).toBe("index-out-of-range");
    // Across categories the destination grows by one, so 2 is one too far.
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "move-page",
          pageId: "page-a1",
          toCategoryId: "cat-b",
          toIndex: 2,
        }),
      ).code,
    ).toBe("index-out-of-range");
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "move-page",
          pageId: "page-a1",
          toCategoryId: "cat-a",
          toIndex: -1,
        }),
      ).code,
    ).toBe("index-out-of-range");
  });

  it("refuses a cross-parent move that would collide on slug", () => {
    const doc = expectOk(
      applyCommand(testDoc(), {
        type: "set-page-slug",
        pageId: "page-b1",
        slug: "two",
      }),
    ).doc;
    const failure = expectFail(
      applyCommand(doc, {
        type: "move-page",
        pageId: "page-a2",
        toCategoryId: "cat-b",
        toIndex: 0,
      }),
    );
    expect(failure.code).toBe("slug-conflict");
  });

  it("rejects an unknown page or destination", () => {
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "move-page",
          pageId: "nope",
          toCategoryId: "cat-a",
          toIndex: 0,
        }),
      ).code,
    ).toBe("page-not-found");
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "move-page",
          pageId: "page-a1",
          toCategoryId: "nope",
          toIndex: 0,
        }),
      ).code,
    ).toBe("category-not-found");
  });
});

describe("reorder-pages", () => {
  it("applies a new order", () => {
    const result = expectOk(
      applyCommand(testDoc(), {
        type: "reorder-pages",
        categoryId: "cat-a",
        orderedPageIds: ["page-a3", "page-a1", "page-a2"],
      }),
    );
    expect(pageIds(result.doc, "cat-a")).toEqual([
      "page-a3",
      "page-a1",
      "page-a2",
    ]);
    expect(pageSlugs(result.doc, "cat-a")).toEqual(["three", "one", "two"]);
  });

  it("is a no-op when the order is unchanged", () => {
    const doc = testDoc();
    const result = expectOk(
      applyCommand(doc, {
        type: "reorder-pages",
        categoryId: "cat-a",
        orderedPageIds: ["page-a1", "page-a2", "page-a3"],
      }),
    );
    expect(result.changed).toBe(false);
    expect(result.doc).toBe(doc);
  });

  it("rejects anything that is not an exact permutation", () => {
    const rejected: unknown[] = [
      ["page-a1", "page-a2"],
      ["page-a1", "page-a2", "page-a3", "page-b1"],
      ["page-a1", "page-a1", "page-a2"],
      ["page-a1", "page-a2", "page-b1"],
      ["page-a1", "page-a2", 3],
      "page-a1",
      null,
    ];
    for (const orderedPageIds of rejected) {
      expect(
        expectFail(
          applyCommand(testDoc(), {
            type: "reorder-pages",
            categoryId: "cat-a",
            orderedPageIds,
          } as unknown as OutlineCommand),
        ).code,
        JSON.stringify(orderedPageIds),
      ).toBe("invalid-page-order");
    }
  });

  it("rejects an unknown category", () => {
    expect(
      expectFail(
        applyCommand(testDoc(), {
          type: "reorder-pages",
          categoryId: "nope",
          orderedPageIds: [],
        }),
      ).code,
    ).toBe("category-not-found");
  });
});

describe("replace-doc", () => {
  const replacement: OutlineDoc = {
    schemaVersion: 1,
    projectTitle: "Replaced",
    categories: [
      { id: "cat-a", slug: "alpha", title: "Alpha", pages: [] },
      {
        id: "cat-z",
        slug: "zeta",
        title: "Zeta",
        pages: [{ id: "page-z1", slug: "only" }],
      },
    ],
  };

  it("replaces the outline wholesale", () => {
    const result = expectOk(
      applyCommand(testDoc(), { type: "replace-doc", doc: replacement }),
    );
    expect(result.changed).toBe(true);
    expect(result.doc.projectTitle).toBe("Replaced");
    expect(result.doc.categories.map((category) => category.id)).toEqual([
      "cat-a",
      "cat-z",
    ]);
  });

  it("keeps a selection that survives and clears one that does not", () => {
    expect(
      expectOk(
        applyCommand(
          testDoc(),
          { type: "replace-doc", doc: replacement },
          { selectedId: "cat-a" },
        ),
      ).selectedId,
    ).toBe("cat-a");
    expect(
      expectOk(
        applyCommand(
          testDoc(),
          { type: "replace-doc", doc: replacement },
          { selectedId: "page-a2" },
        ),
      ).selectedId,
    ).toBeNull();
  });

  it("is a no-op when the payload is logically identical", () => {
    const doc = testDoc();
    const shuffled = JSON.parse(
      JSON.stringify({
        categories: doc.categories,
        projectTitle: doc.projectTitle,
        schemaVersion: doc.schemaVersion,
      }),
    ) as OutlineDoc;
    const result = expectOk(
      applyCommand(doc, { type: "replace-doc", doc: shuffled }),
    );
    expect(result.changed).toBe(false);
    expect(result.doc).toBe(doc);
  });

  it("normalizes the payload, dropping stray fields and trimming titles", () => {
    const messy = {
      schemaVersion: 1,
      projectTitle: "  Trimmed  ",
      extra: "ignored",
      categories: [
        {
          id: "cat-a",
          slug: "alpha",
          title: "  Alpha  ",
          collapsed: true,
          pages: [{ id: "page-a1", slug: "one", title: "leaked" }],
        },
      ],
    } as unknown as OutlineDoc;

    const result = expectOk(
      applyCommand(testDoc(), { type: "replace-doc", doc: messy }),
    );
    expect(result.doc).toEqual({
      schemaVersion: 1,
      projectTitle: "Trimmed",
      categories: [
        {
          id: "cat-a",
          slug: "alpha",
          title: "Alpha",
          pages: [{ id: "page-a1", slug: "one" }],
        },
      ],
    });
  });

  it("accepts the same page slug in two different categories", () => {
    const shared: OutlineDoc = {
      schemaVersion: 1,
      projectTitle: "Shared",
      categories: [
        {
          id: "cat-a",
          slug: "alpha",
          title: "Alpha",
          pages: [{ id: "page-1", slug: "index" }],
        },
        {
          id: "cat-b",
          slug: "beta",
          title: "Beta",
          pages: [{ id: "page-2", slug: "index" }],
        },
      ],
    };
    expect(
      expectOk(applyCommand(testDoc(), { type: "replace-doc", doc: shared }))
        .changed,
    ).toBe(true);
  });

  it("rejects every kind of malformed payload", () => {
    const rejected: unknown[] = [
      null,
      "outline",
      [],
      { schemaVersion: 2, projectTitle: "X", categories: [] },
      { projectTitle: "X", categories: [] },
      { schemaVersion: 1, projectTitle: "  ", categories: [] },
      { schemaVersion: 1, projectTitle: "X", categories: {} },
      { schemaVersion: 1, projectTitle: "X", categories: ["nope"] },
      { schemaVersion: 1, projectTitle: "X", categories: [{ slug: "a", title: "A", pages: [] }] },
      {
        schemaVersion: 1,
        projectTitle: "X",
        categories: [{ id: "c1", slug: "a", title: "", pages: [] }],
      },
      {
        schemaVersion: 1,
        projectTitle: "X",
        categories: [{ id: "c1", slug: "Bad", title: "A", pages: [] }],
      },
      {
        schemaVersion: 1,
        projectTitle: "X",
        categories: [{ id: "c1", slug: "a", title: "A" }],
      },
      {
        schemaVersion: 1,
        projectTitle: "X",
        categories: [
          { id: "c1", slug: "a", title: "A", pages: [] },
          { id: "c1", slug: "b", title: "B", pages: [] },
        ],
      },
      {
        schemaVersion: 1,
        projectTitle: "X",
        categories: [
          { id: "c1", slug: "a", title: "A", pages: [] },
          { id: "c2", slug: "a", title: "B", pages: [] },
        ],
      },
      {
        schemaVersion: 1,
        projectTitle: "X",
        categories: [{ id: "c1", slug: "a", title: "A", pages: [null] }],
      },
      {
        schemaVersion: 1,
        projectTitle: "X",
        categories: [{ id: "c1", slug: "a", title: "A", pages: [{ slug: "p" }] }],
      },
      {
        schemaVersion: 1,
        projectTitle: "X",
        categories: [
          { id: "c1", slug: "a", title: "A", pages: [{ id: "p1", slug: "P" }] },
        ],
      },
      {
        schemaVersion: 1,
        projectTitle: "X",
        categories: [
          {
            id: "c1",
            slug: "a",
            title: "A",
            pages: [
              { id: "p1", slug: "same" },
              { id: "p2", slug: "same" },
            ],
          },
        ],
      },
      {
        schemaVersion: 1,
        projectTitle: "X",
        categories: [
          { id: "shared", slug: "a", title: "A", pages: [{ id: "shared", slug: "p" }] },
        ],
      },
    ];

    for (const doc of rejected) {
      const failure = expectFail(
        applyCommand(testDoc(), {
          type: "replace-doc",
          doc,
        } as unknown as OutlineCommand),
      );
      expect(failure.code, JSON.stringify(doc)).toBe("invalid-doc");
    }
  });
});

describe("command dispatch", () => {
  it("has no rename-page command", () => {
    const failure = expectFail(
      applyCommand(testDoc(), {
        type: "rename-page",
        pageId: "page-a1",
        title: "Nope",
      } as unknown as OutlineCommand),
    );
    expect(failure.code).toBe("unknown-command");
  });

  it("rejects anything that is not a command object", () => {
    for (const command of [null, "add-category", 7, []]) {
      expect(
        expectFail(applyCommand(testDoc(), command as unknown as OutlineCommand))
          .code,
        JSON.stringify(command),
      ).toBe("unknown-command");
    }
  });

  it("returns a failure instead of throwing on a non-JSON-safe outline", () => {
    const cyclic = testDoc() as OutlineDoc & { self?: unknown };
    cyclic.self = cyclic;
    const failure = expectFail(
      applyCommand(cyclic, { type: "add-category", title: "X" }),
    );
    expect(failure.code).toBe("invalid-doc");
  });
});

describe("purity", () => {
  it("never mutates the outline it was handed", () => {
    const frozen = deepFreeze(testDoc());
    const commands: OutlineCommand[] = [
      { type: "add-category", title: "New" },
      { type: "rename-category", categoryId: "cat-a", title: "Changed" },
      { type: "remove-category", categoryId: "cat-a" },
      { type: "move-category", categoryId: "cat-a", toIndex: 2 },
      { type: "add-page", categoryId: "cat-a", title: "New Page" },
      { type: "set-page-slug", pageId: "page-a1", slug: "renamed" },
      { type: "remove-page", pageId: "page-a1" },
      {
        type: "move-page",
        pageId: "page-a1",
        toCategoryId: "cat-b",
        toIndex: 0,
      },
      {
        type: "reorder-pages",
        categoryId: "cat-a",
        orderedPageIds: ["page-a3", "page-a2", "page-a1"],
      },
    ];

    for (const command of commands) {
      const result = expectOk(applyCommand(frozen, command));
      expect(result.changed, command.type).toBe(true);
      expect(result.doc, command.type).not.toBe(frozen);
    }

    expect(frozen).toEqual(testDoc());
  });
});
