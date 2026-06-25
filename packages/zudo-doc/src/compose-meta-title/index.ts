// compose-meta-title — parameterized factory for the canonical
// "<title> | <siteName>" page-title composition (epic #2344, S1b).
//
// The host's `pages/lib/_compose-meta-title.ts` previously read
// `settings.siteName` at module scope. This factory receives the
// site name as an argument so the logic lives in the package while
// the host stub keeps the singleton import.
//
// Edge cases:
// - When `title` is identical to `siteName` (e.g. the home page already
//   passes the site name as the title), do NOT duplicate — return just the
//   bare site name. Mirrors the legacy Astro behaviour.
// - When `siteName` is missing/empty (defensive — settings always has it in
//   practice), fall back to the bare title.

/**
 * Create a `composeMetaTitle` helper bound to the given site name.
 *
 * Mirrors the shape of `makeUrlHelpers` (S1a) — the host stub calls this
 * once with its concrete `settings.siteName` and re-exports the result.
 */
export function createComposeMetaTitle(siteName: string): (title: string) => string {
  return function composeMetaTitle(title: string): string {
    if (!siteName) return title;
    if (title === siteName) return siteName;
    return `${title} | ${siteName}`;
  };
}
