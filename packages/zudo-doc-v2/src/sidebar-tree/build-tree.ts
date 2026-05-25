/**
 * Framework-agnostic sidebar tree builder.
 *
 * Takes a flat list of content collection entries and emits a recursive
 * `SidebarNode[]` that mirrors the filesystem layout — directories become
 * category nodes, files become leaves. The shape is deliberately
 * decoupled from astro:content so the same builder works against zfb's
 * `getCollection` output, in-memory fixtures, etc.
 *
 * Ported from src/utils/docs.ts in the legacy zudo-doc Astro project.
 */

import type {
  BuildHref,
  BuildSidebarTreeOptions,
  CategoryMeta,
  CollectionEntryLike,
  SidebarFrontmatter,
  SidebarNode,
} from "./types.ts";

/** Strip a trailing `/index` segment to match Astro 5's glob() id stripping. */
function toRouteSlug(id: string): string {
  return id.replace(/\/index$/, "");
}

/** kebab-case → Title Case, used as the fallback label for directory-only nodes. */
function toTitleCase(str: string): string {
  return str
    .split("-")
    .map((word) => (word.length === 0 ? word : word[0]!.toUpperCase() + word.slice(1)))
    .join(" ");
}

/**
 * Default href builder — produces `/[locale]/docs/<slug>/`. Most projects
 * inject their own to honour `base`, `trailingSlash`, etc.; this exists
 * mostly so the builder is usable from a unit test with no extra wiring.
 */
const defaultBuildHref: BuildHref = (slug, locale) => {
  const prefix = locale ? `/${locale}/docs/` : "/docs/";
  return slug ? `${prefix}${slug}/` : prefix;
};

/** Default visibility predicate — drops `unlisted` and `standalone` docs. */
function defaultIsNavVisible(
  entry: CollectionEntryLike<SidebarFrontmatter>,
): boolean {
  return !entry.data.unlisted && !entry.data.standalone;
}

/** Internal mutable node used while assembling the tree. */
interface BuildNode<T extends SidebarFrontmatter> {
  segment: string;
  fullPath: string;
  doc?: CollectionEntryLike<T>;
  children: Map<string, BuildNode<T>>;
}

/**
 * Build a recursive sidebar tree from `entries`. Visibility filtering is
 * applied first; the resulting structure mirrors the filesystem.
 *
 * - Multi-segment ids (e.g. `getting-started/intro`) walk the tree creating
 *   intermediate category nodes as needed.
 * - Single-segment ids represent category index pages (Astro 5 strips
 *   `/index` from the id, so `getting-started/index.mdx` arrives as the id
 *   `getting-started`).
 * - Sibling order is determined by `sidebar_position` then alphabetical
 *   slug, with the parent's `sortOrder` (from `_category_.json`) flipping
 *   the comparator when set to `"desc"`.
 */
export function buildSidebarTree<
  T extends SidebarFrontmatter = SidebarFrontmatter,
>(
  entries: CollectionEntryLike<T>[],
  locale: string,
  options: BuildSidebarTreeOptions = {},
): SidebarNode[] {
  const {
    categoryMeta,
    buildHref = defaultBuildHref,
    isNavVisible = defaultIsNavVisible,
  } = options;

  const root: BuildNode<T> = {
    segment: "",
    fullPath: "",
    children: new Map(),
  };

  for (const entry of entries) {
    if (!isNavVisible(entry)) continue;

    const slug = entry.data.slug ?? entry.slug ?? toRouteSlug(entry.id);
    if (!slug) continue;

    const parts = slug.split("/");
    if (parts.length <= 1) {
      // Category index — single segment.
      const segment = slug;
      let node = root.children.get(segment);
      if (!node) {
        node = { segment, fullPath: segment, children: new Map() };
        root.children.set(segment, node);
      }
      node.doc = entry;
    } else {
      // Multi-segment: walk creating intermediates as needed.
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const segment = parts[i]!;
        const fullPath = parts.slice(0, i + 1).join("/");
        let next = current.children.get(segment);
        if (!next) {
          next = { segment, fullPath, children: new Map() };
          current.children.set(segment, next);
        }
        if (i === parts.length - 1) {
          next.doc = entry;
        }
        current = next;
      }
    }
  }

  return toSidebarNodes(root, locale, buildHref, categoryMeta);
}

function toSidebarNodes<T extends SidebarFrontmatter>(
  parent: BuildNode<T>,
  locale: string,
  buildHref: BuildHref,
  categoryMeta?: Map<string, CategoryMeta>,
  parentSortOrder?: "asc" | "desc",
): SidebarNode[] {
  const nodes: SidebarNode[] = [];

  for (const child of parent.children.values()) {
    const doc = child.doc;
    const meta = categoryMeta?.get(child.fullPath);
    const sortOrder = meta?.sortOrder ?? "asc";
    const children = toSidebarNodes(
      child,
      locale,
      buildHref,
      categoryMeta,
      sortOrder,
    );

    const hasPage = !!doc;
    const isCategory = !hasPage && children.length > 0;

    const label =
      doc?.data.sidebar_label ??
      doc?.data.title ??
      meta?.label ??
      toTitleCase(child.segment);

    const description = doc?.data.description ?? meta?.description;
    const positionRaw = doc?.data.sidebar_position ?? meta?.position;
    // 999 mirrors the legacy fallback so tied entries sort alphabetically.
    const position = positionRaw ?? 999;

    const href = meta?.noPage
      ? undefined
      : doc || children.length > 0
        ? buildHref(child.fullPath, locale)
        : undefined;

    nodes.push({
      type: isCategory ? "category" : "doc",
      id: child.fullPath,
      label,
      ...(description !== undefined ? { description } : {}),
      ...(positionRaw !== undefined ? { sidebar_position: positionRaw } : {}),
      ...(href !== undefined ? { href } : {}),
      hasPage,
      ...(meta?.sortOrder ? { sortOrder } : {}),
      children,
    });

    // Pin the position used at sort time on a private property so the
    // comparator below can read it without re-deriving the value.
    Object.defineProperty(nodes[nodes.length - 1], "__sortPosition", {
      value: position,
      enumerable: false,
    });
  }

  const order = parentSortOrder ?? "asc";
  nodes.sort((a, b) => {
    const aPos = (a as SidebarNode & { __sortPosition: number }).__sortPosition;
    const bPos = (b as SidebarNode & { __sortPosition: number }).__sortPosition;
    const posCompare = aPos - bPos;
    if (posCompare !== 0) return order === "desc" ? -posCompare : posCompare;
    const slugCompare = a.id.localeCompare(b.id);
    return order === "desc" ? -slugCompare : slugCompare;
  });

  return nodes;
}

/**
 * Find a node by id (path slug) anywhere in the tree. Useful for sidebar
 * config layers that resolve named doc references and for the breadcrumb
 * builder. Exported alongside `buildSidebarTree` because both downstream
 * topics (sub-tasks 4 and 5) need it.
 */
export function findSidebarNode(
  nodes: SidebarNode[],
  id: string,
): SidebarNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findSidebarNode(node.children, id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Depth-first flatten — only nodes with a backing page are emitted, in
 * traversal order. Mirrors the legacy `flattenTree` used for prev/next
 * navigation.
 */
export function flattenSidebarTree(nodes: SidebarNode[]): SidebarNode[] {
  const acc: SidebarNode[] = [];
  flattenInto(nodes, acc);
  return acc;
}

function flattenInto(nodes: SidebarNode[], acc: SidebarNode[]): void {
  for (const node of nodes) {
    if (node.hasPage) acc.push(node);
    flattenInto(node.children, acc);
  }
}
