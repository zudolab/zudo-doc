// site-schema/types — the canonical, browser-safe type surface for the
// nav / breadcrumb / pager domain (zudolab/zudo-doc#3395).
//
// THE CONTRACT: nothing reachable from this module — at runtime OR through the
// emitted `.d.ts` graph — may import `@takazudo/zfb*`, a `node:*` builtin,
// preact, a stylesheet, or a `virtual:` module. That is what makes
// `@takazudo/zudo-doc/site-schema` consumable from a browser bundle, a Worker,
// or any non-zfb toolchain.
//
// WHY THE ENTRY TYPE IS GENERIC: the renderer-side entry type
// (`DocPageEntry` in `../doc-page-props`) is an alias of zfb's
// `CollectionEntry`, so naming it here would re-introduce the zfb declaration
// edge this module exists to cut. Instead the props/route types below are
// generic over the entry shape and default to the structural
// {@link DocEntryLike}; `../doc-page-props` re-binds them to the zfb entry so
// its own importers keep the exact types they have today.

import type {
  CategoryMeta,
  CollectionEntryLike,
  SidebarFrontmatter,
  SidebarNode,
} from "../sidebar-tree/types.js";
import type { BreadcrumbItem } from "../breadcrumb/types.js";
import type { HeadingItem } from "../extract-headings/index.js";

export type {
  BreadcrumbItem,
  CategoryMeta,
  CollectionEntryLike,
  HeadingItem,
  SidebarFrontmatter,
  SidebarNode,
};

// ---------------------------------------------------------------------------
// Structural navigation node
// ---------------------------------------------------------------------------

/**
 * Nav tree node shape as consumed by doc-route pages.
 *
 * Structurally identical to a host project's `NavNode`. Defined here so the
 * package types depend on no host alias and no engine package; a host `NavNode`
 * is a structural subtype and assignable wherever `DocNavNode` is expected.
 */
export interface DocNavNode {
  slug: string;
  label: string;
  description?: string;
  position: number;
  href?: string;
  hasPage: boolean;
  children: DocNavNode[];
  sortOrder?: "asc" | "desc";
  collapsed?: boolean;
}

/** A category node with children but no page of its own — an auto-index. */
export interface AutoIndexNode extends DocNavNode {
  children: DocNavNode[];
}

// ---------------------------------------------------------------------------
// Frontmatter + entry shapes
// ---------------------------------------------------------------------------

/**
 * Minimal docs frontmatter shape consumed by the doc-page types.
 *
 * A structural subset of a project's full docs schema — only the fields the
 * nav/route domain actually reads. A richer `DocsData` is a structural
 * supertype and is assignable here.
 */
export interface DocPageFrontmatter {
  title: string;
  description?: string;
  slug?: string;
  draft?: boolean;
  unlisted?: boolean;
  standalone?: boolean;
  sidebar_position?: number;
  sidebar_label?: string;
  category_no_page?: boolean;
  category_sort_order?: "asc" | "desc";
  pagination_prev?: string | null;
  pagination_next?: string | null;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * The structural doc-collection entry this domain reads: a slug, docs
 * frontmatter, and an optional raw body. zfb's `CollectionEntry<DocPageFrontmatter>`
 * (exported as `DocPageEntry` from `@takazudo/zudo-doc/doc-page-props`) is
 * assignable to it, as is any plain fixture object of the same shape.
 */
export type DocEntryLike = CollectionEntryLike<DocPageFrontmatter>;

// ---------------------------------------------------------------------------
// Doc-page props — generic over the entry shape
// ---------------------------------------------------------------------------

/** Shared fields present in every doc-page route. */
interface DocPagePropsBase {
  breadcrumbs: BreadcrumbItem[];
  prev: DocNavNode | null;
  next: DocNavNode | null;
  /** Depth-2/3/4 headings extracted from the MDX body, for SSG TOC links. */
  headings: HeadingItem[];
}

/** Branch: a real content entry. `autoIndex` is absent. */
export interface DocPageEntryProps<E extends DocEntryLike = DocEntryLike>
  extends DocPagePropsBase {
  kind: "entry";
  entry: E;
  autoIndex?: undefined;
}

/** Branch: an auto-generated category index. `entry` is absent. */
export interface DocPageAutoIndexProps extends DocPagePropsBase {
  kind: "autoIndex";
  autoIndex: AutoIndexNode;
  entry?: undefined;
}

/** Discriminated union for the `kind` prop. Narrow via `props.kind === "entry"`. */
export type DocPageBaseProps<E extends DocEntryLike = DocEntryLike> =
  | DocPageEntryProps<E>
  | DocPageAutoIndexProps;

// ---------------------------------------------------------------------------
// Nav source
// ---------------------------------------------------------------------------

/**
 * The resolved, identity-stable doc set for one (locale, version) context —
 * the input every route-entry enumeration starts from.
 *
 * The concrete resolver that PRODUCES one (`createNavSourceDocs`) reads
 * `_category_.json` sidecars off disk and therefore stays in
 * `@takazudo/zudo-doc/nav-source-docs`; only the shape is browser-safe.
 */
export interface NavSourceDocs<E extends DocEntryLike = DocEntryLike> {
  /** Full doc list (merged + draft-filtered; unlisted retained per options). */
  docs: E[];
  /** `docs.filter(isNavVisible)` — stable instance for buildNavTree. */
  navDocs: E[];
  /** Stable category-meta Map for the active (locale, version). */
  categoryMeta: Map<string, CategoryMeta>;
  /** Slugs that came from the locale collection (for isFallback). Empty for
   *  default-locale / single-collection cases. */
  localeSlugSet: ReadonlySet<string>;
}
