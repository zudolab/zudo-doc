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
   * the slug from the entry's id (stripping a trailing `/index`).
   */
  slug?: string;
}

/**
 * Minimum shape required of a content collection entry. Designed to be a
 * structural superset of both Astro's `CollectionEntry` and zfb's
 * `CollectionEntry<T>` so callers can pass either through unchanged.
 */
export interface CollectionEntryLike<
  T extends SidebarFrontmatter = SidebarFrontmatter,
> {
  /**
   * Stable identifier. For Astro entries this is the file path without the
   * extension (e.g. `getting-started/index`). For zfb entries the project
   * convention is to put the cleaned slug here too — either form is fine
   * because the builder strips a trailing `/index`.
   */
  id: string;
  /**
   * Optional pre-computed slug. When present it wins over the id-derived
   * value. zfb entries always populate this field; Astro callers can leave
   * it undefined.
   */
  slug?: string;
  data: T;
  /** Free-form fields kept for forward compatibility — never read here. */
  collection?: string;
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
