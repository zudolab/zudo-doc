/**
 * Public entry for `@takazudo/zudo-doc/url-normalizer`.
 *
 * Build-time URL normalizer that ensures every emitted route URL ends with
 * a trailing slash, matching the `trailingSlash: "always"` policy of the
 * legacy Astro build.
 *
 * ## Why build-time only?
 *
 * zfb is a purely static site builder — there is no server or dev middleware.
 * The Astro `src/middleware-handler.ts` ran at request time; the equivalent
 * guarantee is now split:
 *
 * - **Build time** (this module): `buildUrl()` constructs URLs that always
 *   end with `/`, and `normalizePathname()` corrects any bare pathname passed
 *   in from external data.
 * - **Runtime**: the deployment host (e.g. Cloudflare Pages `_redirects`) is
 *   responsible for redirecting requests that arrive without a trailing slash.
 *
 * See the "Trailing-Slash Policy" concept doc in the showcase docs for the
 * full design rationale and an example `_redirects` rule.
 *
 * ## Usage
 *
 * ```ts
 * import {
 *   buildUrl,
 *   normalizePathname,
 *   shouldSkipNormalization,
 * } from "@takazudo/zudo-doc/url-normalizer";
 *
 * // In a paths() implementation:
 * const url = buildUrl("docs", slug);  // "/docs/my-slug/"
 *
 * // In an integration that receives raw pathnames:
 * const canonical = normalizePathname(rawPathname);
 * ```
 */

export { buildUrl, normalizePathname, shouldSkipNormalization } from "./normalize.js";
