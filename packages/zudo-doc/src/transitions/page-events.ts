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
// `<ClientRouter />` mounted in the doc-layout shell, which now
// implements VT Strategy B: an SPA-style same-document body swap on
// every same-origin link click, dispatching its own custom lifecycle
// events on `document` (zudolab/zudo-doc#1510, port from zfb #226).
//
// Lifecycle events fired by zfb's client-router on `document`:
//
//   * `zfb:before-preparation` — fires just before the next page DOM
//     is fetched / prepared (i.e. immediately when navigation starts).
//     Closest analogue to Astro's `astro:before-preparation`.
//   * `zfb:after-swap` — fires after the new page's `<body>` has been
//     swapped into the live document.
//     Closest analogue (for the swap-completion signal) to Astro's
//     `astro:after-swap`. Note: this fires only AFTER an SPA body swap;
//     it does NOT fire on the initial page load (the runtime dispatches
//     `zfb:page-load` for that). Consumers that need a first-paint init
//     should call their init helper at the top level of the inline
//     script (see e.g. sidebar-resizer-init.tsx, version-switcher.tsx)
//     in addition to subscribing here for re-init across SPA hops.
//
// Components inside zudo-doc should not reach for those event
// names directly — go through the constants below (or the
// `onBeforeNavigate` / `onAfterNavigate` helpers) so the transitions
// module owns the vocabulary. If zfb later renames its lifecycle
// events, only this file changes.
//
// All functions are SSR-safe: when `document` is unavailable they
// return a no-op unsubscribe and never throw.

/**
 * Event name fired at the start of a navigation away from the current
 * page. Today resolves to `"zfb:before-preparation"` — dispatched by
 * zfb's client-router on `document` immediately when a same-origin
 * link click is intercepted (Strategy B SPA navigation). Equivalent
 * to "page-loading-begin" / Astro's `astro:before-preparation` in
 * the v2 vocabulary.
 */
export const BEFORE_NAVIGATE_EVENT = "zfb:before-preparation";

/**
 * Event name fired once the new page's `<body>` has been swapped in.
 * Today resolves to `"zfb:after-swap"` — dispatched by zfb's
 * client-router after a Strategy B SPA navigation completes (and on
 * the initial page load, so consumers register one listener and get
 * both first-paint and post-swap behavior). Direct successor to
 * Astro's `astro:page-load`.
 */
export const AFTER_NAVIGATE_EVENT = "zfb:after-swap";

/**
 * Event name fired just BEFORE the new page's `<body>` (and `<head>`) are
 * swapped into the live document. Today resolves to `"zfb:before-swap"` —
 * dispatched by zfb's client-router with a mutable `event.newDocument`
 * carrying the incoming document that is about to replace the live one
 * (zudolab/zudo-doc#3136 / #3137). Consumers that need to influence the
 * incoming document BEFORE zfb's head-swap persistence logic runs (e.g.
 * injecting a `<link>` so an href-matching stylesheet survives the swap
 * instead of being removed and re-fetched) must mutate `event.newDocument`
 * synchronously from a handler registered on this event — by the time
 * `AFTER_NAVIGATE_EVENT` fires the swap has already completed. This module
 * does not export a subscribe helper for it (unlike `onBeforeNavigate` /
 * `onAfterNavigate`) because the one current consumer
 * (`theme-pack-provider.tsx`) needs the raw event object's `newDocument`,
 * not just a bare notification.
 */
export const BEFORE_SWAP_EVENT = "zfb:before-swap";

/**
 * Subscribe to "navigation start" — runs `handler` each time the user
 * navigates away from the current page. zfb's `<ClientRouter />`
 * intercepts same-origin link clicks and dispatches
 * `zfb:before-preparation` on `document` before fetching the next
 * page DOM.
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
 * Subscribe to "navigation end" — runs `handler` after each page-body
 * swap. Mirrors Astro's `astro:page-load`: fires once on first load,
 * and again on every SPA navigation (zfb's Strategy B client-router
 * dispatches `zfb:after-swap` on the document for both cases).
 *
 * Returns an unsubscribe function. SSR-safe: returns a no-op when
 * called outside a browser.
 */
export function onAfterNavigate(handler: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  document.addEventListener(AFTER_NAVIGATE_EVENT, handler);
  return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, handler);
}
