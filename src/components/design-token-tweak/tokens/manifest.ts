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

/**
 * Spacing tokens from `global.css`.
 *
 * Coverage (audit 2026-04): every `--spacing-*` declaration plus the
 * `--zd-sidebar-w` layout token. Read-only rows surface tokens whose value
 * can't be expressed on a single-axis slider (`clamp()`, structural `0`).
 */
export const SPACING_TOKENS: readonly TokenDef[] = [
  // --- Horizontal spacing ---
  { id: "hsp-2xs", cssVar: "--spacing-hsp-2xs", label: "hsp-2xs", group: "hsp", default: "0.125rem", min: 0, max: 3, step: 0.025, unit: "rem" },
  { id: "hsp-xs",  cssVar: "--spacing-hsp-xs",  label: "hsp-xs",  group: "hsp", default: "0.375rem", min: 0, max: 3, step: 0.025, unit: "rem" },
  { id: "hsp-sm",  cssVar: "--spacing-hsp-sm",  label: "hsp-sm",  group: "hsp", default: "0.5rem",   min: 0, max: 3, step: 0.025, unit: "rem" },
  { id: "hsp-md",  cssVar: "--spacing-hsp-md",  label: "hsp-md",  group: "hsp", default: "0.75rem",  min: 0, max: 3, step: 0.025, unit: "rem" },
  { id: "hsp-lg",  cssVar: "--spacing-hsp-lg",  label: "hsp-lg",  group: "hsp", default: "1rem",     min: 0, max: 3, step: 0.025, unit: "rem" },
  { id: "hsp-xl",  cssVar: "--spacing-hsp-xl",  label: "hsp-xl",  group: "hsp", default: "1.5rem",   min: 0, max: 3, step: 0.025, unit: "rem" },
  { id: "hsp-2xl", cssVar: "--spacing-hsp-2xl", label: "hsp-2xl", group: "hsp", default: "2rem",     min: 0, max: 3, step: 0.025, unit: "rem" },

  // --- Vertical spacing ---
  { id: "vsp-2xs", cssVar: "--spacing-vsp-2xs", label: "vsp-2xs", group: "vsp", default: "0.4375rem", min: 0, max: 4, step: 0.025, unit: "rem" },
  { id: "vsp-xs",  cssVar: "--spacing-vsp-xs",  label: "vsp-xs",  group: "vsp", default: "0.875rem",  min: 0, max: 4, step: 0.025, unit: "rem" },
  { id: "vsp-sm",  cssVar: "--spacing-vsp-sm",  label: "vsp-sm",  group: "vsp", default: "1.25rem",   min: 0, max: 4, step: 0.025, unit: "rem" },
  { id: "vsp-md",  cssVar: "--spacing-vsp-md",  label: "vsp-md",  group: "vsp", default: "1.5rem",    min: 0, max: 4, step: 0.025, unit: "rem" },
  { id: "vsp-lg",  cssVar: "--spacing-vsp-lg",  label: "vsp-lg",  group: "vsp", default: "1.75rem",   min: 0, max: 4, step: 0.025, unit: "rem" },
  { id: "vsp-xl",  cssVar: "--spacing-vsp-xl",  label: "vsp-xl",  group: "vsp", default: "2.5rem",    min: 0, max: 4, step: 0.025, unit: "rem" },
  { id: "vsp-2xl", cssVar: "--spacing-vsp-2xl", label: "vsp-2xl", group: "vsp", default: "3.5rem",    min: 0, max: 4, step: 0.025, unit: "rem" },

  // --- Icons ---
  { id: "icon-xs", cssVar: "--spacing-icon-xs", label: "icon-xs", group: "icon", default: "0.75rem", min: 0, max: 2, step: 0.05, unit: "rem" },
  { id: "icon-sm", cssVar: "--spacing-icon-sm", label: "icon-sm", group: "icon", default: "1rem",    min: 0, max: 2, step: 0.05, unit: "rem" },
  { id: "icon-md", cssVar: "--spacing-icon-md", label: "icon-md", group: "icon", default: "1.25rem", min: 0, max: 2, step: 0.05, unit: "rem" },
  { id: "icon-lg", cssVar: "--spacing-icon-lg", label: "icon-lg", group: "icon", default: "1.5rem",  min: 0, max: 2, step: 0.05, unit: "rem" },

  // --- Layout ---
  { id: "image-overlay-inset", cssVar: "--spacing-image-overlay-inset", label: "image-overlay-inset", group: "layout", default: "0.5rem", min: 0, max: 2, step: 0.05, unit: "rem" },
  // Structural zero — surfaced as read-only so designers see it exists, but
  // editing it would break every utility that relies on "0 is 0".
  { id: "spacing-0",  cssVar: "--spacing-0",  label: "spacing-0",  group: "layout", default: "0",   min: 0, max: 0, step: 1, unit: "",   readonly: true },
  // 1px hairline — also read-only by design.
  { id: "spacing-px", cssVar: "--spacing-px", label: "spacing-px", group: "layout", default: "1px", min: 0, max: 0, step: 1, unit: "px", readonly: true },
  // Responsive clamp() expression — can't be expressed on a single slider.
  { id: "sidebar-w",  cssVar: "--zd-sidebar-w", label: "sidebar-w", group: "layout", default: "clamp(14rem, 20vw, 22rem)", min: 0, max: 0, step: 1, unit: "", readonly: true },
] as const;

/**
 * Font tokens from `global.css`.
 *
 * Tier 2 semantic tokens (sizes, line-heights, weights, families) are exposed
 * as primary rows; Tier 1 abstract scale (`--text-scale-*`) is surfaced under
 * an Advanced disclosure so designers who tweak the scale see the tokens that
 * the semantic sizes resolve from.
 *
 * Defaults mirror `global.css` resolved values: font-size tokens are recorded
 * as their resolved rem (`--text-body` → `1.2rem`) rather than their `var()`
 * reference, so the slider can display a concrete number on first open.
 */
const FONT_WEIGHT_OPTIONS = [
  "100", "200", "300", "400", "500", "600", "700", "800", "900",
] as const;

export const FONT_TOKENS: readonly TokenDef[] = [
  // --- Font sizes (Tier 2 semantic) ---
  { id: "text-micro",      cssVar: "--text-micro",      label: "text-micro",      group: "font-size", default: "0.75rem",  min: 0.5, max: 5, step: 0.05, unit: "rem" },
  { id: "text-caption",    cssVar: "--text-caption",    label: "text-caption",    group: "font-size", default: "0.875rem", min: 0.5, max: 5, step: 0.05, unit: "rem" },
  { id: "text-small",      cssVar: "--text-small",      label: "text-small",      group: "font-size", default: "1rem",     min: 0.5, max: 5, step: 0.05, unit: "rem" },
  { id: "text-body",       cssVar: "--text-body",       label: "text-body",       group: "font-size", default: "1.2rem",   min: 0.5, max: 5, step: 0.05, unit: "rem" },
  { id: "text-subheading", cssVar: "--text-subheading", label: "text-subheading", group: "font-size", default: "1.4rem",   min: 0.5, max: 5, step: 0.05, unit: "rem" },
  { id: "text-heading",    cssVar: "--text-heading",    label: "text-heading",    group: "font-size", default: "3rem",     min: 0.5, max: 5, step: 0.05, unit: "rem" },
  { id: "text-display",    cssVar: "--text-display",    label: "text-display",    group: "font-size", default: "3.75rem",  min: 0.5, max: 5, step: 0.05, unit: "rem" },

  // --- Line heights (unitless) ---
  { id: "leading-tight",   cssVar: "--leading-tight",   label: "leading-tight",   group: "line-height", default: "1.25",  min: 1, max: 3, step: 0.05, unit: "" },
  { id: "leading-snug",    cssVar: "--leading-snug",    label: "leading-snug",    group: "line-height", default: "1.375", min: 1, max: 3, step: 0.05, unit: "" },
  { id: "leading-normal",  cssVar: "--leading-normal",  label: "leading-normal",  group: "line-height", default: "1.5",   min: 1, max: 3, step: 0.05, unit: "" },
  { id: "leading-relaxed", cssVar: "--leading-relaxed", label: "leading-relaxed", group: "line-height", default: "1.625", min: 1, max: 3, step: 0.05, unit: "" },

  // --- Font weights (select) ---
  { id: "font-weight-normal",   cssVar: "--font-weight-normal",   label: "font-weight-normal",   group: "font-weight", default: "400", min: 0, max: 0, step: 1, unit: "", control: "select", options: FONT_WEIGHT_OPTIONS },
  { id: "font-weight-medium",   cssVar: "--font-weight-medium",   label: "font-weight-medium",   group: "font-weight", default: "500", min: 0, max: 0, step: 1, unit: "", control: "select", options: FONT_WEIGHT_OPTIONS },
  { id: "font-weight-semibold", cssVar: "--font-weight-semibold", label: "font-weight-semibold", group: "font-weight", default: "600", min: 0, max: 0, step: 1, unit: "", control: "select", options: FONT_WEIGHT_OPTIONS },
  { id: "font-weight-bold",     cssVar: "--font-weight-bold",     label: "font-weight-bold",     group: "font-weight", default: "700", min: 0, max: 0, step: 1, unit: "", control: "select", options: FONT_WEIGHT_OPTIONS },

  // --- Font families (text input) ---
  { id: "font-sans", cssVar: "--font-sans", label: "font-sans", group: "font-family", default: "system-ui, sans-serif",    min: 0, max: 0, step: 1, unit: "", control: "text" },
  { id: "font-mono", cssVar: "--font-mono", label: "font-mono", group: "font-family", default: "ui-monospace, monospace",  min: 0, max: 0, step: 1, unit: "", control: "text" },

  // --- Advanced: Tier 1 abstract scale (reveals behind <details>) ---
  { id: "text-scale-2xs", cssVar: "--text-scale-2xs", label: "text-scale-2xs", group: "font-scale", default: "0.75rem",  min: 0.5, max: 5, step: 0.05, unit: "rem", advanced: true },
  { id: "text-scale-xs",  cssVar: "--text-scale-xs",  label: "text-scale-xs",  group: "font-scale", default: "0.875rem", min: 0.5, max: 5, step: 0.05, unit: "rem", advanced: true },
  { id: "text-scale-sm",  cssVar: "--text-scale-sm",  label: "text-scale-sm",  group: "font-scale", default: "1rem",     min: 0.5, max: 5, step: 0.05, unit: "rem", advanced: true },
  { id: "text-scale-md",  cssVar: "--text-scale-md",  label: "text-scale-md",  group: "font-scale", default: "1.2rem",   min: 0.5, max: 5, step: 0.05, unit: "rem", advanced: true },
  { id: "text-scale-lg",  cssVar: "--text-scale-lg",  label: "text-scale-lg",  group: "font-scale", default: "1.4rem",   min: 0.5, max: 5, step: 0.05, unit: "rem", advanced: true },
  { id: "text-scale-xl",  cssVar: "--text-scale-xl",  label: "text-scale-xl",  group: "font-scale", default: "3rem",     min: 0.5, max: 5, step: 0.05, unit: "rem", advanced: true },
  { id: "text-scale-2xl", cssVar: "--text-scale-2xl", label: "text-scale-2xl", group: "font-scale", default: "3.75rem",  min: 0.5, max: 5, step: 0.05, unit: "rem", advanced: true },
] as const;

/**
 * Size tokens from `global.css`.
 *
 * Coverage (audit 2026-04): every non-breakpoint size-category custom property.
 * Breakpoints (`--breakpoint-sm/lg/xl`) are intentionally omitted — live-
 * changing them causes layout thrash mid-drag and adds no real tweak value.
 *
 * Radius defaults use `px` (matches the 0–100 slider in the sub-issue spec),
 * even though `global.css` expresses them in `rem` — the browser accepts both.
 *
 * `--radius-full` is special: its design default (`9999px`) is an intentional
 * sentinel that a 0–100 slider can't reach, so it carries a `pill` toggle. The
 * checkbox reapplies the sentinel; unchecking drops back to a slider-editable
 * custom value.
 */
export const SIZE_TOKENS: readonly TokenDef[] = [
  // --- Radius ---
  { id: "radius-DEFAULT", cssVar: "--radius-DEFAULT", label: "radius-DEFAULT", group: "radius", default: "4px", min: 0, max: 100, step: 1, unit: "px" },
  { id: "radius-lg",      cssVar: "--radius-lg",      label: "radius-lg",      group: "radius", default: "8px", min: 0, max: 100, step: 1, unit: "px" },
  {
    id: "radius-full",
    cssVar: "--radius-full",
    label: "radius-full",
    group: "radius",
    default: "9999px",
    min: 0,
    max: 100,
    step: 1,
    unit: "px",
    pill: { value: "9999px", customDefault: "16px" },
  },

  // --- Transitions ---
  {
    id: "default-transition-duration",
    cssVar: "--default-transition-duration",
    label: "default-transition-duration",
    group: "transition",
    default: "150ms",
    min: 0,
    max: 1000,
    step: 10,
    unit: "ms",
  },
] as const;

export const COLOR_TOKENS: readonly TokenDef[] = [] as const;

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
