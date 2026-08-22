import { describe, expect, it } from "vitest";
import type { DocPageEntry } from "@takazudo/zudo-doc/doc-page-props";
import { buildNavTree } from "@/utils/docs";

function entry(slug: string, data: Record<string, unknown> = {}): DocPageEntry {
  return { slug, data: { title: slug, ...data }, body: "" } as DocPageEntry;
}

describe("host nav-tree note-tray adapter", () => {
  it("copies note-tray fields from the package SidebarNode", () => {
    const tree = buildNavTree([
      entry("notes/index", {
        category_shape: "note-tray",
        note_tray_dated: true,
        note_tray_sidebar: "month",
      }),
      entry("notes/item", {
        sidebar_position: 1,
        date: "2026-08-22",
        updated: "2026-08-23",
      }),
    ]);
    expect(tree[0]).toMatchObject({
      shape: "note-tray",
      noteTrayDated: true,
      noteTraySidebar: "month",
      children: [{ date: "2026-08-22", updated: "2026-08-23", rank: 1 }],
    });
  });

  it("includes every note-tray field in the content cache key", () => {
    const base = [entry("notes/index"), entry("notes/item")];
    const variants = [
      [entry("notes/index", { category_shape: "note-tray" }), entry("notes/item")],
      [entry("notes/index", { note_tray_dated: true }), entry("notes/item")],
      [entry("notes/index", { note_tray_sidebar: "year" }), entry("notes/item")],
      [entry("notes/index"), entry("notes/item", { date: "2026-08-22" })],
      [entry("notes/index"), entry("notes/item", { updated: "2026-08-23" })],
    ];

    const first = buildNavTree(base);
    for (const docs of variants) {
      expect(buildNavTree(docs)).not.toBe(first);
    }
    expect(variants.map((docs) => buildNavTree(docs)[0])).toMatchObject([
      { shape: "note-tray" },
      { noteTrayDated: true },
      { noteTraySidebar: "year" },
      { children: [{ date: "2026-08-22" }] },
      { children: [{ updated: "2026-08-23" }] },
    ]);
  });
});
