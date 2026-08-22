import {
  formatDate,
  formatYearMonth,
  parseIsoDate,
  type IsoDateParts,
} from "../format-date/index.js";

export { formatDate, parseIsoDate };
export type { IsoDateParts };

export type NoteTrayOrder = "asc" | "desc";
export type NoteTrayGrouping = "year" | "month";

/** Minimal structural node accepted by every note-tray consumer. */
export interface NoteTrayNode {
  slug: string;
  shape?: "note-tray";
  hasPage?: boolean;
  sortOrder?: NoteTrayOrder;
  rank?: number;
  date?: string;
  children: NoteTrayNode[];
}

export interface NoteTrayGroup<T extends NoteTrayNode = NoteTrayNode> {
  key: string;
  items: T[];
}

export function findNoteTray<T extends NoteTrayNode>(
  tree: readonly T[],
  slug: string,
): T | undefined {
  for (const node of tree) {
    if (node.slug === slug && node.shape === "note-tray") return node;
    const found = findNoteTray(node.children as T[], slug);
    if (found) return found;
  }
  return undefined;
}

/** Find the tray whose slug is the longest prefix of a page slug. */
export function findContainingNoteTray<T extends NoteTrayNode>(
  tree: readonly T[],
  pageSlug: string,
): T | undefined {
  let found: T | undefined;
  const visit = (nodes: readonly T[]): void => {
    for (const node of nodes) {
      if (
        node.shape === "note-tray" &&
        (pageSlug === node.slug || pageSlug.startsWith(`${node.slug}/`)) &&
        (!found || node.slug.length > found.slug.length)
      ) {
        found = node;
      }
      visit(node.children as T[]);
    }
  };
  visit(tree);
  return found;
}

/** Direct routed children are the items in a valid (flat) tray. */
export function getNoteTrayItems<T extends NoteTrayNode>(tray: T): T[] {
  return (tray.children as T[]).filter((item) => item.hasPage !== false);
}

/** Rank labels use at least two digits: 01..99, then widen with item count. */
export function rankWidth(itemsOrCount: readonly unknown[] | number): number {
  const count = typeof itemsOrCount === "number" ? itemsOrCount : itemsOrCount.length;
  return Math.max(2, String(Math.max(0, count)).length);
}

export function yearKey(iso: string): string {
  const parts = parseIsoDate(iso);
  return parts ? String(parts.year).padStart(4, "0") : "";
}

export function yearMonthKey(iso: string): string {
  const parts = parseIsoDate(iso);
  return parts
    ? `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}`
    : "";
}

export function formatYearMonthLabel(isoOrKey: string, locale: string): string {
  return formatYearMonth(isoOrKey, locale);
}

/** Group dated items chronologically and keep rank order within each group. */
export function groupItems<T extends NoteTrayNode>(
  items: readonly T[],
  grouping: NoteTrayGrouping,
  order: NoteTrayOrder,
): NoteTrayGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    if (!item.date) continue;
    const key = grouping === "year" ? yearKey(item.date) : yearMonthKey(item.date);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const direction = order === "desc" ? -1 : 1;
  return [...groups.entries()]
    .sort(([a], [b]) => direction * a.localeCompare(b))
    .map(([key, group]) => ({
      key,
      items: group.sort(
        (a, b) => direction * ((a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER)),
      ),
    }));
}
