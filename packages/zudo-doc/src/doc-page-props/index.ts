// Shared current zfb entry and discriminated-union props types for all four
// doc-route variants.

export type { HeadingItem } from "../extract-headings/index.js";
import type { HeadingItem } from "../extract-headings/index.js";
import type { BreadcrumbItem } from "../breadcrumb/types.js";
import type { CollectionEntry } from "@takazudo/zfb/content";

// ---------------------------------------------------------------------------
// Structural navigation node
// ---------------------------------------------------------------------------

/**
 * Nav tree node shape as consumed by doc-route pages.
 *
 * Structurally identical to the host project's `NavNode` from
 * `src/utils/docs.ts`. Defined here so the package types do not import
 * the host `@/` alias. The host's `NavNode` is a structural subtype and
 * assignable wherever `DocNavNode` is expected.
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

// ---------------------------------------------------------------------------
// Current zfb docs entry
// ---------------------------------------------------------------------------

/**
 * Minimal docs frontmatter shape consumed by the doc-page types.
 *
 * A structural subset of the host's `DocsData` — only the fields that
 * `DocPageEntry` and `DocPageBaseProps` actually read. The full `DocsData`
 * (from `src/config/docs-schema.ts`) is a structural supertype and is
 * assignable here.
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

// ---------------------------------------------------------------------------
// DocPageEntry — entry shape for all 4 doc-route paths()
// ---------------------------------------------------------------------------

/**
 * The native zfb collection entry with docs frontmatter. Route consumers
 * derive canonical route slugs from `entry.data.slug ?? toRouteSlug(entry.slug)`.
 */
export type DocPageEntry = CollectionEntry<DocPageFrontmatter>;

// ---------------------------------------------------------------------------
// AutoIndexNode — auto-generated category index page node
// ---------------------------------------------------------------------------

export interface AutoIndexNode extends DocNavNode {
  children: DocNavNode[];
}

// ---------------------------------------------------------------------------
// DocPageBaseProps — shared base for all doc-page prop shapes
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
export interface DocPageEntryProps extends DocPagePropsBase {
  kind: "entry";
  entry: DocPageEntry;
  autoIndex?: undefined;
}

/** Branch: an auto-generated category index. `entry` is absent. */
export interface DocPageAutoIndexProps extends DocPagePropsBase {
  kind: "autoIndex";
  autoIndex: AutoIndexNode;
  entry?: undefined;
}

/** Discriminated union for the `kind` prop. Narrow via `props.kind === "entry"`. */
export type DocPageBaseProps = DocPageEntryProps | DocPageAutoIndexProps;
