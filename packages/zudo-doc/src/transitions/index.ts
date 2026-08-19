// Public surface for `@takazudo/zudo-doc/transitions`.
//
// Strategy B (W6A, zudolab/zudo-doc#1522): persist.ts has been deleted.
// Sidebar, header, and footer persistence is now handled by the static
// `data-zfb-transition-persist` attribute on each element — the contract
// that zfb-runtime's <ClientRouter /> swap-functions read. The SSR-injected
// `view-transition-name` style approach (Strategy A) is retired.
//
// What remains:
//   - `page-events.ts` — navigation-lifecycle constants and subscribe
//     helpers. With the SPA router, AFTER_NAVIGATE_EVENT fires after
//     each same-document swap; BEFORE_NAVIGATE_EVENT fires before.
//   - `nested-island-props-refresh.ts` — the document-lifetime helper that
//     refreshes nested-island `data-props` at the `zfb:before-swap` seam
//     (zudolab/zudo-doc#3530).

export {
  BEFORE_NAVIGATE_EVENT,
  AFTER_NAVIGATE_EVENT,
  onBeforeNavigate,
  onAfterNavigate,
} from "./page-events.js";

// `BEFORE_SWAP_EVENT` stays OUT of this barrel on purpose (see its JSDoc in
// page-events.ts): its consumers need the raw event object's `newDocument`, not
// a bare notification, so they import it from `./page-events.js` directly.
//
// The refresh helper's `ensure` entrypoint, by contrast, MUST be reachable
// here. `sidebar-toggle-island` is ejectable, and eject rewrites every
// parent-relative import `../<seg>/<rest>` to `@takazudo/zudo-doc/<seg>`
// (`eject/index.ts`) — so the island's `../transitions/…` import lands on this
// barrel in an ejected project and would otherwise resolve to nothing.
export { ensureNestedIslandPropsRefresh } from "./nested-island-props-refresh.js";
