/**
 * zdtp (zudo-design-token-panel) PanelConfig for this project.
 *
 * Single source of truth passed to `bootstrapDesignTokenPanel(...)` in
 * `src/lib/design-token-panel-bootstrap.ts`.
 *
 * Ramp-native model (mirrors zudo-doc's Color Ramp Restructure —
 * zudolab/zudo-doc#2584 / #2592; mode-scoped Color tab — #2606 / #2610)
 * -------------------------------------------------------------------------
 * The color model is ramp-native (`ColorScheme = { ramps, map }`, see
 * `src/config/color-schemes.ts`). The panel surfaces it through two tabs:
 *
 *  - **Palette tab** (reserved id `palette`): three `kind:'color'` OKLCH tiers —
 *    `base` (5 stops → `--palette-base-0..4`), `accent` (3 stops →
 *    `--palette-accent-0..2`), and `state` (4 roles → `--palette-state-{role}`).
 *    zdtp's native L/C/H curve editor renders these. Per zdtp's palette-tab
 *    contract, a tab carrying MULTIPLE `kind:'color'` tiers MUST omit
 *    `colorExtras` (otherwise `resolveColorClusterFromTab` cannot pick a single
 *    palette tier). The ramps are shared across light/dark, so token defaults
 *    are read from the active scheme's `ramps` and stay in sync with
 *    `color-schemes.ts`. The cssVars match the `--palette-*` custom properties
 *    the ColorSchemeProvider emits (`schemeToCssPairs`).
 *
 *  - **Color tab** (reserved id `color`): a single `semantic` tier holding the
 *    4 base roles (`--zd-bg`/`--zd-fg`/`--zd-selection-{bg,fg}`) + 23 `--zd-*`
 *    semantic roles, each rendered as a grouped ramp dropdown. The tier declares
 *    `referencesRamps` pointing at the Palette tab's `base`/`accent`/`state`
 *    tiers, so each row's `default` is the encoded `tierId:itemId` ramp
 *    reference (`buildSemanticTierItems` / `rampRefToPanelDefault`), the picker
 *    renders grouped `<optgroup>` dropdowns, and editing emits live
 *    `var(--palette-*)`. The tier carries NO `referencesTier` — that resolves
 *    intra-tab only; the cross-tab wiring is `referencesRamps` + `semantic:true`.
 *
 * Mode-scoped defaults
 * --------------------
 * The Color tab's semantic defaults are MODE-SCOPED: `buildDesignTokenPanelConfig(mode)`
 * seeds the tier from the active mode's scheme (light map vs dark map). The
 * bootstrap (`@takazudo/zudo-doc/design-token-panel-bootstrap`) destroys +
 * reconfigures the panel on every `color-scheme-changed` toggle so its defaults
 * follow the live light/dark mode.
 *
 * Caveat: a *saved* color OVERRIDE is still mode-AGNOSTIC here — but this is
 * this project's config-shape choice, not a zdtp limitation. zdtp 0.4.5 ships
 * per-scheme/per-mode keyed color persistence (v4 envelope,
 * Takazudo/zudo-design-token-panel#500 / #509): the color slice is keyed by
 * the cluster's resolved scheme identity (`panelSettings.colorScheme` /
 * `colorMode`). This project's color cluster is scheme-less
 * (`colorExtras.colorSchemes = {}`, no `colorMode`) and switches modes
 * externally via the destroy+reconfigure dance above rather than zdtp's own
 * `colorMode` field, so zdtp always resolves the same single (stub) scheme
 * identity and an override repaints both modes until Reset. Only the
 * DEFAULTS are mode-faithful. Do NOT work around this by reaching into zdtp's
 * private storage keys.
 *
 * The color cluster is **scheme-less**: `colorExtras.colorSchemes = {}` (zdtp's
 * documented scheme-less cluster shape) — the ramps ARE the editable source of
 * truth, surfaced by the Palette tab, so a bundled scheme-preset registry no
 * longer applies.
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
  STATE_ROLES,
  type ColorScheme,
} from "./color-scheme-utils";
import { buildSemanticTierItems } from "@takazudo/zudo-doc/color-scheme-utils";
import { colorSchemes } from "./color-schemes";
import { settings } from "./settings";

/**
 * Inert fallback for the still-REQUIRED `ColorClusterExtras.defaultShikiTheme`.
 * zdtp's Shiki integration is a no-op stub, so this value has no visible
 * effect if you highlight code some other way — but the field is typed
 * `string`, so a value is required.
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
 * group share the same slider/select/text shape in this project's manifest).
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
 * Build the three ramp tiers from the active scheme's shared `ramps`. Light
 * and dark schemes share the same Tier-1 ramps, so the active scheme's ramps
 * are the single source of truth — read from here rather than hardcoding a
 * second copy of the values.
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
// Color tab — mode-scoped semantic tier (4 base roles + 23 --zd-* roles) as
// grouped ramp dropdowns referencing the Palette tab.
// ---------------------------------------------------------------------------

type PanelMode = "light" | "dark";

/**
 * Resolve the `ColorScheme` whose `map` seeds the semantic tier for `mode`.
 * With a light/dark pair configured, picks `colorMode.{light,dark}Scheme`; on
 * the single-scheme path (`settings.colorMode === false`) there is no pair, so
 * the active `settings.colorScheme` is used for both modes (no toggle wiring).
 */
function schemeForMode(mode: PanelMode): ColorScheme {
  const cm = settings.colorMode;
  if (!cm) return getActiveScheme();
  const name = mode === "dark" ? cm.darkScheme : cm.lightScheme;
  return colorSchemes[name] ?? getActiveScheme();
}

/**
 * Semantic tier — 4 base roles + 23 `--zd-*` roles, each a grouped ramp
 * dropdown. `referencesRamps` names the Palette tab's ramp tiers this tier's
 * `{ref}` mappings resolve against (cross-tab, resolved at mount by
 * `resolveColorClusterFromTab`); `semantic: true` marks it so zdtp never
 * mistakes it for the palette tier. Items come from `buildSemanticTierItems`:
 * every `default` is an encoded `tierId:itemId` ramp reference, so a scheme
 * with no override round-trips to the exact ramp stop (no snapping to a
 * resolved color). Seeded from `schemeForMode(mode)` — this is the only
 * mode-varying tier.
 */
function buildSemanticTier(mode: PanelMode): TierConfig {
  return {
    id: "semantic",
    label: "Semantic",
    semantic: true,
    referencesRamps: [
      { tab: "palette", tier: "base" },
      { tab: "palette", tier: "accent" },
      { tab: "palette", tier: "state" },
    ],
    items: buildSemanticTierItems(schemeForMode(mode)),
  };
}

/**
 * Color cluster extras. Scheme-less (`colorSchemes: {}`) with no base-role
 * editors (`baseRoles`/`baseDefaults` empty) — the Palette tab owns the ramps
 * and the semantic tier owns the roles.
 *
 * `panelSettings.colorMode` is an OBJECT (not `false`) with `defaultMode = mode`.
 * On this scheme-less cluster its only live effect is `getClusterDefaultMode()`,
 * which drives the per-mode literal collapse/preview side — pinning it to the
 * ACTIVE mode keeps that side following the live toggle (a bare `false` would
 * pin it to `light` and mis-collapse per-mode literals for a dark-mode user).
 * `colorScheme`/`lightScheme`/`darkScheme` only need to be non-empty strings
 * (the validator requires that even with `colorSchemes: {}`; the names are not
 * checked against the empty registry).
 */
function buildColorExtras(mode: PanelMode): ColorClusterExtras {
  const cm = settings.colorMode;
  const lightScheme = cm ? cm.lightScheme : settings.colorScheme;
  const darkScheme = cm ? cm.darkScheme : settings.colorScheme;
  return {
    // Customize id/label to match your project name to avoid localStorage
    // collisions when multiple zudo-doc-based projects run in the same browser.
    id: "my-doc",
    label: "My Doc",
    baseRoles: {},
    baseDefaults: {},
    defaultShikiTheme: DEFAULT_SHIKI_THEME,
    colorSchemes: {},
    panelSettings: {
      colorScheme: settings.colorScheme,
      colorMode: { defaultMode: mode, lightScheme, darkScheme },
    },
  };
}

function buildColorTab(mode: PanelMode): TabConfig {
  return {
    id: "color",
    label: "Color",
    tiers: [buildSemanticTier(mode)],
    colorExtras: buildColorExtras(mode),
  };
}

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
 * scale step propagates to every role live.
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

/**
 * Detect the initial color-scheme mode for the first `configurePanel` call. In
 * the browser, read `<html data-theme>` (set pre-paint by the
 * ColorSchemeProvider bootstrap); otherwise fall back to
 * `settings.colorMode.defaultMode` (or `light` on the single-scheme path).
 * SSR-safe: guards `document`.
 */
function detectInitialMode(): PanelMode {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") return attr;
  }
  const cm = settings.colorMode;
  return cm ? cm.defaultMode : "light";
}

/**
 * Build the full PanelConfig for a given color-scheme `mode`. Only the Color
 * tab's semantic tier and `panelSettings.colorMode.defaultMode` vary by mode;
 * the Palette/Font/Spacing/Size tabs are mode-independent. The bootstrap calls
 * this per mode on every `color-scheme-changed` toggle (destroy + reconfigure).
 */
export function buildDesignTokenPanelConfig(mode: PanelMode): PanelConfig {
  return {
    // Customize these values to match your project name to avoid localStorage
    // collisions when multiple zudo-doc-based projects run in the same browser.
    storagePrefix: "my-doc-tweak",
    consoleNamespace: "myDoc",
    modalClassPrefix: "my-doc-design-token-panel-modal",
    // DISPLAY-ONLY in zdtp 0.4.5: the panel's export hard-codes
    // `zudo-design-tokens/v2` and auto-upgrades to `.../v3` when object leaves
    // ({ref}/{literal}/per-mode) are present — which the semantic tier's ramp
    // refs always are, so real exports carry v3. `schemaId` does NOT gate
    // import; it only labels the Import-modal hint. zdtp DOES export its own
    // `SCHEMA_V1`/`SCHEMA_V2`/`SCHEMA_V3` constants (#498/#505), but those are
    // zdtp's fixed internal schema strings, unrelated to this field. Set to v3
    // (a literal, not one of those constants) so the hint matches what exports
    // actually carry.
    schemaId: "zudo-design-tokens/v3",
    exportFilenameBase: "my-doc-design-tokens",
    tabs: [PALETTE_TAB, buildColorTab(mode), FONT_TAB, SPACING_TAB, SIZE_TAB],
  };
}

/**
 * Back-compat / initial-call export: the config for the mode detected at module
 * load. Pass the `buildDesignTokenPanelConfig` BUILDER (not this plain object)
 * to the bootstrap for live mode-scoped rebuilds on light/dark toggle — see
 * `src/lib/design-token-panel-bootstrap.ts`. This plain-config export remains
 * for callers that only need a static config.
 */
export const designTokenPanelConfig: PanelConfig = buildDesignTokenPanelConfig(
  detectInitialMode(),
);
