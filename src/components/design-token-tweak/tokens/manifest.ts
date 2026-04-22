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

export type TokenGroup = "hsp" | "vsp" | "icon" | "layout";

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

export const FONT_TOKENS: readonly TokenDef[] = [] as const;
export const SIZE_TOKENS: readonly TokenDef[] = [] as const;
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
};

/** Stable display order of groups within a tab. */
export const GROUP_ORDER: readonly TokenGroup[] = ["hsp", "vsp", "icon", "layout"] as const;

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
