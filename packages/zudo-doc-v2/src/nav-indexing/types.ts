/**
 * Shared types for the nav-indexing v2 primitives.
 *
 * All types are presentational: every value the components need to render
 * arrives via props. No host-project imports, no Astro collection queries.
 */

/**
 * Minimal tree node used by tree-based nav components (CategoryNav,
 * CategoryTreeNav, NavCardGrid, DocsSitemap, SiteTreeNavDemo).
 *
 * Structurally compatible with the host project's `NavNode` from
 * `src/utils/docs.ts` and with `SidebarNode` from `sidebar-tree/`, so
 * callers can pass either through with minor adapter mapping if needed.
 */
export interface NavNode {
  label: string;
  description?: string;
  /** Pre-resolved href. Undefined for category-only nodes without an index page. */
  href?: string;
  /** True when an MDX page backs this node. */
  hasPage: boolean;
  children: NavNode[];
}

/**
 * A single tag entry with pre-resolved href — for `TagNav` "all" variant.
 */
export interface TagItem {
  tag: string;
  count: number;
  /** Pre-resolved href including locale prefix and base path. */
  href: string;
}

/**
 * A tag with its pre-resolved href — for `TagNav` "page" variant.
 */
export interface TagLink {
  tag: string;
  /** Pre-resolved href. */
  href: string;
}

/**
 * i18n label bag for `TagNav`. Keeps v2 decoupled from the host's `t()`
 * function — the consumer resolves strings for the active locale and passes
 * them in.
 */
export interface TagNavLabels {
  /** e.g. "Tags" / "タグ" — prefix label shown before the chips. */
  tags: string;
  /** e.g. "Pages tagged with" — used for aria-label on each chip link. */
  taggedWith: string;
}

/**
 * A single past version entry for `VersionsPageContent`.
 *
 * Extends `VersionEntry` from `@zudo-doc/zudo-doc-v2/i18n-version/types`
 * with the pre-resolved doc href and optional status banner.
 */
export interface VersionPageEntry {
  slug: string;
  label: string;
  /** Pre-resolved href to the version's default doc page. */
  docsHref: string;
  /** Optional status badge rendered in the Status column. */
  banner?: "unmaintained" | "unreleased";
}

/**
 * i18n label bag for `VersionsPageContent`. The consumer resolves all
 * strings for the active locale and passes them in.
 */
export interface VersionsPageLabels {
  /** Page `<h1>` text, e.g. "Documentation Versions". */
  pageTitle: string;
  /** Latest version section heading, e.g. "Latest Version (Current)". */
  latestTitle: string;
  /** Description below the latest heading. */
  latestDescription: string;
  /** Link label for the latest docs link. */
  latestLink: string;
  /** Past versions section heading, e.g. "Past Versions". */
  pastTitle: string;
  /** Description below past versions heading. */
  pastDescription: string;
  /** "Unmaintained" badge label. */
  unmaintained: string;
  /** "Unreleased" badge label. */
  unreleased: string;
  /** Table column: version label heading. */
  versionCol: string;
  /** Table column: status heading. */
  statusCol: string;
  /** Table column: docs link heading (also used as the link text). */
  docsCol: string;
}
