// Helpers for keeping persistent regions stable across View Transitions.
//
// The native View Transitions API uses CSS `view-transition-name: <name>`
// to mark elements as "the same element on both sides of the swap." When
// a name matches between the old and new DOM, the browser cross-fades
// the two states instead of treating them as unrelated. That is the
// modern equivalent of Astro's `transition:persist` directive.
//
// In practice the desktop sidebar is the only thing zudo-doc cares about
// here: keeping its scroll position across page navigations is one of
// the View-Transitions migration's hard acceptance criteria. The naming
// convention we use is `sidebar-${lang}-${section}` — the same shape
// the original Astro layout passed to `transition:persist`.
//
// This module ships:
//
//   - a small `persistName(...)` helper that builds the canonical name
//     from a language tag and an optional nav-section,
//   - `applyPersistName(el, name)` which writes the
//     `view-transition-name` style on an element,
//   - and `clearPersistName(el)` for the unmount path.
//
// Browsers without View Transitions ignore unknown style properties,
// so applying the name unconditionally is safe — there is no need to
// branch on `isViewTransitionsSupported()`.

const SIDEBAR_PREFIX = "sidebar";

/** Anything CSS-identifier-incompatible we replace with `_`. */
const NON_IDENTIFIER_CHAR = /[^A-Za-z0-9_-]+/g;

/**
 * Build the `view-transition-name` value for the desktop sidebar.
 *
 * The original Astro layout used the literal `sidebar-${lang}-${section ?? "default"}`
 * shape. We preserve that exactly so tooling that greps the CSS for the
 * sidebar's transition name keeps working after the migration.
 */
export function sidebarPersistName(lang: string, section?: string): string {
  const safeLang = sanitize(lang) || "default";
  const safeSection = sanitize(section ?? "") || "default";
  return `${SIDEBAR_PREFIX}-${safeLang}-${safeSection}`;
}

/**
 * Generic helper for any persistent region (modal trigger, fixed
 * notification banner, etc.). Concatenates the parts with `-` and
 * sanitizes them into CSS-identifier territory.
 */
export function persistName(...parts: ReadonlyArray<string | undefined | null>): string {
  const cleaned = parts
    .map((p) => sanitize(p ?? ""))
    .filter((p) => p.length > 0);
  if (cleaned.length === 0) {
    return "default";
  }
  return cleaned.join("-");
}

/**
 * Set `view-transition-name` on an element. Pass `null` or empty string
 * to clear it instead. Idempotent — safe to call on every render.
 *
 * Uses `setProperty` so it works on the inline-style declaration in
 * older browsers that don't expose the camelCased
 * `style.viewTransitionName` accessor (Firefox 124+, Safari 18+ added
 * the property; for everyone else the `setProperty` call is a no-op
 * write that does no harm).
 */
export function applyPersistName(el: HTMLElement, name: string | null | undefined): void {
  if (typeof el === "undefined" || el === null) return;
  if (!name) {
    el.style.removeProperty("view-transition-name");
    return;
  }
  el.style.setProperty("view-transition-name", name);
}

/** Convenience for the unmount / cleanup path. */
export function clearPersistName(el: HTMLElement): void {
  applyPersistName(el, null);
}

/**
 * Best-effort sanitizer for incoming language / section strings. The
 * `view-transition-name` CSS property accepts a CSS `<custom-ident>`,
 * which is far stricter than what arbitrary user input might contain.
 * We collapse anything outside `[A-Za-z0-9_-]` to `_` so dynamic values
 * (e.g. an i18n locale read from the URL) do not produce malformed CSS.
 */
function sanitize(value: string): string {
  return value
    .trim()
    .replace(NON_IDENTIFIER_CHAR, "_")
    .replace(/^_+|_+$/g, "");
}
