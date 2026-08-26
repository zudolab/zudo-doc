// theme-packs-registry — public barrel (ADR `docs/adr/theme-packs.md`).
//
// This is the browser-safe half of the registry split, per the ADR:
//   - `buildThemePackRegistry` — catalog-v2 + settings projection builder.
//   - `resolveEnabledPacks` — PURE settings ∩ bundled-registry resolver.
//   - `validateThemePack` — PURE, filesystem-free pack validator (also the
//     build-time check `scripts/copy-theme-packs.mjs`, #2820, will run per
//     pack before copying to `dist/`).
//   - `meta-schema`, `token-manifest`, and registry types.
//
// The node-side `loadThemePackRegistry` filesystem scan intentionally does
// NOT come through this barrel. Node callers import `./load-registry.js`
// directly so this public subpath stays safe for browser and Worker bundles.
//
// Existing factory-context consumers import the registry shapes as types only
// (the payload-types leaf owns those declarations), so this barrel can remain
// in the node-free config/browser graph without pulling in the loader.

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

export type { ThemePackRegistry, ThemePackRegistryEntry } from "./types.js";

export {
  resolveEnabledPacks,
  type ResolveEnabledPacksSettings,
} from "./resolve-enabled-packs.js";

export {
  buildThemePackRegistry,
  schemaVersion,
  type ThemePackCatalogEntry,
  type ThemePackRegistrySettings,
  type ThemePackSettingsProjection,
  type ThemePacksCatalogManifest,
} from "./build-registry.js";
