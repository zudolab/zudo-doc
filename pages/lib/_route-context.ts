// Host route context — the reconstructed RouteContext (settings + i18n + URL
// helpers + nav/slug helpers + identity-stable nav-source resolvers + doc-route
// + route enumerators), built ONCE via the public `createRouteContext`
// (epic Collapse Wiring Shells #2420, FACTORIES #2424).
//
// Kept SEPARATE from `_chrome.ts` so the data shells (`_nav-source-docs`
// / `_doc-route-entries` / `route-enumerators`) — and the unit tests that import
// them — depend ONLY on this lightweight module, NOT on the chrome host bindings
// (which pull the build-time `#doc-history-meta` alias + island components that
// don't resolve under vitest).
//
// The host content bridge (`stableDocs`) is injected so the docs read + nav
// enumeration match the project's existing `pages/*` paths() exactly (host
// `bridgeDocsEntries` over the `@takazudo/zfb/content` snapshot), not the
// package default. `colorSchemes` is the package default
// (`@takazudo/zudo-doc/color-schemes-defaults`) — the showcase's former
// `src/config/color-schemes.ts` override was byte-identical to it and was
// retired in zudolab/zudo-doc#2661.

import { createRouteContext } from "@takazudo/zudo-doc/route-context";
import type { ColorScheme } from "@takazudo/zudo-doc/color-scheme-utils";
import { defaultColorSchemes as colorSchemes } from "@takazudo/zudo-doc/color-schemes-defaults";
import { settings } from "@/config/settings";
import { translations } from "@/config/i18n";
import { tagVocabulary } from "@/config/tag-vocabulary";
import { stableDocs } from "./_nav-source-cache";

export const routeContext = createRouteContext(
  {
    settings,
    translations,
    tagVocabulary,
    colorSchemes: colorSchemes as unknown as Record<string, ColorScheme>,
  },
  { stableDocs },
);
