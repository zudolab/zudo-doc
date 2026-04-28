/**
 * Build-time URL normalizer for zfb static sites.
 *
 * ## Design rationale
 *
 * Astro's dev server ran trailing-slash normalization as server middleware
 * (`src/middleware-handler.ts`). zfb is purely static — there is no dev
 * middleware layer — so trailing-slash policy splits into two concerns:
 *
 * 1. **Build time** (this module): every route URL emitted during the build
 *    (paths() calls, sitemap entries, llms.txt entries, etc.) ends with `/`.
 *    `buildUrl()` and `normalizePathname()` enforce that invariant.
 *
 * 2. **Runtime** (host's responsibility): when a visitor navigates to a URL
 *    without a trailing slash, the deployment host (e.g. Cloudflare Pages)
 *    issues a 301 redirect to the canonical trailing-slash form.  For
 *    Cloudflare Pages, add one rule to `public/_redirects`:
 *
 *    ```
 *    # Redirect all non-slash paths to the canonical trailing-slash form.
 *    # Place this BEFORE any page-specific rules.
 *    /:path  /:path/  301
 *    ```
 *
 * By keeping build-time normalisation here and runtime redirects on the host,
 * the framework stays platform-agnostic: swap the host and only the
 * `_redirects` file changes, not this module.
 *
 * ## Skip rules (ported from middleware-handler.ts)
 *
 * The following pathnames bypass normalisation — they are static assets that
 * should never gain a trailing slash:
 *
 * - Already ends with `/` (no-op).
 * - Last path segment contains a file extension whose leading character is a
 *   letter, e.g. `.js`, `.css`, `.png`, `.woff2`. The letter check prevents
 *   version strings like `v2.0` from being treated as extensions.
 *
 * The Astro-internal prefixes `/_astro/` and `/_image` are preserved in
 * `shouldSkipNormalization()` for completeness, even though zfb uses
 * different internal path shapes. They are harmless and aid forward
 * compatibility with any zfb equivalent that adopts the same conventions.
 */

/**
 * Build a directory-style URL (always trailing slash) from path segments.
 *
 * Segments are joined with `/`, leading/trailing slashes are collapsed, and
 * the result is wrapped in `/<joined>/`. Empty segments are filtered out.
 * The root case (no segments, or all empty) returns `"/"`.
 *
 * This is the canonical way to construct emitted URLs in zfb pages and
 * integrations — it guarantees the invariant that every generated URL ends
 * with `/`, matching `trailingSlash: "always"` in the legacy Astro build.
 *
 * @example
 * buildUrl("docs", "guides", "getting-started") // "/docs/guides/getting-started/"
 * buildUrl("ja", "docs", "intro")               // "/ja/docs/intro/"
 * buildUrl()                                     // "/"
 * buildUrl("", "docs", "")                       // "/docs/"
 */
export function buildUrl(...segments: string[]): string {
  const joined = segments
    .filter((s) => s !== "")
    .join("/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  return joined === "" ? "/" : `/${joined}/`;
}

/**
 * Return `true` when `pathname` should NOT receive a trailing slash.
 *
 * The check covers:
 * - Already ends with `/` — already normalised, nothing to do.
 * - Astro-internal prefixes `/_astro/` and `/_image` — kept for forward
 *   compatibility; these paths are never part of the content URL space.
 * - The last segment looks like a filename: its extension starts with a
 *   letter (`/assets/app.js`, `/images/logo.png`, `/fonts/inter.woff2`).
 *   The letter constraint prevents version strings like `/docs/v2.0` from
 *   being mistakenly treated as a static-asset path.
 *
 * @example
 * shouldSkipNormalization("/docs/guide/")          // true  (already has slash)
 * shouldSkipNormalization("/assets/app.js")        // true  (file extension)
 * shouldSkipNormalization("/_astro/chunk.abc.js")  // true  (internal prefix)
 * shouldSkipNormalization("/docs/guide")           // false (needs trailing slash)
 * shouldSkipNormalization("/docs/v2.0")            // false (number after dot → not an extension)
 */
export function shouldSkipNormalization(pathname: string): boolean {
  // Already normalised.
  if (pathname.endsWith("/")) return true;

  // Astro/zfb internal paths.
  if (pathname.startsWith("/_astro/") || pathname.startsWith("/_image")) {
    return true;
  }

  // Static asset: last segment has an extension whose first char is a letter.
  const lastSegment = pathname.split("/").pop() ?? "";
  if (/\.[a-zA-Z]\w*$/.test(lastSegment)) return true;

  return false;
}

/**
 * Return `pathname` with a trailing slash appended if needed.
 *
 * Passes through pathnames that already satisfy `shouldSkipNormalization()`.
 * Query strings are preserved intact (the URL object is not involved here —
 * pass only the pathname).
 *
 * **Important:** this operates on the *pathname* portion only. For a full
 * URL with query string or fragment, split out the pathname first:
 *
 * ```ts
 * const url = new URL(rawUrl);
 * const normalized = normalizePathname(url.pathname) + url.search;
 * ```
 *
 * @example
 * normalizePathname("/docs/guide")   // "/docs/guide/"
 * normalizePathname("/docs/guide/")  // "/docs/guide/"  (no-op)
 * normalizePathname("/assets/app.js") // "/assets/app.js"  (skipped)
 */
export function normalizePathname(pathname: string): string {
  if (shouldSkipNormalization(pathname)) return pathname;
  return pathname + "/";
}
