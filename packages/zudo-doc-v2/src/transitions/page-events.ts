// Page navigation lifecycle events for the v2 transitions module.
//
// Background
// ----------
// Before zudolab/zudo-doc#1335 (E2 task 2 half B), cross-page
// transitions still relied on Astro's `<ClientRouter />` lifecycle
// events:
//
//   * `astro:before-preparation` — fires just before the new page DOM
//     is fetched / prepared (i.e. immediately when navigation starts).
//   * `astro:page-load` — fires after the new page has fully loaded
//     (initial load + every soft navigation).
//
// After the migration, the engine-side cross-page wrapper is zfb's
// `<ViewTransitions />` (zfb #99), mounted in the doc-layout shell.
// zfb's component intercepts same-origin link clicks and wraps the
// navigation in `document.startViewTransition` — but each hop is still
// a real, full page load (no SPA-style DOM swap). zfb does NOT
// dispatch any custom router events.
//
// This means the v2 vocabulary now resolves to standard browser
// lifecycle events that fire on every full page load:
//
//   * `BEFORE_NAVIGATE_EVENT = "pagehide"` — fires when the current
//     page is being unloaded (the browser-standard "leaving the page"
//     hook). This is the closest one-shot signal to "navigation
//     started" in the full-reload model and is also stable across
//     bfcache hops.
//   * `AFTER_NAVIGATE_EVENT = "DOMContentLoaded"` — fires once on
//     each newly-loaded document, after parsing is done. Because
//     every navigation under zfb's runtime is a real page load, this
//     is the direct successor to Astro's `astro:page-load` (which
//     also fired on initial paint and after every soft swap).
//
// Components inside zudo-doc-v2 should not reach for those event
// names directly — go through the constants below (or the
// `onBeforeNavigate` / `onAfterNavigate` helpers) so the transitions
// module owns the vocabulary. If zfb later supplies a richer router
// with its own custom events, only this file changes.
//
// All functions are SSR-safe: when `document` is unavailable they
// return a no-op unsubscribe and never throw.

/**
 * Event name fired at the start of a navigation away from the current
 * page. Today resolves to `"pagehide"` (browser-standard unload hook).
 * Equivalent to "page-loading-begin" / Astro's
 * `astro:before-preparation` in the v2 vocabulary.
 */
export const BEFORE_NAVIGATE_EVENT = "pagehide";

/**
 * Event name fired once the new page has loaded. Today resolves to
 * `"DOMContentLoaded"` — fires once per real page load, which under
 * zfb's full-reload navigation model is the natural successor to
 * Astro's `astro:page-load` (fired on initial paint + every soft
 * swap; with no soft swaps, every load IS the after-navigate signal).
 */
export const AFTER_NAVIGATE_EVENT = "DOMContentLoaded";

/**
 * Subscribe to "navigation start" — runs `handler` each time the user
 * navigates away from the current page (zfb's `<ViewTransitions />`
 * intercepts same-origin link clicks and wraps the navigation in
 * `document.startViewTransition`; the browser still dispatches
 * `pagehide` on the outgoing document).
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
 * Subscribe to "navigation end" — runs `handler` after each page load.
 * Mirrors Astro's `astro:page-load`: fires once on first load, and
 * again on every full-reload navigation (which under zfb is every
 * navigation).
 *
 * Returns an unsubscribe function. SSR-safe: returns a no-op when
 * called outside a browser.
 */
export function onAfterNavigate(handler: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  document.addEventListener(AFTER_NAVIGATE_EVENT, handler);
  return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, handler);
}
