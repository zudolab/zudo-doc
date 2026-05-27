/**
 * zdtp (zudo-design-token-panel) PanelConfig for zudo-doc.
 *
 * This config object is the single source of truth that will be passed to
 * `configurePanel(designTokenPanelConfig)` in the host adapter.
 *
 * Migration note (Wave 1 / zdtp b288293)
 * --------------------------------------
 * zdtp dropped the legacy `tokens: TokenManifest` + `colorCluster` shape in
 * favor of a flat `tabs: TabConfig[]` array, plus `colorExtras` (carrying
 * non-tier cluster metadata) on the color tab. The cluster's palette and
 * semantic data now live as `TierItem` entries inside the color tab:
 *
 *  - Palette tier: 16 items with `kind: 'color'`, cssVars `--zd-0`..`--zd-15`.
 *    The bridge in zdtp's `resolveColorClusterFromTab` derives
 *    `paletteCssVarTemplate` by replacing the trailing digit run on the first
 *    item's cssVar with `{n}` (`--zd-0` → `--zd-{n}`).
 *  - Semantic tier: items with `kind: 'color'` and `referencesTier` pointing
 *    at the palette tier; each item's `default` is the palette item id it
 *    refers to (which the bridge looks up to materialise the index).
 *
 * Type notes:
 * - zdtp's `ColorScheme` requires a `shikiTheme: string` field that is not
 *   present in zudo-doc's local `ColorScheme` type or data. The cast below
 *   (`as unknown as Record<string, ZdtpColorScheme>`) is intentional: zdtp
 *   uses `shikiTheme` only for the code-block preview inside the panel; when
 *   absent at runtime it falls back to `colorExtras.defaultShikiTheme`.
 * - Do NOT add `legacyIdRenameMap` here. The upstream typography-id rename
 *   map maps zudo-doc's canonical ids (text-caption, text-body, …) to
 *   non-existent keys. Omit the field so zdtp keeps its empty rename map.
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
import { SEMANTIC_DEFAULTS, SEMANTIC_CSS_NAMES } from "./color-scheme-utils";
import { colorTweakPresets } from "./color-tweak-presets";
import { settings } from "./settings";
import { DESIGN_TOKEN_SCHEMA } from "@takazudo/zudo-doc/theme";

/**
 * Base-role fallback indices derived from the legacy `initColorFromSchemeData`
 * in zdtp's `state/tweak-state.ts`. Hard-coded palette-index defaults used
 * when a scheme's ColorRef is not a number.
 */
const BASE_DEFAULTS = {
  background: 0,
  foreground: 15,
  cursor: 6,
  selectionBg: 0,
  selectionFg: 15,
} as const;

/**
 * Fallback Shiki theme when a color scheme lacks one. zudo-doc's local
 * `ColorScheme` type doesn't carry `shikiTheme`; the zdtp panel uses this
 * default for its client-side code-block preview. Static syntax
 * highlighting (syntect via zfb's Rust pipeline) is unaffected.
 */
const DEFAULT_SHIKI_THEME = "github-dark";

/**
 * Initial palette taken from the configured active scheme. The 16 colors
 * are surfaced as palette items in the color tab so the bridge can build a
 * 16-slot `ColorClusterDataConfig`. Live tweaks still flow through zdtp's
 * tweak-state — these defaults are only the seed.
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
 * Convert a flat `TokenDef` to a `TierItem` (the new zdtp tier-model shape).
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
 * The tier's items share the same kind by construction (all items in a
 * group share the same slider/select/text shape in zudo-doc's manifest).
 * zdtp's `assertValidTabs` validator requires this.
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

/**
 * 16 palette items. The bridge in zdtp's `resolveColorClusterFromTab` reads
 * the first item's `cssVar` and replaces the trailing digit run with `{n}`
 * (`--zd-0` → `--zd-{n}`), reconstructing the legacy
 * `paletteCssVarTemplate` for the apply pipeline.
 */
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

/**
 * Semantic tier — items that reference the palette tier. Each item's
 * `default` is a palette item id (e.g. `"p0"`); the bridge looks the id up
 * and emits `paletteIdToIndex[id]` as the numeric default for
 * `semanticDefaults`. cssVars come straight from `SEMANTIC_CSS_NAMES` so
 * the apply pipeline keeps writing the same `--zd-*` custom properties.
 */
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
  id: "zudo-doc",
  label: "Zudo Doc",
  baseRoles: {
    background: "--zd-bg",
    foreground: "--zd-fg",
    cursor: "--zd-cursor",
    selectionBg: "--zd-sel-bg",
    selectionFg: "--zd-sel-fg",
  },
  baseDefaults: BASE_DEFAULTS,
  defaultShikiTheme: DEFAULT_SHIKI_THEME,
  // Local ColorScheme lacks shikiTheme; cast is safe — zdtp falls back to
  // defaultShikiTheme when shikiTheme is absent at runtime.
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
};

const COLOR_TAB: TabConfig = {
  id: "color",
  label: "Color",
  tiers: [buildPaletteTier(), buildSemanticTier()],
  colorExtras: COLOR_EXTRAS,
};

// ---------------------------------------------------------------------------
// Font tab — five tiers grouped by the manifest's `group` field.
// ---------------------------------------------------------------------------

const FONT_SCALE_TIER_ID = "font-scale";

/**
 * Tier 2 semantic role → Tier 1 abstract scale item id. Mirrors the `var(--…)`
 * wiring in `global.css` (`--text-body: var(--text-scale-md)` etc.). The role
 * tier is a *reference* tier: each item's stored value is the id of a
 * `font-scale` item, exactly like the Color tab's semantic→palette tier. zdtp
 * renders these as dropdowns and emits `var(--text-scale-*)`, so editing a
 * scale step propagates to every role live — the refer model the panel
 * previously hid behind independent rem sliders.
 */
const FONT_ROLE_TO_SCALE: Readonly<Record<string, string>> = {
  "text-micro": "text-scale-2xs",
  "text-caption": "text-scale-xs",
  "text-small": "text-scale-sm",
  "text-body": "text-scale-md",
  "text-title": "text-scale-lg",
  "text-heading": "text-scale-xl",
  "text-display": "text-scale-2xl",
};

/**
 * Build the semantic font-size tier as a reference tier pointing at the
 * `font-scale` tier. Defaults are overridden to the referenced scale id (the
 * manifest still records resolved rem values for serde / the flat-manifest
 * generator template, so the override happens here rather than in the
 * manifest to keep both consumers correct).
 */
function buildFontRoleTier(): TierConfig {
  const base = tierFromGroup(FONT_TOKENS, "font-size", "Font size");
  return {
    ...base,
    items: base.items.map((item) => {
      const scaleId = FONT_ROLE_TO_SCALE[item.id];
      return scaleId ? { ...item, default: scaleId } : item;
    }),
    referencesTier: FONT_SCALE_TIER_ID,
  };
}

const FONT_TAB: TabConfig = {
  id: "font",
  label: "Font",
  tiers: [
    tierFromGroup(FONT_TOKENS, FONT_SCALE_TIER_ID, "Scale"),
    buildFontRoleTier(),
    tierFromGroup(FONT_TOKENS, "line-height", "Line height"),
    tierFromGroup(FONT_TOKENS, "font-weight", "Font weight"),
    tierFromGroup(FONT_TOKENS, "font-family", "Font family"),
  ],
};

// ---------------------------------------------------------------------------
// Spacing tab — four tiers grouped by the manifest's `group` field.
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
// Size tab — two tiers grouped by the manifest's `group` field.
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
  storagePrefix: "zudo-doc-tweak",
  consoleNamespace: "zudoDoc",
  modalClassPrefix: "zudo-doc-design-token-panel-modal",
  // Must match DESIGN_TOKEN_SCHEMA in @takazudo/zudo-doc/theme so that
  // JSON files exported by the legacy panel remain importable after migration.
  schemaId: DESIGN_TOKEN_SCHEMA,
  exportFilenameBase: "zudo-doc-design-tokens",
  tabs: [COLOR_TAB, FONT_TAB, SPACING_TAB, SIZE_TAB],
  // colorTweakPresets also lacks shikiTheme; same cast reasoning as colorSchemes.
  colorPresets: colorTweakPresets as unknown as Record<string, ZdtpColorScheme>,
};
