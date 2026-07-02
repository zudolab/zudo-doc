// Shared HTML-normalization + hashing helpers for byte-parity checks.
//
// Side-effect-free by design (no top-level CLI execution) so it can be
// imported directly by both:
//   - scripts/parity-diff.mjs (site-wide parity CLI, epic #2420)
//   - packages/zudo-doc/src/__tests__/route-injection-build.slow.test.ts
//     (per-route parity assertions on injected-route builds, PKGWIRE #2425)
//
// Previously these two call sites hand-copied the same normalization regexes
// and sha256 logic; extracted here so there is exactly one source of truth
// (zudolab/zudo-doc#2530).

import { createHash } from "node:crypto";

/**
 * Normalize content-hashed asset filenames in rendered HTML to stable
 * placeholders, so a byte-parity sha256 fingerprint survives refactors that
 * only change build hashes, not the actual markup.
 *
 * Patterns (from `dist/assets/`):
 *   islands-<hex8>.js              → islands-CONTENTHASH.js
 *   islands-chunk-<UPPERCASE8+>.js → islands-chunk-CHUNKHASH.js
 *   styles-<hex8>.css              → styles-CONTENTHASH.css
 */
export function normalizeHtml(html) {
  return html
    .replace(/\/assets\/islands-[a-f0-9]+\.js/g, "/assets/islands-CONTENTHASH.js")
    .replace(/\/assets\/islands-chunk-[A-Z0-9]+\.js/g, "/assets/islands-chunk-CHUNKHASH.js")
    .replace(/\/assets\/styles-[a-f0-9]+\.css/g, "/assets/styles-CONTENTHASH.css");
}

/** SHA-256 hex digest of a UTF-8 string. */
export function sha256(str) {
  return createHash("sha256").update(str, "utf8").digest("hex");
}

/** SHA-256 of normalized HTML — the frozen byte-parity fingerprint. */
export function sha256Html(html) {
  return sha256(normalizeHtml(html));
}
