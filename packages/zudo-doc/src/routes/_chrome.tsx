// routes/_chrome — thin chrome shim for the package-owned route entrypoints
// (epic Package-First Finale #2356, A1 #2361).
//
// The chrome wiring was PROMOTED to the public, shared
// `createChrome(context, hostBindings)` builder
// (`@takazudo/zudo-doc/chrome`, CTX #2423). This module is now just the seam
// that calls it ONCE with the reconstructed route context and the single
// DocHistory host binding needed for island registration (see below) — every
// OTHER host-bound slot resolves to its package-default stub, so the injected
// package-routes render stays byte-identical. The host (HOSTCOLLAPSE wave) will
// call `createChrome` directly with its full real bindings.

import { routeCtx } from "./_context.js";
import { createChrome } from "../chrome/index.js";
import { DocHistory } from "../doc-history/index.js";
import type { ChromeHostBindings } from "../factory-context/index.js";
import type { DocNavNode } from "./_docs-helpers.js";

// Island-scanner contract (load-bearing): the injected doc routes reach the real
// DocHistory client island ONLY through this static import → `createChrome`
// hostBindings chain (docs-slug.tsx → _chrome.tsx → DocHistory). Without it,
// `deriveDocHistorySlot` falls back to the no-op stub, the SSR marker
// `data-zfb-island-skip-ssr="DocHistory"` has no matching registry entry, and the
// History button never hydrates under `packageOwnedRoutes` (zudolab/zudo-doc#2480).
// The import MUST stay static — a dynamic/type-only import stops zfb's island
// scanner from walking it. SSR output is unchanged: `DocHistoryArea` gates on
// `settings.docHistory` and the island is skip-SSR, so binding the real component
// vs the stub is byte-identical. Mirrors the host's `pages/lib/_chrome.ts`.
// (The narrow real-island props signature isn't assignable to the structural
// `FactoryComponent`, so cast — same as the host.)
const chrome = createChrome(routeCtx, {
  DocHistory: DocHistory as unknown as ChromeHostBindings["DocHistory"],
});

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
