/**
 * Shared WCAG 2.x contrast math + color-resolution helpers.
 *
 * Extracted from `src/config/__tests__/contrast.test.ts` (S1 #2490) so the
 * contrast-audit script (`scripts/contrast-audit.ts`) and the vitest guard
 * share identical math and resolution logic — no drift between "what the
 * test checks" and "what the audit reports".
 *
 * Project-side only (not re-exported from `@takazudo/zudo-doc`): this is
 * dev/test tooling, not a runtime dependency of generated projects, so it
 * stays out of the package's release lockstep.
 */

import { rgb as culoriRgb } from "culori";
import { resolveRampRef, type ColorScheme } from "@takazudo/zudo-doc/color-scheme-utils";

// ---------------------------------------------------------------------------
// WCAG 2.x luminance / contrast math — parses any CSS color via culori
// ---------------------------------------------------------------------------

/**
 * Parse any CSS color string (hex, oklch, rgb, hsl, …) and return sRGB
 * components clamped to [0, 1]. Throws on unparseable input.
 */
export function parseSrgb(cssColor: string): { r: number; g: number; b: number } {
  const result = culoriRgb(cssColor);
  if (!result) throw new Error(`Cannot parse CSS color: "${cssColor}"`);
  // Clamp to [0, 1]: wide-gamut oklch can produce out-of-gamut sRGB components
  return {
    r: Math.max(0, Math.min(1, result.r)),
    g: Math.max(0, Math.min(1, result.g)),
    b: Math.max(0, Math.min(1, result.b)),
  };
}

export function relativeLuminance(cssColor: string): number {
  const { r, g, b } = parseSrgb(cssColor);
  // WCAG 2.x linearization: gamma-encoded sRGB → linear light
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Simulate CSS color-mix(in srgb, color N%, bg (100-N)%).
 * Parses both inputs via culori, mixes in sRGB, returns a hex string.
 */
export function colorMixSrgb(color: string, bg: string, pct: number): string {
  const f = parseSrgb(color);
  const bv = parseSrgb(bg);
  const ratio = pct / 100;
  const r = f.r * ratio + bv.r * (1 - ratio);
  const g = f.g * ratio + bv.g * (1 - ratio);
  const b = f.b * ratio + bv.b * (1 - ratio);
  const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ---------------------------------------------------------------------------
// Color resolution — delegates to the SAME `resolveRampRef` path production
// uses (`schemeToCssPairs` in `@takazudo/zudo-doc/color-scheme-utils`), so
// the audit can never silently diverge from what actually renders.
// ---------------------------------------------------------------------------

export function resolveBg(scheme: ColorScheme): string {
  return resolveRampRef(scheme.map.bg, scheme.ramps);
}

export function resolveFg(scheme: ColorScheme): string {
  return resolveRampRef(scheme.map.fg, scheme.ramps);
}

// ---------------------------------------------------------------------------
// Admonition contrast helper
// Admonition bg = color-mix(in srgb, semanticColor TINT_PCT%, bgColor) —
// matches `packages/zudo-doc/src/content.css` `[data-admonition]` rules.
// ---------------------------------------------------------------------------

export const ADMONITION_TINT_PCT = 12; // matches content.css "color-mix(in srgb, var(--color-X) 12%, var(--color-bg))"

export function admonitionTitleContrast(colorHex: string, bgHex: string): number {
  const tintedBg = colorMixSrgb(colorHex, bgHex, ADMONITION_TINT_PCT);
  return contrastRatio(colorHex, tintedBg);
}
