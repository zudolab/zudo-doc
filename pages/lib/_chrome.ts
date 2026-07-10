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
import { createChrome } from "@takazudo/zudo-doc/chrome";
import { chromeBindings } from "virtual:zudo-doc-chrome-bindings";

export const { HomePageView } = createChrome(routeContext, chromeBindings);
