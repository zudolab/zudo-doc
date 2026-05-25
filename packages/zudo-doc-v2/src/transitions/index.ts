// Public surface for `@zudo-doc/zudo-doc-v2/transitions`.
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

export {
  BEFORE_NAVIGATE_EVENT,
  AFTER_NAVIGATE_EVENT,
  onBeforeNavigate,
  onAfterNavigate,
} from "./page-events.js";
