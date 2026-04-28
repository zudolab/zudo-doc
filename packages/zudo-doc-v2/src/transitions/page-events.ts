// Page navigation lifecycle events for the v2 transitions shim.
//
// Background
// ----------
// During the Astro → zfb migration, cross-page View Transitions still
// rely on Astro's `<ClientRouter />` lifecycle events:
//
//   * `astro:before-preparation` — fires just before the new page DOM
//     is fetched / prepared (i.e. immediately when navigation starts).
//   * `astro:page-load` — fires after the new page has fully loaded
//     (initial load + every soft navigation).
//
// Components inside zudo-doc-v2 should not reach for those event names
// directly. The transitions module owns the cross-page lifecycle
// vocabulary so that, when zfb later supplies its own router events,
// only this file has to change. Consumers go through the helpers below
// (or, when an inline `<script>` is required, through the constants
// re-exported from `./index.ts`).
//
// All functions are SSR-safe: when `document` is unavailable they
// return a no-op unsubscribe and never throw.

/**
 * Event name fired at the start of a page navigation, before the
 * incoming DOM has been prepared. Equivalent to "page-loading-begin"
 * in the v2 vocabulary; today resolves to Astro's
 * `astro:before-preparation`.
 */
export const BEFORE_NAVIGATE_EVENT = "astro:before-preparation";

/**
 * Event name fired once the new page has fully loaded (initial paint
 * and after every soft navigation). Equivalent to "page-loading-end"
 * in the v2 vocabulary; today resolves to Astro's `astro:page-load`.
 */
export const AFTER_NAVIGATE_EVENT = "astro:page-load";

/**
 * Subscribe to "navigation start" — runs `handler` each time the user
 * triggers a soft navigation, before the new DOM is swapped in.
 *
 * Returns an unsubscribe function. SSR-safe: if `document` is undefined
 * (server / non-browser host) returns a no-op unsubscribe.
 */
export function onBeforeNavigate(handler: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  document.addEventListener(BEFORE_NAVIGATE_EVENT, handler);
  return () => document.removeEventListener(BEFORE_NAVIGATE_EVENT, handler);
}

/**
 * Subscribe to "navigation end" — runs `handler` after each page load
 * (including the initial paint). Mirrors Astro's `astro:page-load`,
 * which fires once on first load and after every soft navigation.
 *
 * Returns an unsubscribe function. SSR-safe: returns a no-op when
 * called outside a browser.
 */
export function onAfterNavigate(handler: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  document.addEventListener(AFTER_NAVIGATE_EVENT, handler);
  return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, handler);
}
