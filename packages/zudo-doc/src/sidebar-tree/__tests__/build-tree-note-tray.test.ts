import { describe, expect, it } from "vitest";
import { buildSidebarTree } from "../build-tree.js";
import type { CollectionEntryLike, SidebarFrontmatter } from "../types.js";

function entry(
  slug: string,
  data: Partial<SidebarFrontmatter> = {},
): CollectionEntryLike {
  return { slug, data: { title: slug, ...data } };
}

describe("buildSidebarTree note-tray fields", () => {
  const docs = [
    entry("notes/index", {
      title: "Notes",
      category_shape: "note-tray",
      note_tray_dated: true,
      note_tray_sidebar: "month",
    }),
    entry("notes/alpha", { sidebar_position: 1, date: "2026-01-01" }),
    entry("notes/bravo", {
      sidebar_position: 2,
      date: "2026-02-02",
      updated: "2026-02-03",
    }),
  ];

  it("copies tray and item fields and assigns ascending ranks", () => {
    const tray = buildSidebarTree(docs, "en")[0]!;
    expect(tray).toMatchObject({
      shape: "note-tray",
      noteTrayDated: true,
      noteTraySidebar: "month",
    });
    expect(tray.children).toMatchObject([
      { id: "notes/alpha", rank: 1, date: "2026-01-01" },
      { id: "notes/bravo", rank: 2, date: "2026-02-02", updated: "2026-02-03" },
    ]);
  });

  it("keeps rank tied to ascending position when display order is descending", () => {
    const descending = docs.map((doc) =>
      doc.slug === "notes/index"
        ? { ...doc, data: { ...doc.data, category_sort_order: "desc" as const } }
        : doc,
    );
    const children = buildSidebarTree(descending, "en")[0]!.children;
    expect(children.map(({ id, rank }) => [id, rank])).toEqual([
      ["notes/bravo", 2],
      ["notes/alpha", 1],
    ]);
  });
});
