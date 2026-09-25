// Internal types for the zfb search-index plugin implementation.
//
// The on-disk schema (one entry per page in `dist/search-index.json`) is
// frozen — both the in-browser search island and the Cloudflare
// `@takazudo/zudo-doc-search-worker` consume this exact shape, so any change here
// is a breaking change to two downstream callers. See the migration
// brief on issue zudolab/zudo-doc#475.

import type { AssetScanProjection } from "../asset-viewer/asset-pages.js";

/**
 * One page in the search index. The shape mirrors today's Astro
 * integration output verbatim — keep it byte-identical so downstream
 * consumers (the search client island and packages/search-worker via
 * MiniSearch) keep working unchanged after the zfb cutover.
 */
export interface SearchIndexEntry {
  /** Stable document slug, locale-prefixed slug, or `asset:`-namespaced asset path. */
  id: string;
  /** Frontmatter title, falling back to the slug when missing. */
  title: string;
  /**
   * Plain-text body, capped at MAX_BODY_LENGTH characters (configurable via
   * `searchMaxBodyLength`). This is a match-depth cap — how much of the page
   * is available for the widget's `indexOf` search to match against — not a
   * display cap; the widget already renders only a short match-centred
   * excerpt of whichever field it shows.
   */
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
  /** Runtime project root for asset scans; injected by the zfb plugin wrapper, never serialized in the preset. */
  projectRoot?: string;
  /** Shared asset-viewer projection; consumed by the asset indexing wave. */
  assetScan?: AssetScanProjection;
  /**
   * Match-depth cap for indexed body text, in characters (`searchMaxBodyLength`
   * in `ZudoDocConfig`). Applies to both doc bodies and text-asset excerpts.
   * Falls back to {@link MAX_BODY_LENGTH} when omitted (e.g. a direct
   * `collectSearchEntries()` call outside `zudoDoc()`). Must be a positive
   * integer — validated by `assertValidSearchMaxBodyLength` in `collect.ts`.
   */
  maxBodyLength?: number;
}

/**
 * Default match-depth cap for indexed body text (characters) — how much of a
 * page or text asset is available for the search widget's `indexOf` matching,
 * NOT a display-excerpt cap (the widget already renders only a short
 * match-centred window regardless of this value). Overridable per-site via
 * `searchMaxBodyLength` (zudolab/zudo-doc#4407); the exported name stays
 * `MAX_BODY_LENGTH` for backward compatibility even though it is now a
 * default rather than a fixed constant.
 */
export const MAX_BODY_LENGTH = 3000;

/** Public route the dev middleware and build emitter agree on. */
export const SEARCH_INDEX_ROUTE = "/search-index.json";
