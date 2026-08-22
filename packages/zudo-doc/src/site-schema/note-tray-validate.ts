import { parseIsoDate } from "../format-date/index.js";
import { toRouteSlug } from "../slug/index.js";
import type { DocEntryLike, DocNavNode } from "./types.js";

interface Violation {
  rule: string;
  slug: string;
  detail: string;
}

function entrySlug(entry: DocEntryLike): string {
  return entry.data.slug ?? toRouteSlug(entry.slug);
}

function findNode(tree: readonly DocNavNode[], slug: string): DocNavNode | undefined {
  for (const node of tree) {
    if (node.slug === slug) return node;
    const found = findNode(node.children, slug);
    if (found) return found;
  }
  return undefined;
}

function isCategoryIndexEntry(entry: DocEntryLike): boolean {
  return entry.slug === "index" || entry.slug.endsWith("/index");
}

/**
 * Validate note-tray declarations against both the visible nav tree and the
 * effective merged collection. The latter is essential: unlisted children do
 * not appear in `tree`, but still belong to a tray and must obey its contract.
 */
export function validateNoteTrays(
  tree: readonly DocNavNode[],
  docs: readonly DocEntryLike[],
): void {
  const violations: Violation[] = [];
  const trays = docs.filter((doc) => doc.data.category_shape === "note-tray");

  for (const tray of trays) {
    const slug = entrySlug(tray);
    const node = findNode(tree, slug);

    if (!slug || slug.includes("/")) {
      violations.push({
        rule: "a",
        slug: slug || "index",
        detail: "category_shape is only allowed on top-level categories",
      });
    }

    if (!isCategoryIndexEntry(tray)) {
      violations.push({
        rule: "a",
        slug,
        detail: "a note tray must be declared by a category index.mdx",
      });
    }

    if (
      tray.data.category_no_page === true ||
      tray.data.unlisted === true ||
      tray.data.standalone === true ||
      !node ||
      node.hasPage === false
    ) {
      violations.push({
        rule: "e",
        slug,
        detail: "a note-tray index must be a visible routed page",
      });
    }

    if (
      (tray.data.note_tray_sidebar === "year" ||
        tray.data.note_tray_sidebar === "month") &&
      tray.data.note_tray_dated !== true
    ) {
      violations.push({
        rule: "d",
        slug,
        detail: `${tray.data.note_tray_sidebar} grouping requires note_tray_dated: true`,
      });
    }

    const prefix = `${slug}/`;
    const children = docs.filter((doc) => entrySlug(doc).startsWith(prefix));
    for (const child of children) {
      const childSlug = entrySlug(child);
      const relative = childSlug.slice(prefix.length);
      const childNode = findNode(tree, childSlug);
      if (
        relative.includes("/") ||
        isCategoryIndexEntry(child) ||
        (childNode?.children.length ?? 0) > 0
      ) {
        violations.push({
          rule: "b",
          slug: childSlug,
          detail: `note-tray children must be flat leaf files (tray: ${slug})`,
        });
      }
      if (tray.data.note_tray_dated === true && !child.data.date) {
        violations.push({
          rule: "c",
          slug: childSlug,
          detail: `dated note-tray children require date (tray: ${slug})`,
        });
      }
    }
  }

  for (const doc of docs) {
    const slug = entrySlug(doc) || "index";
    for (const field of ["date", "updated"] as const) {
      const value = doc.data[field];
      if (typeof value === "string" && !parseIsoDate(value)) {
        violations.push({
          rule: "f",
          slug,
          detail: `${field} is not a calendar-valid YYYY-MM-DD value: ${value}`,
        });
      }
    }
  }

  if (violations.length > 0) {
    const lines = violations
      .sort((a, b) => a.slug.localeCompare(b.slug) || a.rule.localeCompare(b.rule))
      .map(({ rule, slug, detail }) => `- [${rule}] ${slug}: ${detail}`);
    throw new Error(`Invalid note-tray configuration:\n${lines.join("\n")}`);
  }
}
