/**
 * zdtp (zudo-design-token-panel) PanelConfig for zudo-doc.
 *
 * This config object is the single source of truth that will be passed to
 * `configurePanel(designTokenPanelConfig)` in the host adapter (W3-1b).
 *
 * Type notes:
 * - zdtp's `ColorScheme` requires a `shikiTheme: string` field that is not
 *   present in zudo-doc's local `ColorScheme` type or data. The cast below
 *   (`as unknown as Record<string, ZdtpColorScheme>`) is intentional: zdtp
 *   uses `shikiTheme` only for the code-block preview inside the panel; when
 *   absent at runtime it falls back to `colorCluster.defaultShikiTheme`. No
 *   user-visible regression results from the missing field.
 * - Do NOT add `legacyIdRenameMap` here. The upstream typography-id rename
 *   map bug (zdtp issue filed in W1-1) maps zudo-doc's canonical ids
 *   (text-caption, text-body, …) to non-existent keys. Until the upstream fix
 *   ships, keep zdtp on its default empty rename map by omitting the field.
 */

import type {
  PanelConfig,
  ColorScheme as ZdtpColorScheme,
} from "@takazudo/zudo-design-token-panel";
import { SPACING_TOKENS, FONT_TOKENS, SIZE_TOKENS, COLOR_TOKENS } from "./design-tokens-manifest";
import { colorSchemes } from "./color-schemes";
import { SEMANTIC_DEFAULTS, SEMANTIC_CSS_NAMES } from "./color-scheme-utils";
import { colorTweakPresets } from "./color-tweak-presets";
import { settings } from "./settings";
import { DESIGN_TOKEN_SCHEMA } from "@/utils/design-token-serde";

/**
 * Base-role fallback indices derived from the legacy `initColorFromSchemeData`
 * in `state/tweak-state.ts`. These are the hard-coded palette-index defaults
 * used when a scheme's ColorRef is not a number (e.g. a direct hex string).
 * `colorRefToIndex(scheme.background, palette, 0)` → background defaults to 0.
 */
const BASE_DEFAULTS = {
  background: 0,
  foreground: 15,
  cursor: 6,
  selectionBg: 0,
  selectionFg: 15,
} as const;

/**
 * Fallback Shiki theme used when a color scheme's `shikiTheme` field is absent.
 * zudo-doc's local `ColorScheme` type does not have `shikiTheme`; the zdtp
 * panel uses this default for its client-side code-block preview. The value
 * is set to "github-dark" as a generic dark-theme fallback — the actual
 * static-page syntax highlighting is handled by syntect (via zfb's Rust
 * pipeline) and is unaffected by this field.
 */
const DEFAULT_SHIKI_THEME = "github-dark";

export const designTokenPanelConfig: PanelConfig = {
  storagePrefix: "zudo-doc-tweak",
  consoleNamespace: "zudoDoc",
  modalClassPrefix: "zudo-doc-design-token-panel-modal",
  // Must match DESIGN_TOKEN_SCHEMA in src/utils/design-token-serde.ts so that
  // JSON files exported by the legacy panel remain importable after migration.
  schemaId: DESIGN_TOKEN_SCHEMA,
  exportFilenameBase: "zudo-doc-design-tokens",
  tokens: {
    spacing: SPACING_TOKENS,
    // TokenManifest uses "typography" (not "font") per zdtp's §3.1 contract.
    typography: FONT_TOKENS,
    size: SIZE_TOKENS,
    // Empty — color is cluster-driven; zdtp reads palette via colorCluster.
    color: COLOR_TOKENS,
  },
  colorCluster: {
    id: "zudo-doc",
    label: "Zudo Doc",
    paletteSize: 16,
    // {n} placeholder replaced by resolvePaletteCssVar(cluster, i) at use time.
    paletteCssVarTemplate: "--zd-{n}",
    baseRoles: {
      background: "--zd-bg",
      foreground: "--zd-fg",
      cursor: "--zd-cursor",
      selectionBg: "--zd-sel-bg",
      selectionFg: "--zd-sel-fg",
    },
    semanticDefaults: SEMANTIC_DEFAULTS,
    semanticCssNames: SEMANTIC_CSS_NAMES,
    baseDefaults: BASE_DEFAULTS,
    defaultShikiTheme: DEFAULT_SHIKI_THEME,
    // Local ColorScheme lacks shikiTheme (not in zudo-doc's type). Cast is safe:
    // zdtp falls back to defaultShikiTheme when shikiTheme is absent at runtime.
    colorSchemes: colorSchemes as unknown as Record<string, ZdtpColorScheme>,
    panelSettings: {
      colorScheme: settings.colorScheme,
      // colorMode: strip off respectPrefersColorScheme (not in zdtp's shape).
      colorMode: settings.colorMode
        ? {
            defaultMode: settings.colorMode.defaultMode,
            lightScheme: settings.colorMode.lightScheme,
            darkScheme: settings.colorMode.darkScheme,
          }
        : false,
    },
  },
  // colorTweakPresets also lacks shikiTheme; same cast reasoning as colorSchemes.
  colorPresets: colorTweakPresets as unknown as Record<string, ZdtpColorScheme>,
};
