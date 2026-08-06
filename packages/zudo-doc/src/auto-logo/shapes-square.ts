// auto-logo/shapes-square.ts — square recomposition of the decorated-plate
// design for the app-icon renderer (icon.ts; epic #3285, sub #3286). Same
// visual system as the 200×105 rect logo — plate, inset frame, 4 corner
// rays, center disc with the seeded glyph knocked out — rebuilt for W=H
// entirely from shapes.ts's `buildPlateShapes()` builder: no hand-drawn
// geometry, and the shapes.ts color contract (exactly two color tokens)
// carries through untouched.
//
// Proportions (pinned by #3286): the disc preserves the rect logo's
// disc/short-side ratio ≈ 0.65 (68/105 → at S=200 that is discR 65), and the
// frame keeps the rect logo's INSET=6.

import { INSET, buildPlateShapes, type PlateShapes } from "./shapes.js";

/** Square plate side length (viewBox units). */
export const SQUARE_SIZE = 200;

/** Disc radius — preserves the rect logo's disc/short-side ratio ≈ 0.65. */
export const SQUARE_DISC_R = 65;

/** The square plate composition, built from the shared builder. */
export const SQUARE_PLATE_SHAPES: PlateShapes = buildPlateShapes({
  w: SQUARE_SIZE,
  h: SQUARE_SIZE,
  inset: INSET,
  discR: SQUARE_DISC_R,
});
