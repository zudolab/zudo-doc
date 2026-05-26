/**
 * zdtp (zudo-design-token-panel) PanelConfig for this project.
 *
 * This config object is the single source of truth passed to
 * `configurePanel(designTokenPanelConfig)` in the bootstrap module.
 *
 * Type notes:
 * - zdtp's `ColorScheme` requires a `shikiTheme: string` field that is not
 *   present in zudo-doc's local `ColorScheme` type or data. The cast below
 *   (`as unknown as Record<string, ZdtpColorScheme>`) is intentional: zdtp
 *   uses `shikiTheme` only for the code-block preview inside the panel; when
 *   absent at runtime it falls back to `colorCluster.defaultShikiTheme`. No
 *   user-visible regression results from the missing field.
 */

import type {
  PanelConfig,
  ColorScheme as ZdtpColorScheme,
} from "@takazudo/zdtp";
import {
  SPACING_TOKENS,
  FONT_TOKENS,
  SIZE_TOKENS,
  COLOR_TOKENS,
} from "./design-tokens-manifest";
import { colorSchemes } from "./color-schemes";
import { SEMANTIC_DEFAULTS, SEMANTIC_CSS_NAMES } from "./color-scheme-utils";
import { settings } from "./settings";
import { DESIGN_TOKEN_SCHEMA } from "@takazudo/zudo-doc/theme";

/**
 * Base-role fallback indices. Background defaults to palette index 0,
 * foreground to 15, cursor to 6, selection to 0/15.
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
 */
const DEFAULT_SHIKI_THEME = "github-dark";

export const designTokenPanelConfig: PanelConfig = {
  // Customize these values to match your project name to avoid localStorage
  // collisions when multiple zudo-doc projects run in the same browser.
  storagePrefix: "my-doc-tweak",
  consoleNamespace: "myDoc",
  modalClassPrefix: "my-doc-design-token-panel-modal",
  // Must match DESIGN_TOKEN_SCHEMA in @takazudo/zudo-doc/theme so that
  // exported JSON files remain importable across panel versions.
  schemaId: DESIGN_TOKEN_SCHEMA,
  exportFilenameBase: "my-doc-design-tokens",
  tokens: {
    spacing: SPACING_TOKENS,
    // TokenManifest uses "typography" (not "font") per zdtp's §3.1 contract.
    typography: FONT_TOKENS,
    size: SIZE_TOKENS,
    // Empty — color is cluster-driven; zdtp reads palette via colorCluster.
    color: COLOR_TOKENS,
  },
  colorCluster: {
    id: "my-doc",
    label: "My Doc",
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
  colorPresets: {},
};
