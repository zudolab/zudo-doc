// Snapshot-anchored memoization for nav-source arrays.
//
// WHY THIS EXISTS — build-time array-identity stabilization
// --------------------------------------------------------
// zfb's `getCollection(name)` returns a FRESH array of FRESH entry objects on
// every call (it `.map()`s over the underlying snapshot — see
// `node_modules/@takazudo/zfb/dist/content.js`). The doc-route `paths()`
// functions are re-invoked once per built page (e.g. ~123× for the EN docs
// route), and the per-page sidebar + header each re-derive their nav source
// independently. The net effect: `buildNavTree` is called ~2× the page count
// (~900 calls for 251 pages), and every call recomputed an O(n log n)
// stringify+sort cache key over the entire docs collection.
//
// The fix anchors identity on the ONE thing stable across the whole build:
// `getContentSnapshot().collections[name]` — the readonly snapshot array zfb
// installs once at worker boot (verified INSTALLED during `pnpm build`,
// collections `[docs, docs-ja, docs-v-*]`). We memoize the current +
// draft-filtered arrays on that anchor (WeakMap) so every repeat caller
// receives the SAME array instance. `buildNavTree`'s WeakMap fast-path
// (`src/utils/docs.ts`) then short-circuits the key computation on identity,
// collapsing ~900 key computations to the handful of distinct
// (snapshot, locale, version, options) inputs.
//
// FALLBACK (no snapshot): unit tests and direct Node invocations run the
// filesystem path with no installed snapshot. There is no stable anchor array
// to key on, AND the underlying `getCollection(name)` result can legitimately
// change between calls in that mode (e.g. a test swapping its mock for the same
// collection name). So we DELIBERATELY do not memoize the no-snapshot path —
// it computes fresh each call. The perf win targets the real build, where the
// snapshot is always installed; correctness wins in the fallback path.
//
// HMR intent preserved: a content edit produces a NEW snapshot object (new
// `collections[name]` array identity), so every memo here misses and
// recomputes — matching the old content-keyed cache's change detection.
//
// PACKAGE SPLIT (epic #2344, S6):
//   `memoizeDerived` — the generic two-level WeakMap memo — is now in the
//   package at @takazudo/zudo-doc/nav-source-cache (no zfb imports needed).
//   `stableDocs` stays here because it imports `getCollection` /
//   `getContentSnapshot` from "@takazudo/zfb/content", which is a virtual module
//   provided by the zfb SSG build system at compile time — not an npm package.

import { getCollection, getContentSnapshot } from "@takazudo/zfb/content";
import type { ZfbDocsData } from "../_data";
import type { DocPageEntry } from "@takazudo/zudo-doc/doc-page-props";

// Re-export memoizeDerived from the package (pure, no zfb dep).
export { memoizeDerived } from "@takazudo/zudo-doc/nav-source-cache";

// ---------------------------------------------------------------------------
// Snapshot anchor → stable current-entry arrays
// ---------------------------------------------------------------------------

/**
 * The stable per-build anchor array for a collection: the raw readonly
 * snapshot array zfb installed once. Returns `undefined` when no snapshot is
 * installed (filesystem-fallback path) so callers take the fresh, unmemoized
 * branch.
 */
function snapshotAnchor(name: string): readonly unknown[] | undefined {
  return getContentSnapshot()?.collections[name];
}

// Per-anchor-array memo of the draft-filtered entries. Keyed on the
// snapshot array identity so a new build snapshot invalidates automatically.
const docsByAnchor = new WeakMap<object, DocPageEntry[]>();

function buildDocs(collectionName: string): DocPageEntry[] {
  return getCollection<ZfbDocsData>(collectionName).filter(
    (entry) => !entry.data.draft,
  );
}

/**
 * Identity-stable, draft-filtered current zfb entries for a collection.
 *
 * Returns the SAME array instance on every call within one build (anchored on
 * the snapshot array), so downstream derived arrays — and ultimately
 * `buildNavTree` — can rely on reference equality. Entries are returned in the
 * native zfb shape; route identity is derived from `entry.slug` by consumers.
 *
 * Passed as `stableDocs` to `createNavSourceDocs` in `_nav-source-docs.ts`.
 */
export function stableDocs(collectionName: string): DocPageEntry[] {
  const anchor = snapshotAnchor(collectionName);

  // No snapshot (fs-fallback / unit tests): compute fresh, do not memoize —
  // see the no-snapshot rationale in the module header.
  if (anchor === undefined) {
    return buildDocs(collectionName);
  }

  const cached = docsByAnchor.get(anchor);
  if (cached) return cached;
  const built = buildDocs(collectionName);
  docsByAnchor.set(anchor, built);
  return built;
}
