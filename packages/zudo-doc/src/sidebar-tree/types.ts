/**
 * Public types for the framework-agnostic sidebar tree builder.
 *
 * These types are deliberately decoupled from astro:content so the helper
 * can run on top of any content collection that exposes a similar shape
 * (Astro, zfb, plain Node fixtures, etc.).
 */

/**
 * Frontmatter fields the builder reads off of each entry's `data` object.
 * Callers are free to extend this; unrecognised fields are ignored.
 */
export interface SidebarFrontmatter {
  title: string;
  description?: string;
  sidebar_position?: number;
  sidebar_label?: string;
  draft?: boolean;
  unlisted?: boolean;
  hide_sidebar?: boolean;
  /**
   * Set to `true` for pages that exist outside the doc tree (404, top-level
   * standalone pages, etc.). The builder skips these entries entirely.
   */
  standalone?: boolean;
  /**
   * Optional override for the route slug. When omitted, the builder derives
   * the route slug from the entry's zfb slug (stripping a trailing `/index`).
   */
  slug?: string;
  /**
   * Category metadata carried on a directory's `index.mdx` frontmatter — the
   * frontmatter equivalent of `_category_.json`'s `noPage`. When `true`, this
   * index file exists only to label/position the category: it renders as a
   * non-linked sidebar header and is excluded from routes, the sitemap, and
   * the search index. Frontmatter wins over the sidecar when both are present.
   */
  category_no_page?: boolean;
  /**
   * Frontmatter equivalent of `_category_.json`'s `sortOrder`. Controls the
   * sort direction of this category's children. Frontmatter wins over the
   * sidecar when both are present.
   */
  category_sort_order?: "asc" | "desc";
}

/**
 * Minimum current zfb collection-entry shape required by the builder.
 */
export interface CollectionEntryLike<
  T extends SidebarFrontmatter = SidebarFrontmatter,
> {
  /**
   * Filename without the extension. Canonical route identity is derived by
   * stripping the root or nested `index` suffix.
   */
  slug: string;
  data: T;
  /** Other native zfb fields are accepted structurally and never read here. */
  body?: string;
}

/**
 * Metadata supplied by a directory's `_category_.json` file.
 */
export interface CategoryMeta {
  label?: string;
  position?: number;
  description?: string;
  sortOrder?: "asc" | "desc";
  /**
   * When true, the category renders as a collapsible header with no link of
   * its own — useful for purely structural groupings.
   */
  noPage?: boolean;
}

/**
 * One node in the sidebar tree. `type` distinguishes leaves (single docs)
 * from categories (groups with children). The fields beyond the manager's
 * sketch — `description`, `hasPage`, `sortOrder`, `collapsed` — are kept
 * because downstream consumers (sidebar config layer, breadcrumb builder)
 * need them. They are all optional from a caller's perspective.
 */
export interface SidebarNode {
  type: "doc" | "category";
  /** Path-style slug, e.g. `getting-started/introduction`. */
  id: string;
  label: string;
  description?: string;
  href?: string;
  sidebar_position?: number;
  /** True when an actual MDX file backs this slug (vs. directory-only). */
  hasPage: boolean;
  sortOrder?: "asc" | "desc";
  collapsed?: boolean;
  children: SidebarNode[];
}

/**
 * Resolve an href for a given route slug. Defaults to `/<locale>/docs/<slug>/`
 * for non-default locales and `/docs/<slug>/` otherwise — but most projects
 * will inject their own to honour `base`, `trailingSlash`, etc.
 */
export type BuildHref = (slug: string, locale: string) => string;

export interface BuildSidebarTreeOptions {
  /**
   * Map keyed by slash-joined directory path → category meta. Typically
   * produced by {@link CategoryMetaLoader}.
   */
  categoryMeta?: Map<string, CategoryMeta>;
  /**
   * Default locale. When the supplied `locale` matches this, the helper
   * skips the locale prefix in default href construction. When omitted,
   * defaults to `"en"`.
   */
  defaultLocale?: string;
  /**
   * Override the default href builder. Receives the route slug and locale.
   */
  buildHref?: BuildHref;
  /**
   * Filter predicate run on every entry before tree construction. Defaults
   * to dropping `unlisted` and `standalone` docs. Override to integrate
   * with a project's own visibility rules.
   */
  isNavVisible?: (entry: CollectionEntryLike<SidebarFrontmatter>) => boolean;
}
