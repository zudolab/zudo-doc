// Thin shim — the route enumerators ride on the unified ChromeContext now
// (epic Collapse Wiring Shells #2420, FACTORIES #2424). `createRouteContext`
// (in _chrome-context.ts) assembles the enumerators as part of the route
// context; this module just re-exports them so the sitemap + any other callers
// keep importing them from here unchanged.

import { routeContext } from "./_route-context";

export const {
  enumerateDocsRoutes,
  enumerateTagsRoutes,
  enumerateVersionedRoutes,
  enumerateAllRoutes,
} = routeContext;
