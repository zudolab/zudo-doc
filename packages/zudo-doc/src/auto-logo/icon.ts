// auto-logo/icon.ts — direct-paint square app-icon SVG renderer (epic
// #3285, sub #3286 — the Tauri `src-tauri/icons/icon.png` source artwork).
//
// standalone.ts serializes the design as an alpha-only luminance-mask
// silhouette (for CSS `mask-image`), which is unusable as an app icon: an
// icon must be fully opaque, directly painted artwork. This renderer paints
// the square recomposition (shapes-square.ts) directly, substituting the
// exactly-two color tokens of the shapes.ts color contract with concrete
// hexes — `currentColor` (ink) → ICON_INK, `var(--color-bg)` (plate +
// glyph knockout) → ICON_BG — so the output contains neither `var(` nor
// `currentColor` and needs no CSS to render.
//
// Palette (pinned by #3286): light plate `#ffffff`, ink `#141210` — the
// default light scheme's fg token `oklch(.185 .005 65)`
// (color-schemes-defaults) converted to sRGB, so the icon matches the
// site's default light theme.
//
// Import graph: shapes.ts / shapes-square.ts / render-shape.ts only — no
// `.tsx`, no preact — so a plain node script (the Wave-2 Playwright
// rasterizer, #3287) can import the compiled `dist/auto-logo/icon.js`
// directly, the same deep-import pattern eject-logo uses for
// `dist/auto-logo/standalone.js`. Enforced by
// `__tests__/standalone-eval-graph.test.ts`.

import { GLYPH_SHAPES, pickGlyphName } from "./shapes.js";
import { SQUARE_SIZE, SQUARE_PLATE_SHAPES } from "./shapes-square.js";
import { escapeAttr, renderShape as renderShapeWith } from "./render-shape.js";
import type { ShapePrimitive } from "./shapes.js";

/** Icon plate color — light plate, pinned by #3286. */
export const ICON_BG = "#ffffff";

/** Icon ink — the default light scheme fg `oklch(.185 .005 65)` as sRGB. */
export const ICON_INK = "#141210";

// currentColor (ink: frame, rays, disc) -> ICON_INK; var(--color-bg)
// (knockout: plate + glyph) -> ICON_BG. Same token-keyed substitution shape
// as standalone.ts's MASK_COLORS — full coverage of the two-token contract
// guarantees a token-free output.
const ICON_COLORS: Record<string, string> = {
  currentColor: ICON_INK,
  "var(--color-bg)": ICON_BG,
};

function renderShape(shape: ShapePrimitive): string {
  return renderShapeWith(shape, ICON_COLORS);
}

/**
 * Render the deterministic square icon variant of the AutoLogo design as a
 * standalone, fully opaque, directly painted SVG string. Same seed always
 * produces byte-identical output; glyph selection reuses
 * {@link pickGlyphName} so the icon shows the same glyph as `logo: "auto"`
 * mode and the ejected logo.
 */
export function renderAutoLogoIconSvg(seed: string): string {
  const glyphName = pickGlyphName(seed);
  const glyphShapes = GLYPH_SHAPES[glyphName]!;
  const { plate, innerFrame, rays, disc, glyphTransform } = SQUARE_PLATE_SHAPES;

  // Paint order matches the live component: opaque plate -> inner frame
  // stroke -> 4 rays -> disc -> glyph shapes knocked back out in the plate
  // color.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SQUARE_SIZE} ${SQUARE_SIZE}" data-auto-logo="${glyphName}">` +
    renderShape(plate) +
    renderShape(innerFrame) +
    rays.map(renderShape).join("") +
    renderShape(disc) +
    `<g transform="${escapeAttr(glyphTransform)}">${glyphShapes.map(renderShape).join("")}</g>` +
    `</svg>`
  );
}
