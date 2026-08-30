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
import type { DocNavNode } from "../site-schema/types.js";
// Imported via the BARE published subpath rather than a relative
// `../chrome-bindings.js`. This file is copied into consumer projects by the
// routes-src mechanism (`scripts/copy-routes-src.mjs`), which rewrites relative
// `../` imports to `@takazudo/zudo-doc/*` specifiers so the copy resolves
// against this package's `dist/`. Writing the bare specifier here directly
// keeps the source identical to that rewritten output.
import { defineChromeBindings } from "@takazudo/zudo-doc/chrome-bindings";
// Host-callables channel (#2501): re-exports `settings.chromeBindingsModule`
// when the host configured one, else `{}` — see
// `plugins/routes.ts` and `docs/adr/route-injection-seam.md`
// ("Host-callables channel — chromeBindingsModule"). Not present on disk; the
// package ships ambient typings for it (`routes/_virtual.d.ts`).
import { chromeBindings } from "virtual:zudo-doc-chrome-bindings";
// Routes-only configured design-token-panel island (#3396) — the ONLY importer
// of `virtual:zudo-doc-design-token-panel-config` in the package. Static, for
// the same island-scanner reason as `DocHistory` above.
import { ConfiguredDesignTokenPanelBootstrap } from "./_design-token-panel-bootstrap.js";

// Island-scanner contract (load-bearing): the injected doc routes reach the real
// DocHistory client island ONLY through this static import → `createChrome`
// hostBindings chain (docs-slug.tsx → _chrome.tsx → DocHistory). Without it,
// `deriveDocHistorySlot` falls back to the no-op stub, the SSR marker
// `data-zfb-island-skip-ssr="DocHistory"` has no matching registry entry, and the
// History button never hydrates under `packageOwnedRoutes` (zudolab/zudo-doc#2480).
// The import MUST stay static — a dynamic/type-only import stops zfb's island
// scanner from walking it. SSR output is unchanged: `DocHistoryArea` gates on
// `settings.docHistory` and the island is skip-SSR, so binding the real component
// vs the stub is byte-identical. Mirrors the host's `src/chrome-bindings.tsx`.
// (The narrow real-island props signature isn't assignable to the structural
// `FactoryComponent`, so it's widened through `defineChromeBindings` — same
// helper the host uses — which checks `DocHistory` against its real call-side
// prop contract before performing the widening, restoring the #2674
// drift-detection check a bare cast would erase.)
//
// The statically imported DocHistory is spread AFTER `...chromeBindings` so
// scanner-safe hydration wins consistently with generated self-contained
// routes. Hosts can override every other slot; DocHistory customization uses
// the package island's supported owner path rather than a virtual callable
// that the scanner cannot register. `chromeBindings` (the virtual re-export) is already
// erased to the structural `ChromeHostBindings` at its own source, so it is
// spread as-is rather than run back through `defineChromeBindings` (which
// cannot recover types `defineChromeBindings` never checked in the first
// place). Note the SSR-presentational-only limitation: a client island defined
// INSIDE the bindings module is not guaranteed to register on injected routes
// the way the static `DocHistory` import above is (the virtual re-export sits
// outside zfb's static-import scanner reachability graph) — see the ADR.
//
// `DesignTokenPanelBootstrap` IS threaded here since #3396, but only to swap
// the BUILDER — the mount, the settings gate, and the slot default all still
// belong to `chrome/derive.tsx`'s `deriveBodyEndIslands` (gate-2 fix from the
// Wave-5 confirm #2659), so the locked-manifest self-contained doc stub (#2653)
// and every other bare `createChrome` caller keep getting the package-default
// island with no explicit wiring. On THESE injected routes the configured
// wrapper wins, which is what carries a host's
// `settings.designTokenPanelConfigModule` through. Scanner reachability holds
// through the static chain route → this shim → `_design-token-panel-bootstrap`.
//
// It is spread BEFORE `...chromeBindings` (unlike `DocHistory`, which is spread
// after): a host's own `DesignTokenPanelBootstrap` slot value must still win,
// exactly as it did when the derive-level default was the only package wiring.
const chrome = createChrome(routeCtx, {
  ...defineChromeBindings({
    DesignTokenPanelBootstrap: ConfiguredDesignTokenPanelBootstrap,
  }),
  ...chromeBindings,
  ...defineChromeBindings({ DocHistory }),
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
  HomePageView,
  AssetPageView,
  AssetIndexPageView,
} = chrome;

// The doc-route-entries builder lives on the route context; the doc entrypoints
// import it from this chrome module so they reach a single barrel.
export { buildDocRouteEntries } from "./_context.js";
export type { DocNavNode };
