// Shared internal helpers for zfb plugin modules.
//
// `stripTrailingSlash` and `getBasePrefix` were duplicated verbatim across
// doc-history.ts, search-index.ts, and llms-txt.ts (#2338). Extracted here
// so each plugin imports once and the logic stays in one place.
//
// This module is internal to the plugins/ directory — it is NOT exported as
// a public subpath of @takazudo/zudo-doc.

/**
 * Remove a trailing slash from a string. Returns an empty string for any
 * empty or non-string input.
 */
export function stripTrailingSlash(s: string): string {
  if (typeof s !== "string" || s.length === 0) return "";
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

/**
 * Derive the base prefix to prepend to registered dev-middleware routes.
 *
 * zfb's `register(path, handler)` matches against the FULL request URL (no
 * base-stripping), so for a non-root base (e.g. "/my-docs/") the caller must
 * register the full base-prefixed route. For `base="/"` the prefix is empty
 * and the caller's path is used as-is.
 *
 * @param base - The `base` field from the plugin's `ctx.options` (may be
 *               undefined/non-string if not set by the host config).
 */
export function getBasePrefix(base: unknown): string {
  return stripTrailingSlash(typeof base === "string" ? base : "");
}
