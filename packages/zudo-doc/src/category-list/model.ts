// category-list/model — option validation and canonical resolution for the
// category-driven document listing (zudolab/zudo-doc#4802).
//
// Pure and browser-safe: no node builtins, no JSX. Both the `home.sections`
// recipe (validated at config resolution) and the `<CategoryList>` MDX
// component (validated at render) share `assertValidCategoryListOptions`, and
// both resolve through `resolveCategoryList` against the same nav tree the
// sidebar uses, so cards and list always receive identical items.

import { getNoteTrayItems, rankWidth } from "../note-tray-model/index.js";

export type CategoryListLayout = "cards" | "list";
export type CategoryListScope = "descendants" | "direct";
/** What sits in the leading slot before the title. */
export type CategoryListLead = "auto" | "none" | "rank" | "date";

export const CATEGORY_LIST_LAYOUTS: readonly CategoryListLayout[] = ["cards", "list"];
export const CATEGORY_LIST_SCOPES: readonly CategoryListScope[] = ["descendants", "direct"];
export const CATEGORY_LIST_LEADS: readonly CategoryListLead[] = ["auto", "none", "rank", "date"];

/**
 * Author options shared by the `category-list` home section and the
 * `<CategoryList>` component. Only `category` and `limit` are required.
 */
export interface CategoryListOptions {
  /** Canonical category slug as it appears in the nav tree, e.g. `"blog"` or `"guides/layout-demos"`. */
  category: string;
  /** Presentation. Switching it never changes the items. @default "cards" */
  layout?: CategoryListLayout;
  /** Maximum number of items shown (positive integer). Required. */
  limit: number;
  /**
   * Ordinary categories: every document page below the category
   * (`"descendants"`) or only its direct children (`"direct"`). Note trays
   * always use their own flat membership and ignore this. @default "descendants"
   */
  scope?: CategoryListScope;
  /**
   * Leading detail. `"auto"` = publication date for a dated note tray, the
   * category rank for an undated tray, nothing for an ordinary category.
   * `"rank"` on an ordinary category shows nothing (ranks are never invented).
   * @default "auto"
   */
  lead?: CategoryListLead;
  /** Show the frontmatter description. @default true */
  showDescription?: boolean;
  /** Show the publication date in the metadata row (skipped when it is already the lead). @default false */
  showDate?: boolean;
  /** Show the updated date with a label (skipped when equal to the publication date). @default false */
  showUpdated?: boolean;
  /** Show the document's tags as plain text. @default false */
  showTags?: boolean;
  /** Show the subcategory path between the listed category and the item. @default false */
  showPath?: boolean;
  /** Show "N of total" in the footer. @default false */
  showCount?: boolean;
  /** Show the footer link to the full category. @default true */
  showArchive?: boolean;
  /** Archive link text. Blank uses the translated default ("See all"). */
  archiveLabel?: string;
}

/** Keys accepted by {@link assertValidCategoryListOptions}. */
export const CATEGORY_LIST_OPTION_KEYS: readonly (keyof CategoryListOptions)[] = [
  "category",
  "layout",
  "limit",
  "scope",
  "lead",
  "showDescription",
  "showDate",
  "showUpdated",
  "showTags",
  "showPath",
  "showCount",
  "showArchive",
  "archiveLabel",
];

const BOOLEAN_KEYS = [
  "showDescription",
  "showDate",
  "showUpdated",
  "showTags",
  "showPath",
  "showCount",
  "showArchive",
] as const;

function describe(value: unknown): string {
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "(array)";
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** A canonical category slug: non-empty segments, no leading/trailing slash, no URL or whitespace. */
export function isCanonicalCategorySlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !/\s/.test(value) &&
    !value.includes("://") &&
    !value.startsWith("/") &&
    !value.endsWith("/") &&
    !value.split("/").some((part) => part === "" || part === "." || part === "..")
  );
}

/**
 * Validate the option fields of one listing. `at` names the entry in error
 * messages (e.g. `home.sections[2]` or `<CategoryList>`). `extraKeys` lists
 * additional keys the caller owns (a home section's `type`/`heading`/…).
 * Throws a `TypeError` describing the first problem.
 */
export function assertValidCategoryListOptions(
  value: Record<string, unknown>,
  at: string,
  extraKeys: readonly string[] = [],
): void {
  const allowed = new Set<string>([...CATEGORY_LIST_OPTION_KEYS, ...extraKeys]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new TypeError(
        `Invalid ${at}: unknown key "${key}" for a category list. Allowed keys: ${[...allowed].join(", ")}.`,
      );
    }
  }
  if (!isCanonicalCategorySlug(value.category)) {
    throw new TypeError(
      `Invalid ${at}.category ${describe(value.category)}: must be a canonical category slug such as "blog" or "guides/layout-demos" (no leading or trailing "/", no URL).`,
    );
  }
  const limit = value.limit;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1) {
    throw new TypeError(
      `Invalid ${at}.limit ${describe(limit)}: a positive integer is required (the number of items to show, e.g. 6).`,
    );
  }
  const enumChecks: Array<[string, readonly string[]]> = [
    ["layout", CATEGORY_LIST_LAYOUTS],
    ["scope", CATEGORY_LIST_SCOPES],
    ["lead", CATEGORY_LIST_LEADS],
  ];
  for (const [key, allowedValues] of enumChecks) {
    const v = value[key];
    if (v !== undefined && !allowedValues.includes(v as string)) {
      throw new TypeError(
        `Invalid ${at}.${key} ${describe(v)}: must be ${allowedValues.map((a) => `"${a}"`).join(" or ")}.`,
      );
    }
  }
  for (const key of BOOLEAN_KEYS) {
    const v = value[key];
    if (v !== undefined && typeof v !== "boolean") {
      throw new TypeError(`Invalid ${at}.${key} ${describe(v)}: must be true or false.`);
    }
  }
  if (value.archiveLabel !== undefined && typeof value.archiveLabel !== "string") {
    throw new TypeError(`Invalid ${at}.archiveLabel ${describe(value.archiveLabel)}: must be a string.`);
  }
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** Structural nav-tree node the resolver reads (a `DocNavNode` satisfies it). */
export interface CategoryListNode {
  slug: string;
  label: string;
  description?: string;
  href?: string;
  hasPage: boolean;
  children: CategoryListNode[];
  shape?: "note-tray";
  noteTrayDated?: boolean;
  date?: string;
  updated?: string;
  rank?: number;
}

/** One listed document. */
export interface CategoryListItem {
  slug: string;
  title: string;
  href: string;
  description?: string;
  /** Category position from the shared note-tray model; trays only. */
  rank?: number;
  date?: string;
  updated?: string;
  /** Labels of the subcategories between the listed category and the item. */
  path: string[];
  /** Canonical tags (already resolved and deduplicated). */
  tags: string[];
}

export type CategoryListKind = "note-tray" | "tree";

export interface CategoryListResolved {
  status: "ok";
  category: {
    slug: string;
    label: string;
    /** Canonical archive URL, absent when the category has no addressable page. */
    href?: string;
    kind: CategoryListKind;
    dated: boolean;
  };
  /** Items after visibility filtering and the limit, in canonical order. */
  items: CategoryListItem[];
  /** Eligible item count before the limit. */
  total: number;
  /** Rank label width for the whole tray (`rankWidth`), trays only. */
  rankWidth?: number;
}

export type CategoryListResolution =
  | CategoryListResolved
  | { status: "not-found"; category: string }
  | { status: "not-category"; category: string };

export interface ResolveCategoryListOptions {
  scope?: CategoryListScope;
  limit: number;
  /** Canonical tags for a route slug. Omitted → no tags. */
  tagsFor?: (slug: string) => readonly string[];
  /**
   * True when the route slug is a category landing page (an `index` file).
   * Distinguishes a category whose documents are all hidden (valid, empty)
   * from a plain document targeted by mistake (an authoring error).
   */
  isCategoryIndex?: (slug: string) => boolean;
}

function findBySlug(nodes: readonly CategoryListNode[], slug: string): CategoryListNode | undefined {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const found = findBySlug(node.children, slug);
    if (found) return found;
  }
  return undefined;
}

/** A node backed by a real, addressable document page. */
function isDocumentPage(node: CategoryListNode): node is CategoryListNode & { href: string } {
  return node.hasPage === true && typeof node.href === "string" && node.href.length > 0;
}

function toItem(
  node: CategoryListNode & { href: string },
  path: string[],
  tagsFor: ResolveCategoryListOptions["tagsFor"],
  withRank: boolean,
): CategoryListItem {
  const description = node.description?.trim();
  const tags = tagsFor ? [...new Set(tagsFor(node.slug))] : [];
  return {
    slug: node.slug,
    title: node.label,
    href: node.href,
    ...(description ? { description } : {}),
    ...(withRank && node.rank !== undefined ? { rank: node.rank } : {}),
    ...(node.date ? { date: node.date } : {}),
    ...(node.updated ? { updated: node.updated } : {}),
    path,
    tags,
  };
}

/**
 * Resolve one category against a visibility-filtered nav tree for the render
 * locale/version (drafts, unlisted and standalone already removed, translation
 * fallbacks already deduplicated, hrefs already locale/base/version aware).
 *
 * - The category is found by its exact nav-tree slug, never a prefix match.
 * - A note tray lists its shared flat membership (`getNoteTrayItems`) with
 *   ranks and rank width taken from the whole tray; `scope` is ignored.
 * - An ordinary category lists real document pages (`hasPage` + `href`) in
 *   tree order, either direct children or all descendants. Grouping-only and
 *   auto-index nodes are traversed but never listed; the category's own
 *   landing page is never listed.
 * - `total` is counted after filtering and before `limit`.
 */
export function resolveCategoryList(
  tree: readonly CategoryListNode[],
  category: string,
  options: ResolveCategoryListOptions,
): CategoryListResolution {
  const node = findBySlug(tree, category);
  if (!node) return { status: "not-found", category };

  const isTray = node.shape === "note-tray";
  if (!isTray && node.children.length === 0) {
    const isIndex = options.isCategoryIndex?.(node.slug) ?? node.hasPage !== true;
    if (!isIndex) return { status: "not-category", category };
  }

  const seen = new Set<string>();
  const eligible: CategoryListItem[] = [];
  const push = (child: CategoryListNode, path: string[], withRank: boolean): void => {
    if (!isDocumentPage(child) || seen.has(child.slug)) return;
    seen.add(child.slug);
    eligible.push(toItem(child, path, options.tagsFor, withRank));
  };

  if (isTray) {
    for (const item of getNoteTrayItems(node)) push(item, [], true);
  } else if ((options.scope ?? "descendants") === "direct") {
    for (const child of node.children) push(child, [], false);
  } else {
    const walk = (nodes: readonly CategoryListNode[], path: string[]): void => {
      for (const child of nodes) {
        push(child, path, false);
        if (child.children.length > 0) walk(child.children, [...path, child.label]);
      }
    };
    walk(node.children, []);
  }

  return {
    status: "ok",
    category: {
      slug: node.slug,
      label: node.label,
      ...(node.href ? { href: node.href } : {}),
      kind: isTray ? "note-tray" : "tree",
      dated: isTray && node.noteTrayDated === true,
    },
    items: eligible.slice(0, options.limit),
    total: eligible.length,
    ...(isTray ? { rankWidth: rankWidth(getNoteTrayItems(node)) } : {}),
  };
}

/** The concrete leading detail for a resolved category. */
export function resolveCategoryListLead(
  lead: CategoryListLead | undefined,
  category: CategoryListResolved["category"],
): "none" | "rank" | "date" {
  switch (lead ?? "auto") {
    case "none":
      return "none";
    case "date":
      return "date";
    case "rank":
      return category.kind === "note-tray" ? "rank" : "none";
    default:
      if (category.kind !== "note-tray") return "none";
      return category.dated ? "date" : "rank";
  }
}
