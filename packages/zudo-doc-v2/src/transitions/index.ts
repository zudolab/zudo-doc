// Public surface for `@zudo-doc/zudo-doc-v2/transitions`.
//
// Two halves:
//
//   - `view-transitions.ts` — feature detection + a thin
//     `startViewTransition(updateDom)` wrapper around
//     `document.startViewTransition`. Falls back to running the
//     update synchronously on browsers without the API (Firefox).
//
//   - `persist.ts` — helpers for assigning `view-transition-name`
//     to persistent regions like the desktop sidebar, so the
//     browser keeps their identity across navigations.

export {
  isViewTransitionsSupported,
  startViewTransition,
} from "./view-transitions.js";
export type {
  ViewTransitionLike,
  StartViewTransitionResult,
} from "./view-transitions.js";

export {
  sidebarPersistName,
  persistName,
  applyPersistName,
  clearPersistName,
} from "./persist.js";
