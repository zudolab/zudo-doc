// Minimal chrome seam for the showcase's KEPT custom home pages
// (pages/index.tsx, pages/[locale]/index.tsx — collision-precedence overrides
// of the package-injected `/` and `/[locale]` routes, #2653 Decision 4). Those
// pages only need `HomePageView`; everything else `createChrome` produces
// (renderDocPage, HeadWithDefaults, …) is unused here.
//
// This replaces the former full `pages/lib/_chrome.ts` (epic
// zudolab/zudo-doc#2651, Wave 6 #2661) — its real host bindings (SearchWidget,
// DocHistory, frontmatter renderers, PresetGenerator, …) moved to
// `src/chrome-bindings.tsx`, consumed here via the same
// `virtual:zudo-doc-chrome-bindings` host-callables channel the 4
// self-contained doc-route stubs use, so the home page's chrome (and the doc
// pages') resolve the SAME real bindings.
//
// The 4 doc-route stubs do NOT import this file — per the locked
// self-contained-stub form (#2653/#2660) they build their own `createChrome`
// call directly from `virtual:zudo-doc-route-context` +
// `@takazudo/zudo-doc/route-context` + `@takazudo/zudo-doc/chrome`, with no
// `pages/lib` or `@/config` imports.

import { routeContext } from "./_route-context";
import { routeContext as virtualRouteContext } from "virtual:zudo-doc-route-context";
import { createChrome } from "@takazudo/zudo-doc/chrome";
import type { RouteContextPayload } from "@takazudo/zudo-doc/factory-context";
import { chromeBindings } from "virtual:zudo-doc-chrome-bindings";

// `_route-context.ts` threads `themePackRegistry: null` because it must stay
// importable from vitest (no virtual modules). The home pages built here DO
// render `<head>`, so they need the REAL resolved registry or the theme-pack
// bootstrap would be missing on `/` — a hard reload of the home page would
// then drop the visitor's selected pack while every doc page kept it. This
// file is build-time-only (it already consumes
// `virtual:zudo-doc-chrome-bindings`), so it can read the routes plugin's
// resolved registry and layer it over the test-safe base context.
// ADR docs/adr/theme-packs.md Decision 2.
const { themePackRegistry } = virtualRouteContext as unknown as RouteContextPayload;

export const { HomePageView } = createChrome(
  { ...routeContext, themePackRegistry },
  chromeBindings,
);
