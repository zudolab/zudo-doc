/**
 * zdtp (zudo-design-token-panel) PanelConfig for zudo-doc.
 *
 * Single source of truth passed to `configurePanel(designTokenPanelConfig)` in
 * `src/lib/design-token-panel-bootstrap.ts`.
 *
 * Ramp-native model (Color Ramp Restructure — zudolab/zudo-doc#2584 / #2592)
 * -------------------------------------------------------------------------
 * The color model is now ramp-native (`ColorScheme = { ramps, map }`, see
 * `src/config/color-schemes.ts`). The panel surfaces it through two tabs:
 *
 *  - **Palette tab** (reserved id `palette`): three `kind:'color'` OKLCH tiers —
 *    `base` (5 stops → `--palette-base-0..4`), `accent` (3 stops →
 *    `--palette-accent-0..2`), and `state` (4 roles → `--palette-state-{role}`).
 *    zdtp's native L/C/H curve editor renders these. Per zdtp's palette-tab
 *    contract, a tab carrying MULTIPLE `kind:'color'` tiers MUST omit
 *    `colorExtras` (otherwise `resolveColorClusterFromTab` cannot pick a single
 *    palette tier). Token defaults are read from the shared `ramps` (via the
 *    active scheme) so the panel stays in sync with `color-schemes.ts`. The
 *    cssVars match the `--palette-*` custom properties the ColorSchemeProvider
 *    emits (`schemeToCssPairs`).
 *
 *  - **Color tab** (reserved id `color`): a single `semantic` tier holding all
 *    23 `--zd-*` semantic roles as direct `kind:'color'` OKLCH swatches. Per
 *    #2589 (Option b), zdtp resolves tier references INTRA-tab only, so a
 *    cross-tab ramp reference is impossible — the semantic tier therefore has
 *    NO `referencesTier`; each role instead carries a concrete OKLCH `default`
 *    resolved from the active scheme's ramp wiring (`resolveSemanticColors`).
 *    zdtp's color tab renders the first all-`kind:'color'` tier as directly
 *    editable OKLCH swatches, which is exactly this semantic tier.
 *
 * The legacy ghostty 16-slot palette (`--zd-0..15`), the numeric palette-index
 * `semanticDefaults`, `cursor`, `shikiTheme`, and the bundled scheme presets are
 * all gone (dropped in the ramp restructure). The color cluster is now
 * **scheme-less**: `colorExtras.colorSchemes = {}` (zdtp's documented
 * scheme-less cluster shape) — the ramps ARE the editable source of truth,
 * surfaced by the Palette tab, so a bundled scheme-preset registry no longer
 * applies. Note: zdtp 0.4.3's `ColorClusterExtras.colorSchemes` is still typed
 * to the legacy flat `ColorScheme`, which the ramp-native `{ ramps, map }`
 * schemes cannot populate; `{}` is the correct, type-safe shape here.
 */

import type {
  PanelConfig,
  TabConfig,
  TierConfig,
  TierItem,
  ColorClusterExtras,
  TokenDef,
} from "@takazudo/zdtp";
import {
  SPACING_TOKENS,
  FONT_TOKENS,
  SIZE_TOKENS,
} from "./design-tokens-manifest";
import {
  getActiveScheme,
  resolveSemanticColors,
  SEMANTIC_KEYS,
  SEMANTIC_CSS_NAMES,
  STATE_ROLES,
} from "./color-scheme-utils";
import { settings } from "./settings";
import { DESIGN_TOKEN_SCHEMA } from "@takazudo/zudo-doc/theme";

/**
 * Inert fallback for the still-REQUIRED `ColorClusterExtras.defaultShikiTheme`.
 * zdtp's Shiki integration is a no-op stub and page code highlighting is
 * syntect's (dual-theme, via `codeHighlight` in zfb.config.ts), so this value
 * has no visible effect — but the field is typed `string`, so a value is
 * required. See zudo-doc#2037.
 */
const DEFAULT_SHIKI_THEME = "github-dark";

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
// Palette tab — three ramp tiers (base / accent / state), OKLCH curve editor.
// ---------------------------------------------------------------------------

/**
 * Build the three ramp tiers from the active scheme's shared `ramps`. Default
 * Light and Default Dark share the same Tier-1 ramps, so the active scheme's
 * ramps are the single source of truth — read from here rather than hardcoding
 * a second copy of the values.
 */
function buildRampTiers(): TierConfig[] {
  const { ramps } = getActiveScheme();

  const baseTier: TierConfig = {
    id: "base",
    label: "Base",
    items: ramps.base.map((color, i): TierItem => ({
      id: `base-${i}`,
      cssVar: `--palette-base-${i}`,
      label: String(i),
      default: color,
      type: { kind: "color", format: "oklch" },
    })),
  };

  const accentTier: TierConfig = {
    id: "accent",
    label: "Accent",
    items: ramps.accent.map((color, i): TierItem => ({
      id: `accent-${i}`,
      cssVar: `--palette-accent-${i}`,
      label: String(i),
      default: color,
      type: { kind: "color", format: "oklch" },
    })),
  };

  const stateTier: TierConfig = {
    id: "state",
    label: "State",
    items: STATE_ROLES.map((role): TierItem => ({
      id: `state-${role}`,
      cssVar: `--palette-state-${role}`,
      label: role,
      default: ramps.state[role],
      type: { kind: "color", format: "oklch" },
    })),
  };

  return [baseTier, accentTier, stateTier];
}

const PALETTE_TAB: TabConfig = {
  id: "palette",
  label: "Palette",
  tiers: buildRampTiers(),
  // No colorExtras: a tab with multiple kind:'color' tiers MUST omit it so
  // resolveColorClusterFromTab is not invoked and zdtp renders the ramps with
  // its native curve editor (zdtp palette-tab contract).
};

// ---------------------------------------------------------------------------
// Color tab — semantic tokens as direct OKLCH swatches (Option b, #2589).
// ---------------------------------------------------------------------------

/**
 * Semantic tier — all 23 `--zd-*` roles as direct `kind:'color'` OKLCH swatches.
 * Per #2589 (Option b) there is NO `referencesTier`: zdtp resolves references
 * intra-tab only, so cross-tab ramp references aren't possible. Each role
 * carries a concrete OKLCH `default` resolved from the active scheme's ramp
 * wiring (`resolveSemanticColors`), keeping the panel in sync with
 * `color-schemes.ts`. cssVars come from `SEMANTIC_CSS_NAMES` so the apply
 * pipeline keeps writing the same `--zd-*` custom properties.
 */
function buildSemanticTier(): TierConfig {
  const resolved = resolveSemanticColors(getActiveScheme());
  const items: TierItem[] = SEMANTIC_KEYS.map((key): TierItem => ({
    id: key,
    cssVar: SEMANTIC_CSS_NAMES[key],
    label: key,
    default: resolved[key],
    type: { kind: "color", format: "oklch" },
  }));
  return { id: "semantic", label: "Semantic", items };
}

const COLOR_EXTRAS: ColorClusterExtras = {
  id: "zudo-doc",
  label: "Zudo Doc",
  // No base-role editors in the ramp model — the Palette tab owns the ramps and
  // the semantic tier owns the roles. baseRoles/baseDefaults are empty (allowed:
  // ColorClusterExtras types both as Partial<Record<...>>).
  baseRoles: {},
  baseDefaults: {},
  defaultShikiTheme: DEFAULT_SHIKI_THEME,
  // Scheme-less cluster: the ramps ARE the editable source of truth (Palette
  // tab), so there is no bundled scheme-preset registry. zdtp documents `{}`
  // for clusters that don't use the Scheme… dropdown.
  colorSchemes: {},
  panelSettings: {
    colorScheme: settings.colorScheme,
    // Stub for the scheme-less cluster (colorSchemes is empty): zdtp only
    // resolves a light/dark pair against the scheme registry, which no longer
    // applies. The live light/dark swap is driven by the `--zd-*` custom
    // properties on `:root` (ColorSchemeProvider), not the panel registry.
    colorMode: false,
  },
};

const COLOR_TAB: TabConfig = {
  id: "color",
  label: "Color",
  tiers: [buildSemanticTier()],
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
  // JSON files exported by the panel remain importable.
  schemaId: DESIGN_TOKEN_SCHEMA,
  exportFilenameBase: "zudo-doc-design-tokens",
  tabs: [PALETTE_TAB, COLOR_TAB, FONT_TAB, SPACING_TAB, SIZE_TAB],
};
