/**
 * `@takazudo/zudo-doc/design-token-panel-config` — the PACKAGE-DEFAULT zdtp
 * PanelConfig builder (#2658, epic Minimal Scaffold #2651, decision wave
 * #2653 "Approach (a)").
 *
 * Ported from the showcase's `src/config/design-token-panel-config.ts` (441
 * lines, ~90% mechanical derivation per the decision-wave audit) so
 * `designTokenPanel: true` works with NO host config file: the Palette tab
 * comes from `defaultColorSchemes`' shared `ramps`, the Color tab from
 * `buildSemanticTierItems`, and Font/Spacing/Size from the manifest in
 * `./manifest.js`. The hand-authored panel-identity constants
 * (`storagePrefix`, `consoleNamespace`, `modalClassPrefix`, `schemaId`,
 * `exportFilenameBase`) and the `FONT_ROLE_TO_SCALE` map are carried over
 * verbatim — `storagePrefix: "zudo-doc-tweak"` in particular MUST NOT change
 * (existing user-save carry-over guarantee, see `packages/zudo-doc/CLAUDE.md`
 * and `src/CLAUDE.md`).
 *
 * A host that needs a fully custom panel (its own color schemes, its own
 * token manifest) points `settings.designTokenPanelConfigModule` at a module
 * exporting a named `buildDesignTokenPanelConfig` — see
 * `../plugins/routes.ts` (`virtual:zudo-doc-design-token-panel-config`,
 * mirrors the `chromeBindingsModule` contract). This module is what the
 * routes plugin re-exports when NO override is configured.
 *
 * Unlike the showcase original, this builder does not resolve
 * `settings.colorMode`/`settings.colorScheme` — the PACKAGE has no settings
 * singleton to read (the preset's node-free eval-graph rule keeps this
 * module out of the config eval graph too, so it must stay side-effect-free
 * on import). It seeds the Color tab straight from `defaultColorSchemes`'
 * "Default Light" / "Default Dark" entries for the requested `mode` — the
 * exact pair `@takazudo/zudo-doc/theme.css` ships as the default scheme.
 */

import type {
  PanelConfig,
  TabConfig,
  TierConfig,
  TierItem,
  ColorClusterExtras,
  TokenDef,
} from "@takazudo/zdtp";
import { SPACING_TOKENS, FONT_TOKENS, SIZE_TOKENS } from "./manifest.js";
import { STATE_ROLES, buildSemanticTierItems, type ColorScheme } from "../color-scheme-utils.js";
import { defaultColorSchemes } from "../color-schemes-defaults/index.js";

/**
 * Inert fallback for the still-REQUIRED `ColorClusterExtras.defaultShikiTheme`.
 * zdtp's Shiki integration is a no-op stub and page code highlighting is
 * syntect's, so this value has no visible effect — but the field is typed
 * `string`, so a value is required. See zudo-doc#2037.
 */
const DEFAULT_SHIKI_THEME = "github-dark";

type PanelMode = "light" | "dark";

/** The bundled scheme name for a given panel mode. */
function schemeNameForMode(mode: PanelMode): string {
  return mode === "dark" ? "Default Dark" : "Default Light";
}

/** Resolve the bundled `ColorScheme` whose `map` seeds the semantic tier for
 *  `mode`. Both entries share the same `ramps` (see
 *  `../color-schemes-defaults/index.js`), so either can supply the Palette
 *  tab's ramp tiers. */
function schemeForMode(mode: PanelMode): ColorScheme {
  const scheme = defaultColorSchemes[schemeNameForMode(mode)];
  if (!scheme) {
    throw new Error(
      `zudo-doc: defaultColorSchemes is missing "${schemeNameForMode(mode)}" — this is a package bug.`,
    );
  }
  return scheme;
}

// ---------------------------------------------------------------------------
// Helpers — partition flat manifest arrays into TabConfig.tiers by group.
// ---------------------------------------------------------------------------

/**
 * Convert a flat `TokenDef` to a `TierItem` (the zdtp tier-model shape).
 *
 *  - `control: "select"` → `type: { kind: 'select', options }`
 *  - `control: "text"`   → `type: { kind: 'text' }`
 *  - (default slider)    → `type: { kind: 'length', step, unit }`
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
 * The tier's items share the same kind by construction — zdtp's
 * `assertValidTabs` validator requires this.
 */
function tierFromGroup(
  tokens: readonly TokenDef[],
  groupId: string,
  label: string,
): TierConfig {
  return {
    id: groupId,
    label,
    items: tokens.filter((t) => t.group === groupId).map(toTierItem),
  };
}

// ---------------------------------------------------------------------------
// Palette tab — three ramp tiers (base / accent / state), OKLCH curve editor.
// ---------------------------------------------------------------------------

/** Build the three ramp tiers from the shared `ramps` (identical across
 *  "Default Light" / "Default Dark" — see `../color-schemes-defaults`). */
function buildRampTiers(mode: PanelMode): TierConfig[] {
  const { ramps } = schemeForMode(mode);

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

function buildPaletteTab(mode: PanelMode): TabConfig {
  return {
    id: "palette",
    label: "Palette",
    tiers: buildRampTiers(mode),
    // No colorExtras: a tab with multiple kind:'color' tiers MUST omit it so
    // resolveColorClusterFromTab is not invoked and zdtp renders the ramps
    // with its native curve editor (zdtp palette-tab contract).
  };
}

// ---------------------------------------------------------------------------
// Color tab — mode-scoped semantic tier (4 base roles + 23 --zd-* roles) as
// grouped ramp dropdowns referencing the Palette tab (#2606 / #2610).
// ---------------------------------------------------------------------------

/**
 * Semantic tier — 4 base roles + 23 `--zd-*` roles, each a grouped ramp
 * dropdown. `referencesRamps` names the Palette tab's ramp tiers this tier's
 * `{ref}` mappings resolve against; `semantic: true` marks it so zdtp never
 * mistakes it for the palette tier. Seeded from `schemeForMode(mode)`.
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
 * editors — the Palette tab owns the ramps and the semantic tier owns the
 * roles. `panelSettings.colorMode` pins `defaultMode` to the active mode so
 * per-mode literal collapse/preview follows the live toggle.
 */
function buildColorExtras(mode: PanelMode): ColorClusterExtras {
  const lightScheme = schemeNameForMode("light");
  const darkScheme = schemeNameForMode("dark");
  return {
    id: "zudo-doc",
    label: "Zudo Doc",
    baseRoles: {},
    baseDefaults: {},
    defaultShikiTheme: DEFAULT_SHIKI_THEME,
    colorSchemes: {},
    panelSettings: {
      colorScheme: schemeNameForMode(mode),
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
 * Tier 2 semantic role → Tier 1 abstract scale item id. Mirrors the
 * `var(--…)` wiring in `@takazudo/zudo-doc/theme.css`
 * (`--text-body: var(--text-scale-md)` etc).
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
 * `font-scale` tier. Defaults are overridden to the referenced scale id.
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

function buildFontTab(): TabConfig {
  return {
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
}

// ---------------------------------------------------------------------------
// Spacing tab — four tiers grouped by the manifest's `group` field.
// ---------------------------------------------------------------------------

function buildSpacingTab(): TabConfig {
  return {
    id: "spacing",
    label: "Spacing",
    tiers: [
      tierFromGroup(SPACING_TOKENS, "hsp", "Horizontal spacing"),
      tierFromGroup(SPACING_TOKENS, "vsp", "Vertical spacing"),
      tierFromGroup(SPACING_TOKENS, "icon", "Icons"),
      tierFromGroup(SPACING_TOKENS, "layout", "Layout"),
    ],
  };
}

// ---------------------------------------------------------------------------
// Size tab — two tiers grouped by the manifest's `group` field.
// ---------------------------------------------------------------------------

function buildSizeTab(): TabConfig {
  return {
    id: "size",
    label: "Size",
    tiers: [
      tierFromGroup(SIZE_TOKENS, "radius", "Radius"),
      tierFromGroup(SIZE_TOKENS, "transition", "Transition"),
    ],
  };
}

/**
 * Build the full PACKAGE-DEFAULT PanelConfig for a given color-scheme
 * `mode`. Only the Color tab's semantic tier and `panelSettings.colorMode.
 * defaultMode` vary by mode; the Palette/Font/Spacing/Size tabs are
 * mode-independent. `@takazudo/zudo-doc/design-token-panel-bootstrap` calls
 * this per mode on every `color-scheme-changed` toggle (destroy +
 * reconfigure) — it is passed as the BUILDER, not a resolved config (#2610).
 *
 * `storagePrefix: "zudo-doc-tweak"` is the same value the showcase's own
 * `design-token-panel-config.ts` has always used — keep it unchanged so a
 * host migrating from an ejected config to this package default carries its
 * existing user-saved tweaks over.
 */
export function buildDesignTokenPanelConfig(mode: PanelMode): PanelConfig {
  return {
    storagePrefix: "zudo-doc-tweak",
    consoleNamespace: "zudoDoc",
    modalClassPrefix: "zudo-doc-design-token-panel-modal",
    // DISPLAY-ONLY in zdtp 0.4.6: the panel's export hard-codes
    // `zudo-design-tokens/v2` and auto-upgrades to `.../v3` when object leaves
    // ({ref}/{literal}/per-mode) are present — which the semantic tier's ramp
    // refs always are, so real exports carry v3. `schemaId` does NOT gate
    // import, and (verified against the installed zdtp 0.4.6 bundle) zdtp's
    // Import/Export modals do not read this field at all — their hint/error
    // text is hardcoded to zdtp's own internal `SCHEMA_V1`/`SCHEMA_V2`/
    // `SCHEMA_V3` constants (#498/#505), which are unrelated to this field.
    // It is thus a purely descriptive config value with no runtime effect;
    // set to v3 (a literal, not one of those constants) to match what real
    // exports carry. Distinct from the host serde's `DESIGN_TOKEN_SCHEMA`
    // (`zudo-doc-design-tokens/v3` — bumped from v2 in #2599 so a stale
    // pre-5/3-minimize export resets instead of crashing on import), which
    // governs a separate round-trip.
    schemaId: "zudo-design-tokens/v3",
    exportFilenameBase: "zudo-doc-design-tokens",
    tabs: [buildPaletteTab(mode), buildColorTab(mode), buildFontTab(), buildSpacingTab(), buildSizeTab()],
  };
}
