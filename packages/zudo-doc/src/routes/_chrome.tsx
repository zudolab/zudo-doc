// routes/_chrome — thin chrome shim for the package-owned route entrypoints
// (epic Package-First Finale #2356, A1 #2361).
//
// The chrome wiring was PROMOTED to the public, shared
// `createChrome(context, hostBindings)` builder
// (`@takazudo/zudo-doc/chrome`, CTX #2423). This module is now just the seam
// that calls it ONCE with the reconstructed route context and NO host bindings
// — so every host-bound slot resolves to its package-default stub and the
// injected package-routes render is byte-identical to before. The host
// (HOSTCOLLAPSE wave) will call `createChrome` directly with real bindings.

import { routeCtx } from "./_context.js";
import { createChrome } from "../chrome/index.js";
import type { DocNavNode } from "./_docs-helpers.js";

// Empty host bindings → package-default stubs (byte-identical injected path).
const chrome = createChrome(routeCtx);

export const {
  composeMetaTitle,
  HeadWithDefaults,
  HeaderWithDefaults,
  FooterWithDefaults,
  SidebarWithDefaults,
  renderDocPage,
  VersionsPageView,
  collectTagMapForLocale,
  TagDetailPageView,
  TagsIndexPageView,
  SiteTreeNavWrapper,
  BodyEndIslands,
} = chrome;

// The doc-route-entries builder lives on the route context; the doc entrypoints
// import it from this chrome module so they reach a single barrel.
export { buildDocRouteEntries } from "./_context.js";
export type { DocNavNode };
