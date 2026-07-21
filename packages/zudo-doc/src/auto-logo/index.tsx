/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// auto-logo — deterministic generated fallback logo for the home hero.
//
// A fresh scaffold ships no `/img/logo.svg`, which used to leave the hero's
// mask block rendering against a missing asset. When `settings.logo` is
// `"auto"` (the default), `HomePageView` renders this component instead: a
// "decorated plate" SVG — plate + thin inner frame + diagonal corner rays +
// centered disc + a line-art glyph — generated purely from the site name.
// Same seed always produces the same logo; no stored asset, no client JS.
//
// Color contract: the plate fills `currentColor` (give the element `text-fg`)
// and every frame line / disc knockout uses `var(--color-bg)` so the logo
// sits visually "knocked out" against the page background and adapts to
// light/dark automatically. The visual recipe is the `plate-rays-icon`
// variant picked from the design prototype (cclogs `auto-logo-gen`).
//
// Glyph shapes + plate geometry live in ./shapes.ts as plain data, shared
// with the dependency-free standalone SVG builder (./standalone.ts, epic
// #3047) so the two renderers cannot drift.

import { h } from "preact";
import type { JSX } from "preact";
import {
  W,
  H,
  PLATE_SHAPE,
  INNER_FRAME_SHAPE,
  RAY_SHAPES,
  DISC_SHAPE,
  GLYPH_SHAPES,
  GLYPH_TRANSFORM,
  pickGlyphName,
  type ShapePrimitive,
} from "./shapes.js";

export { pickGlyphName };
export { renderAutoLogoStandaloneSvg } from "./standalone.js";

/** Props for {@link AutoLogo}. */
export interface AutoLogoProps {
  /** Deterministic seed — pass `settings.siteName`. */
  seed: string;
  /** Class list for the root `<svg>` (sizing/color, e.g. `w-[320px] text-fg`). */
  class?: string;
}

function renderShape({ el, attrs }: ShapePrimitive, key?: number): JSX.Element {
  return h(el, key !== undefined ? { ...attrs, key } : attrs) as JSX.Element;
}

/**
 * Generated "decorated plate" logo — plate + frame + corner rays + disc +
 * seeded line-art glyph. Server-rendered, deterministic per seed.
 */
export function AutoLogo({ seed, class: className }: AutoLogoProps): JSX.Element {
  const glyphName = pickGlyphName(seed);
  const glyphShapes = GLYPH_SHAPES[glyphName]!;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} fill="currentColor" class={className} data-auto-logo={glyphName} aria-hidden="true">
      {renderShape(PLATE_SHAPE)}
      {renderShape(INNER_FRAME_SHAPE)}
      {RAY_SHAPES.map((ray, i) => renderShape(ray, i))}
      {renderShape(DISC_SHAPE)}
      <g transform={GLYPH_TRANSFORM}>{glyphShapes.map((shape, i) => renderShape(shape, i))}</g>
    </svg>
  );
}
