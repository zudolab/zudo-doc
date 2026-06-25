// doc-page-props — shared discriminated-union props types for all 4 doc-route
// pages (epic #2344, S6).
//
// Moved from the showcase's `pages/lib/doc-page-props.ts` into the shared
// package. Previously the types imported `DocsEntry` from `@/types/docs-entry`
// and `NavNode`/`BreadcrumbItem` from `@/utils/docs` — host-alias imports that
// would not resolve in downstream consumers. The package defines its own
// structural interfaces for these types (no `@/` imports).
//
// TYPE COMPATIBILITY:
//   The `DocNavNode` interface is structurally compatible with the host's
//   `NavNode` from `src/utils/docs.ts`. The host stub re-exports these types
//   so callers that imported from `pages/lib/doc-page-props` continue to work
//   unchanged. `HeadingItem` is imported from the package's own
//   `extract-headings` subpath (already a package export).

export type { HeadingItem } from "../extract-headings/index.js";
import type { HeadingItem } from "../extract-headings/index.js";
import type { BreadcrumbItem } from "../breadcrumb/types.js";

// ---------------------------------------------------------------------------
// Structural NavNode — structurally identical to host's `NavNode`
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
// Structural DocsEntry for the DocPageEntry bridge
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
  category_no_page?: boolean;
  pagination_prev?: string | null;
  pagination_next?: string | null;
  tags?: string[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// DocPageEntry — entry shape for all 4 doc-route paths()
// ---------------------------------------------------------------------------

/**
 * A zfb content collection entry augmented with the `id`/`collection` fields
 * the host's `@/utils/docs` helpers expect, plus the typed `data` and
 * renderer surface.
 *
 * Structural counterpart of the host's `DocPageEntry` (from
 * `pages/lib/doc-page-props.ts`). The host stub re-exports this type under
 * the original name.
 */
export interface DocPageEntry {
  /** zfb content engine slug (filename without `.md`/`.mdx`). */
  slug: string;
  /** Bridged from `slug` for host `@/utils/docs` compat. */
  id: string;
  /** Collection name, e.g. "docs", "docs-ja", "docs-v-1.0". */
  collection: string;
  /** Parsed frontmatter. Structural superset of `DocPageFrontmatter`. */
  data: DocPageFrontmatter;
  /** Raw MDX body (for heading extraction). */
  body?: string;
  /** zfb module specifier (for Content bridge). */
  module_specifier: string;
  /** zfb content renderer — callable Preact component. */
  Content: unknown;
}

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
