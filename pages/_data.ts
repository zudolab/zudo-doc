// pages/_data.ts — zfb-compatible data helpers for doc page modules.
//
// Provides the bridge between zfb's CollectionEntry (from "zfb/content") and
// the utility functions in @/utils/docs that expect DocsEntry (which carries
// an `id` field mirroring Astro's collection entry id).
//
// Sync convention (ADR-004):
//   getCollection() resolves from the pre-loaded ContentSnapshot without an
//   async boundary. paths() exports call getDocs() without await. The Promise
//   wrapper on the type is a v0 artefact — the synchronous snapshot path is
//   the production contract.

import { getCollection } from "zfb/content";
import type { CollectionEntry } from "zfb/content";
import type { DocsEntry } from "@/types/docs-entry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Frontmatter shape shared by all docs collections (EN, locale, versioned).
 * Matches the zod schema in zfb.config.ts field-for-field.
 * `.passthrough()` equivalent: the index signature [key: string]: unknown
 * keeps custom frontmatter keys available (e.g. for frontmatter-preview).
 */
export type ZfbDocsData = {
  title: string;
  description?: string;
  category?: string;
  sidebar_position?: number;
  sidebar_label?: string;
  tags?: string[];
  search_exclude?: boolean;
  pagination_next?: string | null;
  pagination_prev?: string | null;
  draft?: boolean;
  unlisted?: boolean;
  hide_sidebar?: boolean;
  hide_toc?: boolean;
  doc_history?: boolean;
  standalone?: boolean;
  slug?: string;
  generated?: boolean;
  [key: string]: unknown;
};

/**
 * zfb collection entry augmented with the `id` and `collection` fields that
 * @/utils/docs utility functions (buildNavTree, buildBreadcrumbs, …) expect
 * from DocsEntry.
 *
 * `id` is bridged from `slug` — in Astro, `id` was the file-path identifier
 * (e.g. "getting-started/intro"); in zfb, the same role is played by `slug`.
 * Mapping them keeps the utility functions working without modification.
 */
export type ZfbDocsEntry = CollectionEntry<ZfbDocsData> & {
  /** Bridged from `slug` for @/utils/docs compat. */
  id: string;
  /** Collection name, e.g. "docs", "docs-ja", "docs-v-1.0". */
  collection: string;
};

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

/**
 * Load docs from a named collection synchronously (ADR-004 sync contract).
 *
 * `getCollection` resolves from the ContentSnapshot when called inside a
 * paths() evaluation. The `as unknown as` cast converts the nominal Promise
 * wrapper to a plain array — safe because the snapshot path is synchronous.
 *
 * The returned entries include:
 *   - All CollectionEntry fields (slug, data, body, module_specifier, Content)
 *   - `id` — same value as `slug`, for @/utils/docs compat
 *   - `collection` — the collection name, for DocsEntry compat
 */
export function getDocs(collectionName: string): ZfbDocsEntry[] {
  const entries = getCollection(collectionName) as unknown as CollectionEntry<ZfbDocsData>[];
  return entries.map((e) => ({
    ...e,
    id: e.slug,
    collection: collectionName,
  }));
}

/**
 * Cast ZfbDocsEntry[] to DocsEntry[] for passing to @/utils/docs utilities.
 *
 * The types are structurally compatible: ZfbDocsEntry has every required field
 * of DocsEntry (id, collection, data, body). The optional `rendered` and
 * `filePath` fields of DocsEntry are absent but not required.
 */
export function asDocsEntries(entries: ZfbDocsEntry[]): DocsEntry[] {
  return entries as unknown as DocsEntry[];
}

/**
 * Filter out draft entries.
 * Drafts are always excluded in static-build paths() context.
 */
export function filterDrafts(entries: ZfbDocsEntry[]): ZfbDocsEntry[] {
  return entries.filter((e) => !e.data.draft);
}

/**
 * Merge locale docs with base (EN) fallbacks.
 *
 * Strategy (mirrors src/utils/locale-docs.ts):
 *   1. Load locale docs (e.g. "docs-ja")
 *   2. Load base docs ("docs")
 *   3. Locale docs take priority; base docs fill in missing slugs.
 *   4. Track which slugs came from base (fallbackSlugs).
 *
 * Returns { allDocs, fallbackSlugs }.
 * categoryMeta is not merged here — callers use loadCategoryMeta() directly.
 */
export function mergeLocaleDocs(
  locale: string,
): { allDocs: ZfbDocsEntry[]; fallbackSlugs: Set<string> } {
  const localeDocs = filterDrafts(getDocs(`docs-${locale}`));
  const baseDocs = filterDrafts(getDocs("docs"));

  const localeSlugSet = new Set(localeDocs.map((d) => d.data.slug ?? d.id));

  const fallbackDocs = baseDocs.filter(
    (d) => !localeSlugSet.has(d.data.slug ?? d.id),
  );

  return {
    allDocs: [...localeDocs, ...fallbackDocs],
    fallbackSlugs: new Set(fallbackDocs.map((d) => d.data.slug ?? d.id)),
  };
}
