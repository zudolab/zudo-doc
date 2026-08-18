// Pure route-pattern → `pages/` candidate-file mapping, extracted so it can
// be unit-tested in isolation from any filesystem probing (#3428, spec for
// zudolab/zudo-doc#3420's DTP shadow diagnostic).
//
// Mirrors zfb's file→route derivation (`zfb-router`'s `scan_pages` /
// `parse_route`, Next.js/Astro-style conventions): the URL's LAST path
// segment may be authored either as a sibling FILE (`segment.<ext>`) or as a
// directory INDEX (`segment/index.<ext>`), for any accepted page extension.
// Earlier segments are always plain directories. Dynamic segments carry
// their bracket syntax unchanged (`[locale]`, `[tag]`, `[...slug]`,
// `[[...slug]]`) because zfb's `injectRoute` pattern syntax matches the
// file-routing bracket syntax 1:1 — no separate translation needed.

/**
 * File extensions zfb's router accepts as `pages/` route sources. Mirrors
 * the Rust-side single source of truth `zfb_types::ROUTABLE_PAGE_EXTENSIONS`
 * (zfb crate `crates/zfb-types/src/page_extensions.rs`) — that constant is
 * not importable from JS, so it is copied here deliberately; keep in sync if
 * zfb ever changes its accepted extension list.
 */
export const ROUTABLE_PAGE_EXTENSIONS = ["tsx", "ts", "jsx", "js", "mdx", "md", "html"] as const;

/**
 * Derive every `pages/`-relative path that would shadow the given injected
 * route pattern (a zfb `injectRoute` pattern string, e.g.
 * `"/docs/tags/[tag]"` or `"/[locale]"`). Pure — no filesystem I/O; the
 * caller probes each candidate against the host's real `pages/` dir.
 *
 * Returns `[]` for the empty/root pattern (`"/"`) — never produced by this
 * plugin's route catalog (zfb rejects `injectRoute("/")` outright), so there
 * is nothing meaningful to derive.
 */
export function derivePagesCandidates(pattern: string): string[] {
  const segments = pattern.split("/").filter(Boolean);
  if (segments.length === 0) return [];

  const lastSegment = segments[segments.length - 1]!;
  const dirPrefix = segments.length > 1 ? `${segments.slice(0, -1).join("/")}/` : "";

  const candidates: string[] = [];
  for (const ext of ROUTABLE_PAGE_EXTENSIONS) {
    candidates.push(`${dirPrefix}${lastSegment}.${ext}`);
    candidates.push(`${dirPrefix}${lastSegment}/index.${ext}`);
  }
  return candidates;
}
