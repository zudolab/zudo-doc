// Public types for the zfb search-index integration.
//
// The on-disk schema (one entry per page in `dist/search-index.json`) is
// frozen — both the in-browser search island and the Cloudflare
// `@zudo-doc/search-worker` consume this exact shape, so any change here
// is a breaking change to two downstream callers. See the migration
// brief on issue zudolab/zudo-doc#475.

/**
 * One page in the search index. The shape mirrors today's Astro
 * integration output verbatim — keep it byte-identical so downstream
 * consumers (search.astro client island and packages/search-worker via
 * MiniSearch) keep working unchanged after the zfb cutover.
 */
export interface SearchIndexEntry {
  /** Stable identifier — `slug` for the default locale, `${locale}/${slug}` otherwise. */
  id: string;
  /** Frontmatter title, falling back to the slug when missing. */
  title: string;
  /** Plain-text body excerpt, capped at MAX_BODY_LENGTH characters. */
  body: string;
  /** Site-relative URL (respecting `base`). */
  url: string;
  /** Frontmatter description, or the empty string when absent. */
  description: string;
}

/** A locale entry that mirrors the Astro `settings.locales` shape we already have. */
export interface SearchIndexLocaleConfig {
  /** Absolute or project-relative directory holding this locale's MDX content. */
  dir: string;
}

/** Build-time configuration for collecting search entries. */
export interface SearchIndexConfig {
  /** Default-locale content directory (e.g. `src/content/docs`). */
  docsDir: string;
  /** Optional non-default locales, keyed by locale code (e.g. `{ ja: { dir: "src/content/docs-ja" } }`). */
  locales?: Record<string, SearchIndexLocaleConfig>;
  /** Site base path (e.g. `""`, `"/docs"`); trailing slash is normalised away. */
  base?: string;
}

/** Maximum body text stored per entry (display excerpt cap). */
export const MAX_BODY_LENGTH = 300;

/** Public route the dev middleware and build emitter agree on. */
export const SEARCH_INDEX_ROUTE = "/search-index.json";
