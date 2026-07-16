// plugins/internal/theme-packs/types — shared options/type surface for the
// theme-packs plugin's postBuild copy step and devMiddleware (ADR
// docs/adr/theme-packs.md, Decision 2, #2820).

import type { ThemePackMeta } from "../../../theme-packs-registry/index.js";

/**
 * Options threaded from `preset.ts`'s `buildPlugins()` into the
 * `@takazudo/zudo-doc/plugins/theme-packs` bare-specifier descriptor — the
 * settings subset `resolveEnabledPacks` needs, plus `base` for URL
 * prefixing in `devMiddleware`.
 */
export interface ThemePacksPluginOptions {
  base?: string;
  themePack?: string;
  themePacks?: string[];
}

/**
 * The aggregated registry manifest shape written to (postBuild) / served at
 * (devMiddleware) `theme-packs/index.json` — ADR Decision 1, "registry
 * manifest": `{ schemaVersion: 1, packs: ThemePackMeta[] }`, `packs` in the
 * resolved `themePacks` order.
 */
export interface ThemePacksIndexManifest {
  schemaVersion: 1;
  packs: ThemePackMeta[];
}
