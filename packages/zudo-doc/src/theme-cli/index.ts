// theme-cli — public barrel for `zudo-doc theme list|apply` (issue #2824;
// ADR docs/adr/theme-packs.md). Mirrors `src/eject/index.ts`'s shape:
// implementation compiled to `dist/theme-cli/`, imported by the plain-ESM
// `bin/zudo-doc.mjs` (no `tsx` requirement at runtime).

export {
  listThemePacks,
  formatThemeList,
  type ThemeListRow,
  type ThemeListResult,
  type ListThemePacksOptions,
} from "./list.js";

export { applyThemePack, type ApplyThemePackOptions, type ApplyThemePackResult } from "./apply.js";

export {
  loadInstalledThemePackCatalog,
  type LoadInstalledThemePackCatalogOptions,
  type ThemePackRegistry,
  type ThemePackRegistryEntry,
} from "./registry.js";

export {
  detectActiveThemePack,
  resolveZfbConfigPath,
  ZFB_CONFIG_FILENAME,
  type DetectActiveThemePackResult,
} from "./config-io.js";

export {
  applyThemePackToConfigSource,
  type ApplyThemePackToSourceOk,
  type ApplyThemePackToSourceRefusal,
  type ApplyThemePackToSourceResult,
} from "./config-rewriter.js";

export {
  readThemePackProvenance,
  writeThemePackProvenance,
  ZUDO_DOC_JSON_FILENAME,
  THEME_PACK_PROVENANCE_SCHEMA_VERSION,
  type ThemePackProvenance,
} from "./provenance.js";

export { ConfigSyntaxError } from "./config-scanner.js";
