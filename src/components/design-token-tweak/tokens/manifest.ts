/**
 * Token manifest — single source of truth for editable design tokens.
 *
 * Each tab's tokens are listed here; tab components iterate over them to build
 * their UI, and the persist/apply layer uses `cssVar` to write each override to
 * `document.documentElement.style`.
 *
 * Adding a new token requires only a manifest entry — tab components stay
 * manifest-driven and need no code change.
 *
 * Defaults are **hardcoded** from `src/styles/global.css` rather than parsed at
 * runtime. This keeps the manifest usable in node/vitest (no DOM) and avoids a
 * subtle build-time coupling between CSS and TS. Drift is caught by the
 * companion unit test (`__tests__/token-manifest.test.ts`).
 *
 * NOTE: Data arrays (SPACING_TOKENS, FONT_TOKENS, SIZE_TOKENS, COLOR_TOKENS)
 * are now canonical in `src/config/design-tokens-manifest.ts` and re-exported
 * here for backwards compatibility with the legacy panel components.
 * This file will be deleted in W3-2 once the panel component tree is replaced.
 */

/**
 * Local closed union of group ids — kept for legacy panel components that
 * use it as a discriminated type for section-header rendering.
 *
 * The zdtp `TokenGroup` is an open `string` (superset). The arrays stored in
 * `design-tokens-manifest.ts` use zdtp's `TokenDef` (group: string), but every
 * literal group value there is a valid member of this union.
 */
export type TokenGroup =
  | "hsp"
  | "vsp"
  | "icon"
  | "layout"
  | "font-size"
  | "line-height"
  | "font-weight"
  | "font-family"
  | "font-scale"
  | "radius"
  | "transition";

/**
 * Control kind for a token row.
 *
 * - `"slider"` — default; numeric range input paired with a number field.
 * - `"select"` — native `<select>` with `options` (e.g. font-weight 100..900).
 * - `"text"`   — free-form text input (e.g. font-family CSS string).
 *
 * `min`/`max`/`step`/`unit` are only meaningful for the slider control. They
 * stay on the interface with zero defaults for non-slider rows so the manifest
 * shape stays uniform.
 */
export type TokenControl = "slider" | "select" | "text";

/**
 * Local TokenDef interface — structurally identical to zdtp's `TokenDef` except
 * `group` is narrowed to the `TokenGroup` closed union (vs zdtp's open `string`).
 * Legacy tab components use this for type-safe Record<TokenGroup, ...> indexing.
 * After W3-2 this interface will be replaced by the zdtp type directly.
 */
export interface TokenDef {
  /** Stable id used as the Record key in persisted state (e.g. `hsp-2xs`). */
  id: string;
  /** CSS custom property name written to `:root` (e.g. `--spacing-hsp-2xs`). */
  cssVar: string;
  /** Display label shown in the panel row. */
  label: string;
  /** Manifest group — tab components use this for section headers. */
  group: TokenGroup;
  /** Default value as a CSS length string (e.g. `0.125rem`). */
  default: string;
  /** Slider min (numeric, in `unit`). Unused when `readonly`. */
  min: number;
  /** Slider max (numeric, in `unit`). Unused when `readonly`. */
  max: number;
  /** Slider step (numeric, in `unit`). Unused when `readonly`. */
  step: number;
  /** Unit suffix (e.g. `rem`, `px`). Read-only rows may use an empty string. */
  unit: string;
  /** Read-only tokens are displayed but not editable (e.g. `clamp()` expressions). */
  readonly?: true;
  /** Which control renders this token. Defaults to `"slider"` when absent. */
  control?: TokenControl;
  /** Select options — only used when `control === "select"`. */
  options?: readonly string[];
  /** Hide behind the per-tab Advanced `<details>` disclosure (font tab). */
  advanced?: true;
  /**
   * Opt-in "Pill" toggle. When present the control shows a checkbox that flips
   * between `value` (checked — e.g. `9999px` for full-radius pills) and a
   * slider-editable custom value (unchecked). Currently used for
   * `--radius-full`, where a slider alone can't meaningfully drive a 9999px
   * sentinel.
   */
  pill?: {
    /** CSS string applied when the pill checkbox is ON. */
    value: string;
    /** CSS string the slider falls back to when the pill is toggled OFF and
     *  there is no prior custom value yet. */
    customDefault: string;
  };
}

// Re-export data arrays from the new canonical location so legacy panel
// components keep working unchanged through the migration.
// The arrays are typed as zdtp `TokenDef` (group: string) in the source file;
// the cast to local `TokenDef[]` (group: TokenGroup) is safe because every
// literal group value in the arrays is a valid TokenGroup union member.
import {
  SPACING_TOKENS as _SPACING_TOKENS,
  FONT_TOKENS as _FONT_TOKENS,
  SIZE_TOKENS as _SIZE_TOKENS,
  COLOR_TOKENS as _COLOR_TOKENS,
} from "@/config/design-tokens-manifest";

export const SPACING_TOKENS: readonly TokenDef[] = _SPACING_TOKENS as unknown as readonly TokenDef[];
export const FONT_TOKENS: readonly TokenDef[] = _FONT_TOKENS as unknown as readonly TokenDef[];
export const SIZE_TOKENS: readonly TokenDef[] = _SIZE_TOKENS as unknown as readonly TokenDef[];
export const COLOR_TOKENS: readonly TokenDef[] = _COLOR_TOKENS as unknown as readonly TokenDef[];

/** Human-readable section titles for grouped rendering. */
export const GROUP_TITLES: Record<TokenGroup, string> = {
  hsp: "HORIZONTAL SPACING (HSP)",
  vsp: "VERTICAL SPACING (VSP)",
  icon: "ICONS",
  layout: "LAYOUT",
  "font-size": "FONT SIZES",
  "line-height": "LINE HEIGHTS",
  "font-weight": "FONT WEIGHTS",
  "font-family": "FONT FAMILIES",
  "font-scale": "ADVANCED — SCALE (TIER 1)",
  radius: "BORDER RADIUS",
  transition: "TRANSITIONS",
};

/** Stable display order of groups within the Spacing tab. */
export const GROUP_ORDER: readonly TokenGroup[] = ["hsp", "vsp", "icon", "layout"] as const;

/** Stable display order of primary groups within the Font tab.
 *  The `font-scale` group is rendered separately under an Advanced disclosure. */
export const FONT_GROUP_ORDER: readonly TokenGroup[] = [
  "font-size",
  "line-height",
  "font-weight",
  "font-family",
] as const;

/** Stable display order of size-tab groups. */
export const SIZE_GROUP_ORDER: readonly TokenGroup[] = ["radius", "transition"] as const;

// --- Value parsing helpers (shared across controls + persist) ---

/**
 * Parse a CSS length string like `"1.5rem"` into its numeric part.
 * Returns `null` for anything non-numeric (e.g. `clamp(...)`, `"0"` counts as 0).
 *
 * Intentionally permissive: strips any non-numeric suffix after the leading
 * number, which is exactly what our slider rows need (user-typed `"1.5rem"` →
 * 1.5, `"12px"` → 12). Falls back to `null` for unparseable input so the caller
 * can decide the error UX.
 */
export function parseNumericValue(value: string): number | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

/** Format a numeric slider value back into the stored string form. */
export function formatValue(n: number, unit: string): string {
  // Trim needless trailing zeros but keep the value readable.
  // `Number.prototype.toString` already drops zeros for decimals, which is
  // what we want here.
  return `${n}${unit}`;
}

/** Convenience: build a lookup map keyed by token id. */
export function buildTokenIndex(
  ...groups: readonly (readonly TokenDef[])[]
): Record<string, TokenDef> {
  const out: Record<string, TokenDef> = {};
  for (const group of groups) {
    for (const t of group) {
      out[t.id] = t;
    }
  }
  return out;
}
