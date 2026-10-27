// theme-packs-registry/configured-theme-pack — the effective CONFIGURED pack
// for a settings object whose `themePack` may be omitted.
//
// Two distinct concepts live side by side and must not be conflated:
//
// - `"default"` (`DEFAULT_THEME_PACK_SLUG`) is the RESERVED no-stylesheet
//   sentinel — the original zudo-doc appearance, labelled "Classic". It ships
//   `meta.json` only and is still selected verbatim by an explicit or stored
//   `"default"`.
// - `CONFIGURED_DEFAULT_THEME_PACK_SLUG` (`"graphite"`) is what an ordinary
//   configuration gets when `themePack` is omitted.
//
// An omitted `themePack` keeps the no-stylesheet Classic path when the project
// supplied its own `colorSchemes` data or intentionally fixed the palette with
// `colorMode: false` — an authored palette must not be silently overlaid by a
// pack. An explicit `themePack` always wins. Intent is read from configuration
// shape only, never from rendered colors.
//
// Dependency-free on purpose: imported by the node-free preset/config graph,
// the browser-safe route-context constructor, and SSR chrome.

/** The reserved no-stylesheet sentinel slug (Classic). Literal parity with
 *  `DEFAULT_THEME_PACK_SLUG` in `meta-schema.ts` is guarded by a unit test. */
const RESERVED_DEFAULT_SLUG = "default";

/** The pack an ordinary configuration resolves to when `themePack` is omitted. */
export const CONFIGURED_DEFAULT_THEME_PACK_SLUG = "graphite";

/** Inputs read by {@link resolveConfiguredThemePack}. */
export interface ConfiguredThemePackInput {
  /** The configured slug. `null`/`undefined` mean "omitted". */
  themePack?: string | null;
  /** The resolved `colorMode` setting; `false` is the fixed-scheme opt-out. */
  colorMode?: unknown;
  /** `true` when the caller supplied its own `colorSchemes` data. */
  customColorSchemes?: boolean;
}

/**
 * Resolve the effective configured pack slug:
 *
 * 1. an explicit (non-nullish) `themePack` wins verbatim — validation of the
 *    slug stays with the registry resolver, which fails loudly;
 * 2. omitted + custom `colorSchemes` or `colorMode: false` → `"default"`
 *    (Classic, no pack stylesheet);
 * 3. otherwise → {@link CONFIGURED_DEFAULT_THEME_PACK_SLUG}.
 */
export function resolveConfiguredThemePack(input: ConfiguredThemePackInput): string {
  if (input.themePack !== undefined && input.themePack !== null) return input.themePack;
  if (input.customColorSchemes === true || input.colorMode === false) {
    return RESERVED_DEFAULT_SLUG;
  }
  return CONFIGURED_DEFAULT_THEME_PACK_SLUG;
}
