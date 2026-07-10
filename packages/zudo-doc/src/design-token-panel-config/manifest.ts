/**
 * Design-token manifest data arrays — the PACKAGE-DEFAULT source of truth for
 * the spacing/font/size tabs of `buildDesignTokenPanelConfig` (#2658, epic
 * Minimal Scaffold #2651).
 *
 * Ported verbatim from the showcase's `src/config/design-tokens-manifest.ts`
 * (values mirror the defaults shipped by `@takazudo/zudo-doc/theme.css`,
 * #2655) so `designTokenPanel: true` works with no host manifest file. A
 * project that needs its own token set entirely ejects via
 * `designTokenPanelConfigModule` (see `../plugins/routes.ts`), not by editing
 * this file — this module stays the PACKAGE default.
 *
 * Type strategy: arrays are typed `readonly TokenDef[]`, matching the
 * upstream zdtp `TokenDef` shape consumed by `../color-scheme-utils.js` and
 * `./index.ts` (which partitions them into `TabConfig.tiers` by `group`).
 */
import type { TokenDef } from "@takazudo/zdtp";

// --- Font weight select options ---
const FONT_WEIGHT_OPTIONS = [
  "100", "200", "300", "400", "500", "600", "700", "800", "900",
] as const;

/**
 * Spacing tokens — mirrors every `--spacing-*` declaration shipped by
 * `@takazudo/zudo-doc/theme.css`, plus the `--zd-sidebar-w` layout token.
 * Read-only rows surface tokens whose value can't be expressed on a
 * single-axis slider (`clamp()`, structural `0`).
 */
export const SPACING_TOKENS: readonly TokenDef[] = [
  // --- Horizontal spacing ---
  { id: "hsp-2xs", cssVar: "--spacing-hsp-2xs", label: "hsp-2xs", group: "hsp", default: "0.125rem", step: 0.025, unit: "rem" },
  { id: "hsp-xs",  cssVar: "--spacing-hsp-xs",  label: "hsp-xs",  group: "hsp", default: "0.375rem", step: 0.025, unit: "rem" },
  { id: "hsp-sm",  cssVar: "--spacing-hsp-sm",  label: "hsp-sm",  group: "hsp", default: "0.5rem",   step: 0.025, unit: "rem" },
  { id: "hsp-md",  cssVar: "--spacing-hsp-md",  label: "hsp-md",  group: "hsp", default: "0.75rem",  step: 0.025, unit: "rem" },
  { id: "hsp-lg",  cssVar: "--spacing-hsp-lg",  label: "hsp-lg",  group: "hsp", default: "1rem",     step: 0.025, unit: "rem" },
  { id: "hsp-xl",  cssVar: "--spacing-hsp-xl",  label: "hsp-xl",  group: "hsp", default: "1.5rem",   step: 0.025, unit: "rem" },
  { id: "hsp-2xl", cssVar: "--spacing-hsp-2xl", label: "hsp-2xl", group: "hsp", default: "2rem",     step: 0.025, unit: "rem" },

  // --- Vertical spacing ---
  { id: "vsp-3xs", cssVar: "--spacing-vsp-3xs", label: "vsp-3xs", group: "vsp", default: "0.25rem",   step: 0.025, unit: "rem" },
  { id: "vsp-2xs", cssVar: "--spacing-vsp-2xs", label: "vsp-2xs", group: "vsp", default: "0.4375rem", step: 0.025, unit: "rem" },
  { id: "vsp-xs",  cssVar: "--spacing-vsp-xs",  label: "vsp-xs",  group: "vsp", default: "0.875rem",  step: 0.025, unit: "rem" },
  { id: "vsp-sm",  cssVar: "--spacing-vsp-sm",  label: "vsp-sm",  group: "vsp", default: "1.25rem",   step: 0.025, unit: "rem" },
  { id: "vsp-md",  cssVar: "--spacing-vsp-md",  label: "vsp-md",  group: "vsp", default: "1.5rem",    step: 0.025, unit: "rem" },
  { id: "vsp-lg",  cssVar: "--spacing-vsp-lg",  label: "vsp-lg",  group: "vsp", default: "1.75rem",   step: 0.025, unit: "rem" },
  { id: "vsp-xl",  cssVar: "--spacing-vsp-xl",  label: "vsp-xl",  group: "vsp", default: "2.5rem",    step: 0.025, unit: "rem" },
  { id: "vsp-2xl", cssVar: "--spacing-vsp-2xl", label: "vsp-2xl", group: "vsp", default: "3.5rem",    step: 0.025, unit: "rem" },

  // --- Icons ---
  { id: "icon-xs", cssVar: "--spacing-icon-xs", label: "icon-xs", group: "icon", default: "0.75rem", step: 0.05, unit: "rem" },
  { id: "icon-sm", cssVar: "--spacing-icon-sm", label: "icon-sm", group: "icon", default: "1rem",    step: 0.05, unit: "rem" },
  { id: "icon-md", cssVar: "--spacing-icon-md", label: "icon-md", group: "icon", default: "1.25rem", step: 0.05, unit: "rem" },
  { id: "icon-lg", cssVar: "--spacing-icon-lg", label: "icon-lg", group: "icon", default: "1.5rem",  step: 0.05, unit: "rem" },

  // --- Layout ---
  { id: "image-overlay-inset", cssVar: "--spacing-image-overlay-inset", label: "image-overlay-inset", group: "layout", default: "0.5rem", step: 0.05, unit: "rem" },
  // Structural zero — surfaced as read-only so designers see it exists, but
  // editing it would break every utility that relies on "0 is 0".
  { id: "spacing-0",  cssVar: "--spacing-0",  label: "spacing-0",  group: "layout", default: "0",   step: 1, unit: "",   readonly: true },
  // 1px hairline — also read-only by design.
  { id: "spacing-px", cssVar: "--spacing-px", label: "spacing-px", group: "layout", default: "1px", step: 1, unit: "px", readonly: true },
  // Responsive clamp() expression — can't be expressed on a single slider.
  { id: "sidebar-w",  cssVar: "--zd-sidebar-w", label: "sidebar-w", group: "layout", default: "clamp(14rem, 20vw, 22rem)", step: 1, unit: "", readonly: true },
];

/**
 * Font tokens — mirrors every font-related declaration shipped by
 * `@takazudo/zudo-doc/theme.css`.
 *
 * Tier 2 semantic tokens (sizes, line-heights, weights, families) are exposed
 * as primary tiers; Tier 1 abstract scale (`--text-scale-*`) lives in its own
 * `font-scale` tier so designers who tweak the scale see the tokens that the
 * semantic sizes resolve from.
 */
export const FONT_TOKENS: readonly TokenDef[] = [
  // --- Font sizes (Tier 2 semantic) ---
  { id: "text-micro",      cssVar: "--text-micro",      label: "text-micro",      group: "font-size", default: "0.75rem",  step: 0.05, unit: "rem" },
  { id: "text-caption",    cssVar: "--text-caption",    label: "text-caption",    group: "font-size", default: "0.875rem", step: 0.05, unit: "rem" },
  { id: "text-small",      cssVar: "--text-small",      label: "text-small",      group: "font-size", default: "1rem",     step: 0.05, unit: "rem" },
  { id: "text-body",       cssVar: "--text-body",       label: "text-body",       group: "font-size", default: "1.2rem",   step: 0.05, unit: "rem" },
  { id: "text-title",      cssVar: "--text-title",      label: "text-title",      group: "font-size", default: "1.4rem",   step: 0.05, unit: "rem" },
  { id: "text-heading",    cssVar: "--text-heading",    label: "text-heading",    group: "font-size", default: "3rem",     step: 0.05, unit: "rem" },
  { id: "text-display",    cssVar: "--text-display",    label: "text-display",    group: "font-size", default: "3.75rem",  step: 0.05, unit: "rem" },

  // --- Line heights (unitless) ---
  { id: "leading-tight",   cssVar: "--leading-tight",   label: "leading-tight",   group: "line-height", default: "1.25",  step: 0.05, unit: "" },
  { id: "leading-snug",    cssVar: "--leading-snug",    label: "leading-snug",    group: "line-height", default: "1.375", step: 0.05, unit: "" },
  { id: "leading-normal",  cssVar: "--leading-normal",  label: "leading-normal",  group: "line-height", default: "1.5",   step: 0.05, unit: "" },
  { id: "leading-relaxed", cssVar: "--leading-relaxed", label: "leading-relaxed", group: "line-height", default: "1.625", step: 0.05, unit: "" },

  // --- Font weights (select) ---
  { id: "font-weight-normal",   cssVar: "--font-weight-normal",   label: "font-weight-normal",   group: "font-weight", default: "400", step: 1, unit: "", control: "select", options: FONT_WEIGHT_OPTIONS },
  { id: "font-weight-medium",   cssVar: "--font-weight-medium",   label: "font-weight-medium",   group: "font-weight", default: "500", step: 1, unit: "", control: "select", options: FONT_WEIGHT_OPTIONS },
  { id: "font-weight-semibold", cssVar: "--font-weight-semibold", label: "font-weight-semibold", group: "font-weight", default: "600", step: 1, unit: "", control: "select", options: FONT_WEIGHT_OPTIONS },
  { id: "font-weight-bold",     cssVar: "--font-weight-bold",     label: "font-weight-bold",     group: "font-weight", default: "700", step: 1, unit: "", control: "select", options: FONT_WEIGHT_OPTIONS },

  // --- Font families (text input) ---
  { id: "font-sans", cssVar: "--font-sans", label: "font-sans", group: "font-family", default: "system-ui, sans-serif",    step: 1, unit: "", control: "text" },
  { id: "font-mono", cssVar: "--font-mono", label: "font-mono", group: "font-family", default: "ui-monospace, monospace",  step: 1, unit: "", control: "text" },

  // --- Tier 1 abstract scale ---
  { id: "text-scale-2xs", cssVar: "--text-scale-2xs", label: "text-scale-2xs", group: "font-scale", default: "0.75rem",  step: 0.05, unit: "rem" },
  { id: "text-scale-xs",  cssVar: "--text-scale-xs",  label: "text-scale-xs",  group: "font-scale", default: "0.875rem", step: 0.05, unit: "rem" },
  { id: "text-scale-sm",  cssVar: "--text-scale-sm",  label: "text-scale-sm",  group: "font-scale", default: "1rem",     step: 0.05, unit: "rem" },
  { id: "text-scale-md",  cssVar: "--text-scale-md",  label: "text-scale-md",  group: "font-scale", default: "1.2rem",   step: 0.05, unit: "rem" },
  { id: "text-scale-lg",  cssVar: "--text-scale-lg",  label: "text-scale-lg",  group: "font-scale", default: "1.4rem",   step: 0.05, unit: "rem" },
  { id: "text-scale-xl",  cssVar: "--text-scale-xl",  label: "text-scale-xl",  group: "font-scale", default: "3rem",     step: 0.05, unit: "rem" },
  { id: "text-scale-2xl", cssVar: "--text-scale-2xl", label: "text-scale-2xl", group: "font-scale", default: "3.75rem",  step: 0.05, unit: "rem" },
];

/**
 * Size tokens — mirrors every non-breakpoint size-category custom property
 * shipped by `@takazudo/zudo-doc/theme.css`. Breakpoints (`--breakpoint-*`)
 * are intentionally omitted — live-changing them causes layout thrash
 * mid-drag and adds no real tweak value.
 *
 * Radius defaults use `px` (matches a 0-100 slider), even though
 * `theme.css` expresses them in `rem` — the browser accepts both.
 * `--radius-full` carries a `pill` toggle: its design default (`9999px`) is
 * an intentional sentinel a 0-100 slider can't reach.
 */
export const SIZE_TOKENS: readonly TokenDef[] = [
  // --- Radius ---
  { id: "radius-DEFAULT", cssVar: "--radius-DEFAULT", label: "radius-DEFAULT", group: "radius", default: "4px", step: 1, unit: "px" },
  { id: "radius-lg",      cssVar: "--radius-lg",      label: "radius-lg",      group: "radius", default: "8px", step: 1, unit: "px" },
  {
    id: "radius-full",
    cssVar: "--radius-full",
    label: "radius-full",
    group: "radius",
    default: "9999px",
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
    step: 10,
    unit: "ms",
  },
];
