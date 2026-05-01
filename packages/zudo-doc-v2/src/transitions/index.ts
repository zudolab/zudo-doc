// Public surface for `@zudo-doc/zudo-doc-v2/transitions`.
//
// After zudolab/zudo-doc#1335 (E2 task 2 half A), the engine-side cross-
// page View Transitions wrapper is owned by zfb's `<ViewTransitions />`
// component (`@takazudo/zfb-runtime` per zfb #99) — mounted in the
// doc-layout shell. The previous `view-transitions.ts` shim that
// re-exported `isViewTransitionsSupported()` / `startViewTransition()`
// has been retired: zfb's component subsumes the feature-detect plus
// click-intercepting router, no consumer here was calling those helpers
// for non-navigation DOM updates, and `persist.ts` already documents
// that the unconditional `view-transition-name` write is safe in
// browsers without VT support (no feature gate needed).
//
// Two halves remain:
//
//   - `persist.ts` — helpers for assigning `view-transition-name`
//     to persistent regions like the desktop sidebar, so the
//     browser keeps their identity across navigations. Orthogonal
//     to the engine's mount; this is a per-element CSS concern.
//
//   - `page-events.ts` — navigation-lifecycle constants and
//     subscribe helpers. With zfb's full-reload navigation model
//     (no SPA-style swap), the constants resolve to standard
//     browser events that fire on every page lifecycle hop.

export {
  sidebarPersistName,
  persistName,
  applyPersistName,
  clearPersistName,
} from "./persist.js";

export {
  BEFORE_NAVIGATE_EVENT,
  AFTER_NAVIGATE_EVENT,
  onBeforeNavigate,
  onAfterNavigate,
} from "./page-events.js";
