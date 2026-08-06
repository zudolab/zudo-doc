// auto-logo/standalone.ts — dependency-free standalone SVG string builder
// for the ejected `public/img/logo.svg` file (epic #3047 "eject logo").
//
// Imports ONLY shapes.ts — no `.tsx`, no preact — so the `zudo-doc eject
// logo` CLI (a later sibling issue, #3050) can import the compiled
// `dist/auto-logo/standalone.js` directly without pulling in
// `preact/jsx-runtime`.
//
// Key constraint (see shapes.ts's color contract and the epic issue): the
// runtime `AutoLogo` component paints ink with `currentColor` and knockouts
// with `var(--color-bg)` — neither resolves inside an external CSS-mask
// image, where only the alpha channel matters. This builder instead
// expresses the design via an internal SVG **luminance** `<mask>`: white =
// visible in the final alpha, black = cut away. `currentColor` (ink: frame,
// rays, disc) maps to white; `var(--color-bg)` (knockouts: plate + glyph)
// maps to black — so the two tokens both disappear from the output and the
// design survives purely as alpha.
//
// Consequence of the #3108 role swap, and an accepted limitation of this
// one-color CSS-mask path: the ejected silhouette is frame + rays + a disc
// with the glyph punched out of it. The plate now maps to black, a no-op
// against the mask's black default, so the ejected variant's tile interior
// is transparent where the live component paints an opaque page background.

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
import { escapeAttr, renderShape as renderShapeWith } from "./render-shape.js";

const MASK_ID = "auto-logo-mask";

// currentColor (ink: frame, rays, disc) -> visible in the mask (white);
// var(--color-bg) (knockout: plate + glyph) -> cut away (black). These are
// the only two color tokens any shape in shapes.ts ever carries, so
// substituting both guarantees the output contains neither `var(` nor
// `currentColor`. The map itself is role-agnostic — it keys on the tokens,
// so the #3108 role swap flowed through it without an edit here.
const MASK_COLORS: Record<string, string> = {
  currentColor: "#fff",
  "var(--color-bg)": "#000",
};

function renderShape(shape: ShapePrimitive): string {
  return renderShapeWith(shape, MASK_COLORS);
}

/**
 * Render the deterministic AutoLogo design as a standalone, mask-friendly
 * SVG string. Same seed always produces byte-identical output; glyph
 * selection reuses {@link pickGlyphName} so an ejected file shows the same
 * glyph as `logo: "auto"` mode.
 */
export function renderAutoLogoStandaloneSvg(seed: string): string {
  const glyphName = pickGlyphName(seed);
  const glyphShapes = GLYPH_SHAPES[glyphName]!;

  // Mask content order: black full-plate rect -> white ink (inner frame
  // stroke, 4 rays, disc) -> black glyph shapes punched back out of the disc.
  const maskContent =
    renderShape(PLATE_SHAPE) +
    renderShape(INNER_FRAME_SHAPE) +
    RAY_SHAPES.map(renderShape).join("") +
    renderShape(DISC_SHAPE) +
    `<g transform="${escapeAttr(GLYPH_TRANSFORM)}">${glyphShapes.map(renderShape).join("")}</g>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" data-auto-logo="${glyphName}">` +
    `<mask id="${MASK_ID}" mask-type="luminance" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">` +
    maskContent +
    `</mask>` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#000" mask="url(#${MASK_ID})" />` +
    `</svg>`
  );
}
