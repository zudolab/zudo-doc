/**
 * zdtp (zudo-design-token-panel) PanelConfig for this project.
 *
 * This config object is the single source of truth passed to
 * `configurePanel(designTokenPanelConfig)` in the bootstrap module.
 *
 * Type notes:
 * - zdtp's `ColorScheme` requires a `shikiTheme: string` field that is not
 *   present in this project's local `ColorScheme` type or data (zdtp uses it
 *   only for the panel's client-side code-block preview). Rather than an unsafe
 *   `as unknown as Record<string, ZdtpColorScheme>` double-cast, every local
 *   scheme map is run through `toZdtpColorSchemes()` below, which supplies
 *   `DEFAULT_SHIKI_THEME` as the fallback so the result satisfies zdtp's
 *   required-field shape with an ordinary type-checked assignment.
 */

import type {
  PanelConfig,
  TabConfig,
  TierConfig,
  TierItem,
  ColorClusterExtras,
  ColorScheme as ZdtpColorScheme,
  TokenDef,
} from "@takazudo/zdtp";
import {
  SPACING_TOKENS,
  FONT_TOKENS,
  SIZE_TOKENS,
} from "./design-tokens-manifest";
import { colorSchemes } from "./color-schemes";
import type { ColorScheme as LocalColorScheme } from "./color-schemes";
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

/**
 * Normalize this project's local `ColorScheme` records into zdtp's
 * `ColorScheme` shape. zdtp's type requires `shikiTheme: string`; the local
 * scheme type makes it optional. This helper fills `DEFAULT_SHIKI_THEME` only
 * when a scheme doesn't declare its own, so the result is assignable to
 * `Record<string, ZdtpColorScheme>` via an ordinary type-checked assignment —
 * replacing the previous `as unknown as` double-cast that bypassed every field
 * check. Tracked upstream at Takazudo/zudo-design-token-panel#342 (shikiTheme
 * should be optional in zdtp's `ColorScheme` type); drop this helper once that
 * lands.
 */
function toZdtpColorSchemes(
  schemes: Record<string, LocalColorScheme>,
): Record<string, ZdtpColorScheme> {
  const normalized: Record<string, ZdtpColorScheme> = {};
  for (const [name, scheme] of Object.entries(schemes)) {
    normalized[name] = {
      ...scheme,
      shikiTheme: scheme.shikiTheme ?? DEFAULT_SHIKI_THEME,
    };
  }
  return normalized;
}

/**
 * Initial palette taken from the configured active scheme.
 */
function getInitialPalette(): readonly string[] {
  const scheme = colorSchemes[settings.colorScheme];
  if (!scheme) {
    throw new Error(
      `Unknown color scheme: "${settings.colorScheme}". Available: ${Object.keys(colorSchemes).join(", ")}`,
    );
  }
  return scheme.palette;
}

// ---------------------------------------------------------------------------
// Helpers — partition flat manifest arrays into TabConfig.tiers by group.
// ---------------------------------------------------------------------------

/**
 * Convert a flat `TokenDef` to a `TierItem` (the zdtp tier-model shape).
 *
 * The mapping rules:
 *  - `control: "select"` → `type: { kind: 'select', options }`
 *  - `control: "text"`   → `type: { kind: 'text' }`
 *  - (default slider)    → `type: { kind: 'length', step, unit }`
 *
 * `pill` and `readonly` pass through unchanged.
 */
function toTierItem(t: TokenDef): TierItem {
  let kind;
  if (t.control === "select") {
    kind = { kind: "select" as const, options: t.options ?? [] };
  } else if (t.control === "text") {
    kind = { kind: "text" as const };
  } else {
    kind = {
      kind: "length" as const,
      step: t.step,
      unit: t.unit,
    };
  }
  const item: TierItem = {
    id: t.id,
    cssVar: t.cssVar,
    label: t.label,
    default: t.default,
    type: kind,
  };
  if (t.pill) item.pill = t.pill;
  if (t.readonly) item.readonly = true;
  return item;
}

/**
 * Build a tier from the subset of `tokens` whose `group` matches `groupId`.
 */
function tierFromGroup(
  tokens: readonly TokenDef[],
  groupId: string,
  label: string,
): TierConfig {
  return {
    id: groupId,
    label,
    items: tokens
      .filter((t) => t.group === groupId)
      .map(toTierItem),
  };
}

// ---------------------------------------------------------------------------
// Color tab — palette and semantic tiers + colorExtras for cluster metadata.
// ---------------------------------------------------------------------------

const PALETTE_TIER_ID = "palette";

function buildPaletteTier(): TierConfig {
  const initial = getInitialPalette();
  const items: TierItem[] = [];
  for (let i = 0; i < 16; i++) {
    items.push({
      id: `p${i}`,
      cssVar: `--zd-${i}`,
      label: `p${i}`,
      default: initial[i] ?? "#808080",
      type: { kind: "color" },
    });
  }
  return {
    id: PALETTE_TIER_ID,
    label: "Palette",
    items,
  };
}

function buildSemanticTier(): TierConfig {
  const items: TierItem[] = [];
  for (const [key, cssVar] of Object.entries(SEMANTIC_CSS_NAMES)) {
    const idx = SEMANTIC_DEFAULTS[key];
    if (idx === undefined) continue;
    items.push({
      id: key,
      cssVar,
      label: key,
      default: `p${idx}`,
      type: { kind: "color" },
    });
  }
  return {
    id: "semantic",
    label: "Semantic",
    items,
    referencesTier: PALETTE_TIER_ID,
  };
}

const COLOR_EXTRAS: ColorClusterExtras = {
  // Customize these values to match your project name to avoid localStorage
  // collisions when multiple zudo-doc projects run in the same browser.
  id: "my-doc",
  label: "My Doc",
  baseRoles: {
    background: "--zd-bg",
    foreground: "--zd-fg",
    cursor: "--zd-cursor",
    selectionBg: "--zd-sel-bg",
    selectionFg: "--zd-sel-fg",
  },
  baseDefaults: BASE_DEFAULTS,
  defaultShikiTheme: DEFAULT_SHIKI_THEME,
  // toZdtpColorSchemes fills the fallback only for schemes without their own
  // shikiTheme, so this is a type-checked assignment rather than an unsafe cast.
  colorSchemes: toZdtpColorSchemes(colorSchemes),
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
};

const COLOR_TAB: TabConfig = {
  id: "color",
  label: "Color",
  tiers: [buildPaletteTier(), buildSemanticTier()],
  colorExtras: COLOR_EXTRAS,
};

// ---------------------------------------------------------------------------
// Font tab
// ---------------------------------------------------------------------------

const FONT_SCALE_TIER_ID = "font-scale";

const FONT_TAB: TabConfig = {
  id: "font",
  label: "Font",
  tiers: [
    tierFromGroup(FONT_TOKENS, FONT_SCALE_TIER_ID, "Scale"),
    tierFromGroup(FONT_TOKENS, "font-size", "Font size"),
    tierFromGroup(FONT_TOKENS, "line-height", "Line height"),
    tierFromGroup(FONT_TOKENS, "font-weight", "Font weight"),
    tierFromGroup(FONT_TOKENS, "font-family", "Font family"),
  ],
};

// ---------------------------------------------------------------------------
// Spacing tab
// ---------------------------------------------------------------------------

const SPACING_TAB: TabConfig = {
  id: "spacing",
  label: "Spacing",
  tiers: [
    tierFromGroup(SPACING_TOKENS, "hsp", "Horizontal spacing"),
    tierFromGroup(SPACING_TOKENS, "vsp", "Vertical spacing"),
    tierFromGroup(SPACING_TOKENS, "icon", "Icons"),
    tierFromGroup(SPACING_TOKENS, "layout", "Layout"),
  ],
};

// ---------------------------------------------------------------------------
// Size tab
// ---------------------------------------------------------------------------

const SIZE_TAB: TabConfig = {
  id: "size",
  label: "Size",
  tiers: [
    tierFromGroup(SIZE_TOKENS, "radius", "Radius"),
    tierFromGroup(SIZE_TOKENS, "transition", "Transition"),
  ],
};

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
  tabs: [COLOR_TAB, FONT_TAB, SPACING_TAB, SIZE_TAB],
  colorPresets: {},
};
