// nav-source-cache — snapshot-anchored memoization primitives for nav-source
// arrays (epic #2344, S6).
//
// Moved from the showcase's `pages/lib/_nav-source-cache.ts` into the shared
// package — the PURE, engine-agnostic portion only.
//
// NOT MOVED: `stableDocs()` stays in the host's `pages/lib/_nav-source-cache.ts`
// because it imports `getCollection` / `getContentSnapshot` from `"zfb/content"`.
// That import is a virtual module provided by the zfb SSG build system at
// compile time — it is NOT an npm-resolvable module and would break consumers
// that compile against this package's dist/. Host stubs that need `stableDocs`
// inject it as a function parameter to the factories that need it.
//
// WHAT THIS MODULE PROVIDES:
//   - `memoizeDerived` — the two-level WeakMap memo used by `_nav-source-docs.ts`
//     to cache locale-merge results and navDocs filter results on the identity
//     of snapshot-anchored stable arrays. This IS pure (no engine imports).
//
// WHY MEMOIZATION EXISTS — build-time array-identity stabilization
// ---------------------------------------------------------------
// zfb's `getCollection(name)` returns a FRESH array on every call. The
// doc-route `paths()` functions are re-invoked once per built page (~123× for
// the EN docs route), and the per-page sidebar + header each re-derive their
// nav source independently. The net effect: `buildNavTree` is called ~2× the
// page count (~900 calls for 251 pages), each recomputing an O(n log n)
// stringify+sort cache key. The fix anchors identity on the ONE thing stable
// across the whole build: `getContentSnapshot().collections[name]` — the
// readonly snapshot array zfb installs once at worker boot.
//
// FALLBACK (no snapshot): unit tests run without an installed snapshot. There
// is no stable anchor to key on, so `stableDocs` (host side) computes fresh
// on each call. `memoizeDerived` is still called in that path (the derived
// arrays are fresh too), so cache misses happen every call — correct
// behavior for test isolation.

// ---------------------------------------------------------------------------
// Generic derived-array memo
// ---------------------------------------------------------------------------

// Two-level memo: a WeakMap on the FIRST stable input array (so a new snapshot
// drops the whole sub-map), then a string key combining the remaining stable
// inputs' identities and the option signature.
const derivedMemo = new WeakMap<object, Map<string, unknown>>();
// Per-build incrementing ids for stable arrays, so a multi-array key can be a
// cheap string. Lives in a WeakMap so it does not retain arrays past their
// snapshot.
const arrayId = new WeakMap<object, number>();
let nextArrayId = 1;
function idOf(arr: object): number {
  let id = arrayId.get(arr);
  if (id === undefined) {
    id = nextArrayId++;
    arrayId.set(arr, id);
  }
  return id;
}

// Anchor object for the rare case of an empty `inputs` array (e.g. an absent
// locale collection). Lets the WeakMap still key the derived memo.
const EMPTY_INPUT_ANCHOR: object = {};

/**
 * Memoize a derived array (e.g. a locale merge or an `isNavVisible` filter)
 * on the identity of its stable inputs plus a caller-supplied option
 * signature.
 *
 * `inputs` MUST be the stable arrays returned by `stableDocs` (from the
 * host's `pages/lib/_nav-source-cache.ts`) or arrays derived from them
 * through this same helper — passing a fresh array defeats the memo.
 * `optionSig` distinguishes call sites that differ only in filter options
 * (e.g. `applyDefaultLocaleOnlyFilter`, `keepUnlisted`), so they never
 * collide on the same key.
 */
export function memoizeDerived<T>(
  inputs: readonly object[],
  optionSig: string,
  compute: () => T,
): T {
  const primary = inputs[0] ?? EMPTY_INPUT_ANCHOR;
  let sub = derivedMemo.get(primary);
  if (!sub) {
    sub = new Map();
    derivedMemo.set(primary, sub);
  }
  const key = `${inputs.map((a) => idOf(a)).join("/")}::${optionSig}`;
  // Use has(): a legitimately-`undefined` computed result must still register
  // as a cache hit, otherwise it recomputes every call.
  if (sub.has(key)) return sub.get(key) as T;
  const computed = compute();
  sub.set(key, computed);
  return computed;
}
