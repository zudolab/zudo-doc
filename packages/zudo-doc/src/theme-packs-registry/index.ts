// theme-packs-registry — public barrel (ADR `docs/adr/theme-packs.md`).
//
// Three independent pieces, per the ADR:
//   - `loadThemePackRegistry` — node-side fs scan of `theme-packs/<slug>/`
//     directories (used by `src/plugins/routes.ts`'s `setup()`, and will be
//     reused by `src/plugins/theme-packs.ts`, #2820).
//   - `resolveEnabledPacks` — PURE settings ∩ bundled-registry resolver.
//   - `validateThemePack` — PURE, filesystem-free pack validator (also the
//     build-time check `scripts/copy-theme-packs.mjs`, #2820, will run per
//     pack before copying to `dist/`).
//
// `factory-context/index.ts` imports `ThemePackRegistry`/`ThemePackMeta` as
// `import type` only (erased before bundling) so the node-side `node:fs`
// import in `load-registry.ts` never reaches the node-free config eval graph
// (`config.ts`/`preset.ts` — see their eval-graph guards).

export {
  THEME_PACK_SLUG_RE,
  DEFAULT_THEME_PACK_SLUG,
  themePackMetaSchema,
  type ThemePackMeta,
  type ThemePackSwatches,
} from "./meta-schema.js";

export {
  KNOWN_THEME_PACK_TOKEN_NAMES,
  COMMERCIAL_FONT_DENYLIST,
  THEME_PACK_SOFT_BUDGET_BYTES,
} from "./token-manifest.js";

export {
  validateThemePack,
  type ThemePackValidationInput,
  type ThemePackValidationIssue,
  type ThemePackValidationResult,
  type ThemePackValidationSeverity,
} from "./validator.js";

export {
  loadThemePackRegistry,
  type ThemePackRegistry,
  type ThemePackRegistryEntry,
} from "./load-registry.js";

export {
  resolveEnabledPacks,
  type ResolveEnabledPacksSettings,
} from "./resolve-enabled-packs.js";
