/**
 * Design-token manifest data arrays — canonical source of truth for all
 * editable design tokens, lifted out of the legacy panel component directory
 * so they survive the W3-2 deletion of the panel component tree.
 *
 * Imported by:
 *  - src/config/design-token-panel-config.ts  (groups items into TabConfig.tiers)
 *  - @takazudo/zudo-doc/theme (design-token-serde) — cssVar ↔ id lookup for JSON I/O
 *
 * Type strategy: arrays are typed `readonly TokenDef[]` for back-compat with
 * the consumer serde and tests. `design-token-panel-config.ts` partitions the
 * flat arrays by the `group` field into the new zdtp `TabConfig.tiers` shape.
 * `TokenDef.advanced` was dropped upstream (zdtp 8abb1e4) — items previously
 * gated behind an "Advanced" disclosure now live in their own tier ("Scale —
 * advanced") so the tier acts as the disclosure container.
 */
import type { TokenDef } from "@takazudo/zdtp";

// --- Font weight select options ---
const FONT_WEIGHT_OPTIONS = [
  "100", "200", "300", "400", "500", "600", "700", "800", "900",
] as const;

/**
 * Spacing tokens from `global.css`.
 *
 * Coverage (audit 2026-04): every `--spacing-*` declaration plus the
 * `--zd-sidebar-w` layout token. Read-only rows surface tokens whose value
 * can't be expressed on a single-axis slider (`clamp()`, structural `0`).
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
 * Font tokens from `global.css`.
 *
 * Tier 2 semantic tokens (sizes, line-heights, weights, families) are exposed
 * as primary tiers; Tier 1 abstract scale (`--text-scale-*`) lives in its own
 * `font-scale` tier so designers who tweak the scale see the tokens that the
 * semantic sizes resolve from.
 *
 * (Note: `TokenDef.advanced` was dropped upstream in zdtp 8abb1e4. The
 * progressive-disclosure container is now the tier itself; the
 * panel-config groups by `group` and presents each tier as a separate
 * section under the Font tab.)
 *
 * Defaults here mirror `global.css` resolved rem values (`--text-body` →
 * `1.2rem`) so serde and the flat-`TokenManifest` generator template have a
 * concrete number. The tier-based main panel (`design-token-panel-config.ts`)
 * promotes the `font-size` group to a *reference* tier pointing at
 * `font-scale`, overriding these defaults to the referenced scale id so the
 * panel reflects the `var(--text-scale-*)` wiring the CSS already encodes.
 */
export const FONT_TOKENS: readonly TokenDef[] = [
  // --- Font sizes (Tier 2 semantic) ---
  { id: "text-micro",      cssVar: "--text-micro",      label: "text-micro",      group: "font-size", default: "0.75rem",  step: 0.05, unit: "rem" },
  { id: "text-caption",    cssVar: "--text-caption",    label: "text-caption",    group: "font-size", default: "0.875rem", step: 0.05, unit: "rem" },
  { id: "text-small",      cssVar: "--text-small",      label: "text-small",      group: "font-size", default: "1rem",     step: 0.05, unit: "rem" },
  { id: "text-body",       cssVar: "--text-body",       label: "text-body",       group: "font-size", default: "1.2rem",   step: 0.05, unit: "rem" },
  { id: "text-title", cssVar: "--text-title", label: "text-title", group: "font-size", default: "1.4rem",   step: 0.05, unit: "rem" },
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

  // --- Tier 1 abstract scale (was "Advanced" disclosure in v1 of the panel;
  //     now lives in its own font-scale tier). ---
  { id: "text-scale-2xs", cssVar: "--text-scale-2xs", label: "text-scale-2xs", group: "font-scale", default: "0.75rem",  step: 0.05, unit: "rem" },
  { id: "text-scale-xs",  cssVar: "--text-scale-xs",  label: "text-scale-xs",  group: "font-scale", default: "0.875rem", step: 0.05, unit: "rem" },
  { id: "text-scale-sm",  cssVar: "--text-scale-sm",  label: "text-scale-sm",  group: "font-scale", default: "1rem",     step: 0.05, unit: "rem" },
  { id: "text-scale-md",  cssVar: "--text-scale-md",  label: "text-scale-md",  group: "font-scale", default: "1.2rem",   step: 0.05, unit: "rem" },
  { id: "text-scale-lg",  cssVar: "--text-scale-lg",  label: "text-scale-lg",  group: "font-scale", default: "1.4rem",   step: 0.05, unit: "rem" },
  { id: "text-scale-xl",  cssVar: "--text-scale-xl",  label: "text-scale-xl",  group: "font-scale", default: "3rem",     step: 0.05, unit: "rem" },
  { id: "text-scale-2xl", cssVar: "--text-scale-2xl", label: "text-scale-2xl", group: "font-scale", default: "3.75rem",  step: 0.05, unit: "rem" },
];

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

/**
 * Color tokens — kept as an empty array for back-compat with the consumer
 * serde, which historically iterated `COLOR_TOKENS` symmetric with the other
 * three arrays. Color is cluster-driven in zudo-doc and is constructed in
 * `design-token-panel-config.ts` from `colorSchemes` + `SEMANTIC_*` —
 * not from this array.
 */
export const COLOR_TOKENS: readonly TokenDef[] = [];
