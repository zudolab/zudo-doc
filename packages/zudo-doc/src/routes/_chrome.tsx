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
// Island-scanner contract (load-bearing, #2658 — mirrors the DocHistory chain
// directly below): the injected routes reach the real DesignTokenPanelBootstrap
// client island ONLY through this static import → `createChrome` hostBindings
// chain (docs-slug.tsx → _chrome.tsx → design-token-panel-bootstrap.tsx). This
// import MUST stay static for the same reason as DocHistory's below — see that
// comment. `DesignTokenPanelBootstrap` also carries its own top-level import of
// `virtual:zudo-doc-design-token-panel-config` (the routes plugin's third
// virtual module, `plugins/routes.ts`), which is why the component lives in a
// dedicated module rather than being reconstructed inline in
// `doc-body-end-islands/index.tsx` — see that module's header note.
import { DesignTokenPanelBootstrap } from "../design-token-panel-bootstrap.js";
import type { ChromeHostBindings } from "../factory-context/index.js";
import type { DocNavNode } from "./_docs-helpers.js";
// Host-callables channel (#2501): re-exports `settings.chromeBindingsModule`
// when the host configured one, else `{}` — see
// `plugins/routes.ts` and `docs/adr/route-injection-seam.md`
// ("Host-callables channel — chromeBindingsModule"). Not present on disk; the
// package ships ambient typings for it (`routes/_virtual.d.ts`).
import { chromeBindings } from "virtual:zudo-doc-chrome-bindings";

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
//
// `...chromeBindings` is spread AFTER the `DocHistory` default so a host that
// configured `chromeBindingsModule` can override ANY slot — including
// DocHistory itself — while a host that didn't still gets the #2480 fix for
// free. Note the SSR-presentational-only limitation: a client island defined
// INSIDE the bindings module is not guaranteed to register on injected routes
// the way the static `DocHistory` import above is (the virtual re-export sits
// outside zfb's static-import scanner reachability graph) — see the ADR.
const chrome = createChrome(routeCtx, {
  DocHistory: DocHistory as unknown as ChromeHostBindings["DocHistory"],
  DesignTokenPanelBootstrap:
    DesignTokenPanelBootstrap as unknown as ChromeHostBindings["DesignTokenPanelBootstrap"],
  ...chromeBindings,
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
} = chrome;

// The doc-route-entries builder lives on the route context; the doc entrypoints
// import it from this chrome module so they reach a single barrel.
export { buildDocRouteEntries } from "./_context.js";
export type { DocNavNode };
