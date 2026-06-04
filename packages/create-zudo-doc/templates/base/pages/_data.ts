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
    // Astro-compat: strip a trailing `/index` from the entry id so
    // `getting-started/index.mdx` → id "getting-started" (matching
    // Astro 5's `glob()` collection loader). Downstream nav helpers
    // (`buildNavTree`, `buildBreadcrumbs`, …) keyed off the stripped
    // form long before zfb existed; emitting the unstripped slug here
    // produces ambiguous-URL collisions at paths()-expansion time.
    id: stripIndexSuffix(e.slug),
    collection: collectionName,
  }));
}

function stripIndexSuffix(slug: string): string {
  if (slug === "index") return "";
  return slug.endsWith("/index") ? slug.slice(0, -"/index".length) : slug;
}

/**
 * Augment a raw zfb collection result with the Astro-style
 * `id`/`collection` fields that downstream `@/utils/docs` helpers
 * (and the `DocPageEntry` extender shape used by `[...slug].tsx`
 * pages) expect. Use this when a page needs a typed array more
 * specific than `DocsEntry` — pages that only need `DocsEntry[]`
 * can use [`loadDocs`] / [`getDocs`] directly.
 */
export function bridgeEntries<T = ZfbDocsData>(
  entries: ReadonlyArray<CollectionEntry<T>>,
  collectionName: string,
): Array<CollectionEntry<T> & { id: string; collection: string }> {
  return entries.map((e) => ({
    ...e,
    id: stripIndexSuffix(e.slug),
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

// Module-level cache: snapshot identity → (collection name → stable DocsEntry[]).
// WeakMap keyed on the ContentSnapshot object (read via globalThis.__zfb) ensures
// the cache is only valid for the snapshot that was active when entries were first
// loaded. When the snapshot changes (HMR content change), the old WeakMap entry
// becomes unreachable and the cache is effectively cleared.
//
// When no snapshot is installed (filesystem-fallback path: unit tests, direct
// Node invocations), globalThis.__zfb?.contentSnapshot is undefined — the cache
// is bypassed and every call recomputes. This preserves test isolation: test suites
// that mock getCollection can replace data between test cases without worrying
// about stale cached results.
//
// globalThis.__zfb is read directly (not via zfb/content's getContentSnapshot)
// so the cache works even when zfb/content is mocked in tests without
// getContentSnapshot.
type ZfbSnapshot = { collections: Record<string, unknown[]> };
const loadDocsCache = new WeakMap<ZfbSnapshot, Map<string, DocsEntry[]>>();

/**
 * One-shot helper for paths()/render-time pages that just need a
 * `DocsEntry[]` for `@/utils/docs` consumption — wraps `getDocs` and
 * the `asDocsEntries` cast so call sites stay one-line. Use this from
 * any page that previously did
 * `getCollection("docs") as unknown as DocsEntry[]` — that idiom
 * silently dropped the `id`/`collection` fields the utility helpers
 * read, which threw `Cannot read properties of undefined` at runtime.
 *
 * The result is memoized per (snapshot, collection name) pair so callers
 * receive a stable array reference across multiple calls within the same
 * build snapshot. WeakMap-based caches downstream (mergeLocaleDocs,
 * buildNavTree) rely on this identity stability.
 *
 * In non-snapshot contexts (unit tests using mocked getCollection),
 * memoization is bypassed so test cases that install fresh mock data
 * between runs are not affected by stale cached results.
 */
export function loadDocs(collectionName: string): DocsEntry[] {
  // Read the snapshot directly from globalThis.__zfb so this cache works
  // even when zfb/content is fully mocked in tests (mocks need not export
  // getContentSnapshot). When the snapshot is absent (test / fs-fallback),
  // the cache is bypassed entirely, preserving test isolation.
  const g = globalThis as { __zfb?: { contentSnapshot?: ZfbSnapshot } };
  const snapshot = g.__zfb?.contentSnapshot;
  if (snapshot !== undefined) {
    // Snapshot path: stable cache keyed on the snapshot identity.
    let byName = loadDocsCache.get(snapshot);
    if (!byName) {
      byName = new Map<string, DocsEntry[]>();
      loadDocsCache.set(snapshot, byName);
    }
    const cached = byName.get(collectionName);
    if (cached) return cached;
    const result = asDocsEntries(getDocs(collectionName));
    byName.set(collectionName, result);
    return result;
  }
  // No snapshot (test / filesystem-fallback): bypass cache for isolation.
  return asDocsEntries(getDocs(collectionName));
}

/**
 * Filter out draft entries.
 * Drafts are always excluded in static-build paths() context.
 */
export function filterDrafts(entries: ZfbDocsEntry[]): ZfbDocsEntry[] {
  return entries.filter((e) => !e.data.draft);
}

