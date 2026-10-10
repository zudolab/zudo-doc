import type { ResolvedDateFormats } from "../settings.js";
import type { SidebarNavNode } from "../sidebar/types.js";

export interface SiteTreeNavIslandProps {
  tree: SidebarNavNode[];
  categoryOrder: string[];
  categoryIgnore?: string[];
  ariaLabel?: string;
  locale: string;
  dateFormats: ResolvedDateFormats;
}

/**
 * Copy the host nav payload through the island's finite JSON shape. Optional
 * fields are added only when present, so neither node records nor top-level
 * props carry own `undefined` values across SSR and hydration.
 */
export function normalizeSiteTreeNavProps(
  input: SiteTreeNavIslandProps,
): SiteTreeNavIslandProps {
  const tree = normalizeNodeArray(input.tree, new Set());
  const normalized: SiteTreeNavIslandProps = {
    tree,
    categoryOrder: normalizeStringArray(input.categoryOrder, "categoryOrder"),
    locale: requireString(input.locale, "locale"),
    dateFormats: normalizeDateFormats(input.dateFormats),
  };

  if (input.categoryIgnore !== undefined) {
    normalized.categoryIgnore = normalizeStringArray(
      input.categoryIgnore,
      "categoryIgnore",
    );
  }
  if (input.ariaLabel !== undefined) {
    normalized.ariaLabel = requireString(input.ariaLabel, "ariaLabel");
  }

  return normalized;
}

function normalizeNodeArray(
  nodes: SidebarNavNode[],
  ancestors: Set<object>,
): SidebarNavNode[] {
  if (!Array.isArray(nodes)) {
    throw new TypeError("[zudo-doc] SiteTreeNav island tree must be an array.");
  }
  return Array.from(nodes, (node) => normalizeNode(node, ancestors));
}

function normalizeNode(
  node: SidebarNavNode,
  ancestors: Set<object>,
): SidebarNavNode {
  if (
    typeof node !== "object" ||
    node === null ||
    Array.isArray(node) ||
    (Object.getPrototypeOf(node) !== Object.prototype &&
      Object.getPrototypeOf(node) !== null)
  ) {
    throw new TypeError("[zudo-doc] SiteTreeNav island node must be a plain object.");
  }
  if (ancestors.has(node)) {
    throw new TypeError("[zudo-doc] SiteTreeNav island tree must not contain cycles.");
  }
  if (typeof node.slug !== "string" || typeof node.label !== "string") {
    throw new TypeError("[zudo-doc] SiteTreeNav island node slug and label must be strings.");
  }
  if (typeof node.hasPage !== "boolean") {
    throw new TypeError("[zudo-doc] SiteTreeNav island node hasPage must be boolean.");
  }
  if (!Array.isArray(node.children)) {
    throw new TypeError("[zudo-doc] SiteTreeNav island node children must be an array.");
  }
  if (!Number.isFinite(node.position)) {
    throw new TypeError("[zudo-doc] SiteTreeNav island node position must be finite.");
  }
  if (node.rank !== undefined && !Number.isFinite(node.rank)) {
    throw new TypeError("[zudo-doc] SiteTreeNav island node rank must be finite.");
  }

  ancestors.add(node);
  try {
    const normalized: SidebarNavNode = {
      slug: node.slug,
      label: node.label,
      position: node.position,
      hasPage: node.hasPage,
      children: normalizeNodeArray(node.children, ancestors),
    };

    if (node.description !== undefined) {
      normalized.description = requireString(node.description, "description");
    }
    if (node.href !== undefined) normalized.href = requireString(node.href, "href");
    if (node.sortOrder !== undefined) {
      if (node.sortOrder !== "asc" && node.sortOrder !== "desc") {
        throw new TypeError("[zudo-doc] SiteTreeNav island node sortOrder is invalid.");
      }
      normalized.sortOrder = node.sortOrder;
    }
    if (node.collapsed !== undefined) {
      normalized.collapsed = requireBoolean(node.collapsed, "collapsed");
    }
    if (node.shape !== undefined) {
      if (node.shape !== "note-tray") {
        throw new TypeError("[zudo-doc] SiteTreeNav island node shape is invalid.");
      }
      normalized.shape = node.shape;
    }
    if (node.noteTrayDated !== undefined) {
      normalized.noteTrayDated = requireBoolean(node.noteTrayDated, "noteTrayDated");
    }
    if (node.noteTraySidebar !== undefined) {
      if (
        node.noteTraySidebar !== "index" &&
        node.noteTraySidebar !== "year" &&
        node.noteTraySidebar !== "month"
      ) {
        throw new TypeError("[zudo-doc] SiteTreeNav island node noteTraySidebar is invalid.");
      }
      normalized.noteTraySidebar = node.noteTraySidebar;
    }
    if (node.date !== undefined) normalized.date = requireString(node.date, "date");
    if (node.updated !== undefined) normalized.updated = requireString(node.updated, "updated");
    if (node.rank !== undefined) normalized.rank = node.rank;

    return normalized;
  } finally {
    ancestors.delete(node);
  }
}

function normalizeStringArray(values: string[], name: string): string[] {
  if (!Array.isArray(values)) {
    throw new TypeError(`[zudo-doc] SiteTreeNav island ${name} must be an array.`);
  }
  return Array.from(values, (value) => requireString(value, name));
}

function normalizeDateFormats(value: ResolvedDateFormats): ResolvedDateFormats {
  return {
    full: requireString(value.full, "dateFormats.full"),
    monthDay: requireString(value.monthDay, "dateFormats.monthDay"),
    year: requireString(value.year, "dateFormats.year"),
    yearMonth: requireString(value.yearMonth, "dateFormats.yearMonth"),
    numericMonthDay: requireString(value.numericMonthDay, "dateFormats.numericMonthDay"),
  };
}

function requireString(value: string, name: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`[zudo-doc] SiteTreeNav island ${name} must be a string.`);
  }
  return value;
}

function requireBoolean(value: boolean, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(`[zudo-doc] SiteTreeNav island ${name} must be boolean.`);
  }
  return value;
}
