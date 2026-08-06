// auto-logo/shapes.ts — shared glyph + plate shape data for the AutoLogo
// Preact component (index.tsx) and the dependency-free standalone SVG
// string builders (standalone.ts, and the square icon path via
// shapes-square.ts + icon.ts). Plain data only — no JSX, no preact — so
// every consumer renders the exact same geometry from a single source and
// cannot drift (issue #3048).
//
// Color contract: colors are carried as the same two string tokens the JSX
// component always used — "currentColor" for ink (frame, rays, disc) and
// "var(--color-bg)" for knockouts (plate + glyph). The tile interior is the
// page background, over which ink paints the thin frame, the 4 corner rays,
// and the center disc; the glyph is then knocked back out of that disc
// (issue #3108 — matches the takazudomodular model). `AutoLogo` spreads
// these attrs verbatim (they resolve correctly in a live, styled SVG);
// `standalone.ts` substitutes both tokens with concrete luminance-mask
// colors and `icon.ts` with concrete paint hexes when serializing (no
// `var(`/`currentColor` can reach an ejected or icon file, since only these
// two tokens are ever used as color values here).

/** One SVG primitive as plain data: element name + its attributes. */
export interface ShapePrimitive {
  el: "path" | "line" | "circle" | "rect";
  attrs: Record<string, string | number>;
}

// Plate geometry (viewBox units). 200:105 matches the hero slot's
// 1200:630 aspect so the plate fills the logo area edge-to-edge.
export const W = 200;
export const H = 105;
export const INSET = 6;
export const CX = W / 2;
export const CY = H / 2;
export const DISC_R = 34;

/** Ink color token — the element's own color (see the color contract above). */
const INK = "currentColor";

/** Knockout color token — page background (see the color contract above). */
const KO = "var(--color-bg)";

/** Inputs for {@link buildPlateShapes}. */
export interface PlateParams {
  w: number;
  h: number;
  inset: number;
  discR: number;
}

/** One plate composition (everything except the glyph shape data) as built
 *  by {@link buildPlateShapes}. */
export interface PlateShapes {
  /** Full-bleed plate rect, filled with the page background so the tile
   *  interior reads as the page itself (opaque, not `fill: "none"`, so it
   *  also covers a textured page background). */
  plate: ShapePrimitive;
  /** Thin inner frame stroke, drawn in ink over the plate. */
  innerFrame: ShapePrimitive;
  /** 4 diagonal corner rays in ink, each stopping just short of the disc. */
  rays: ShapePrimitive[];
  /** Centered ink disc — the glyph is knocked back out of it. */
  disc: ShapePrimitive;
  /** Scale that fits a glyph's 100×100 box onto the disc
   *  (slight overscan reads better). */
  glyphScale: number;
  /** Transform that centers the scaled glyph box on the disc. */
  glyphTransform: string;
}

/**
 * Build the "decorated plate" composition — plate, inset frame, 4 corner
 * rays, center disc, glyph transform — for any plate size. The 200×105 rect
 * logo constants below and the square icon recomposition
 * (`shapes-square.ts`, epic #3285) are both built from this one function so
 * their geometry cannot drift.
 */
export function buildPlateShapes({ w, h, inset, discR }: PlateParams): PlateShapes {
  const cx = w / 2;
  const cy = h / 2;

  const plate: ShapePrimitive = {
    el: "rect",
    attrs: { x: 0, y: 0, width: w, height: h, fill: KO },
  };

  const innerFrame: ShapePrimitive = {
    el: "rect",
    attrs: {
      x: inset,
      y: inset,
      width: w - inset * 2,
      height: h - inset * 2,
      fill: "none",
      stroke: INK,
      "stroke-width": 1.6,
    },
  };

  const rays: ShapePrimitive[] = (
    [
      [inset, inset],
      [w - inset, inset],
      [inset, h - inset],
      [w - inset, h - inset],
    ] as Array<[number, number]>
  ).map(([x, y]) => {
    const dx = cx - x;
    const dy = cy - y;
    const len = Math.hypot(dx, dy);
    const stop = (len - discR - 7) / len;
    return {
      el: "line",
      attrs: { x1: x, y1: y, x2: x + dx * stop, y2: y + dy * stop, stroke: INK, "stroke-width": 1.4 },
    } satisfies ShapePrimitive;
  });

  const disc: ShapePrimitive = {
    el: "circle",
    attrs: { cx, cy, r: discR, fill: INK },
  };

  const glyphScale = ((discR * 2) / 100) * 1.05;
  const glyphTransform = `translate(${cx - 50 * glyphScale}, ${cy - 50 * glyphScale}) scale(${glyphScale})`;

  return { plate, innerFrame, rays, disc, glyphScale, glyphTransform };
}

const RECT_PLATE_SHAPES = buildPlateShapes({ w: W, h: H, inset: INSET, discR: DISC_R });

export const PLATE_SHAPE: ShapePrimitive = RECT_PLATE_SHAPES.plate;
export const INNER_FRAME_SHAPE: ShapePrimitive = RECT_PLATE_SHAPES.innerFrame;
export const RAY_SHAPES: ShapePrimitive[] = RECT_PLATE_SHAPES.rays;
export const DISC_SHAPE: ShapePrimitive = RECT_PLATE_SHAPES.disc;
export const GLYPH_SCALE = RECT_PLATE_SHAPES.glyphScale;
export const GLYPH_TRANSFORM = RECT_PLATE_SHAPES.glyphTransform;

/** Line-art glyphs drawn in a 100×100 box centered at (50,50), as plain
 *  shape data. Every painted `fill`/`stroke` here is the knockout token, so
 *  the glyph reads as a hole punched through the ink disc it sits on.
 *  The original JSX wrapped each glyph (and some repeated groups) in a `<g>`
 *  that carried no attributes of its own — only React `key`s for list
 *  rendering — so flattening into a single primitive array per glyph loses
 *  no visual information. */
export const GLYPH_SHAPES: Record<string, ShapePrimitive[]> = {
  book: [
    {
      el: "path",
      attrs: {
        d: "M50 30 C42 24, 30 23, 22 26 L22 68 C30 65, 42 66, 50 72 C58 66, 70 65, 78 68 L78 26 C70 23, 58 24, 50 30 Z",
        fill: "none",
        stroke: KO,
        "stroke-width": 6,
        "stroke-linejoin": "round",
      },
    },
    { el: "line", attrs: { x1: 50, y1: 30, x2: 50, y2: 72, stroke: KO, "stroke-width": 5 } },
    ...[0, 1, 2].flatMap(
      (i): ShapePrimitive[] => [
        {
          el: "line",
          attrs: {
            x1: 29,
            y1: 38 + i * 10,
            x2: 43,
            y2: 40 + i * 10,
            stroke: KO,
            "stroke-width": 4,
            "stroke-linecap": "round",
          },
        },
        {
          el: "line",
          attrs: {
            x1: 57,
            y1: 40 + i * 10,
            x2: 71,
            y2: 38 + i * 10,
            stroke: KO,
            "stroke-width": 4,
            "stroke-linecap": "round",
          },
        },
      ],
    ),
  ],
  doc: [
    {
      el: "path",
      attrs: { d: "M32 22 L60 22 L70 32 L70 78 L32 78 Z", fill: "none", stroke: KO, "stroke-width": 6, "stroke-linejoin": "round" },
    },
    {
      el: "path",
      attrs: { d: "M60 22 L60 32 L70 32", fill: "none", stroke: KO, "stroke-width": 5, "stroke-linejoin": "round" },
    },
    ...[0, 1, 2].map(
      (i): ShapePrimitive => ({
        el: "line",
        attrs: { x1: 40, y1: 44 + i * 11, x2: 62, y2: 44 + i * 11, stroke: KO, "stroke-width": 4, "stroke-linecap": "round" },
      }),
    ),
  ],
  bookmark: [
    {
      el: "path",
      attrs: { d: "M34 22 L66 22 L66 78 L50 64 L34 78 Z", fill: "none", stroke: KO, "stroke-width": 6, "stroke-linejoin": "round" },
    },
    { el: "line", attrs: { x1: 42, y1: 36, x2: 58, y2: 36, stroke: KO, "stroke-width": 4, "stroke-linecap": "round" } },
  ],
  compass: [
    { el: "circle", attrs: { cx: 50, cy: 50, r: 26, fill: "none", stroke: KO, "stroke-width": 6 } },
    { el: "path", attrs: { d: "M60 40 L54 56 L40 60 L46 44 Z", fill: KO } },
  ],
  terminal: [
    { el: "rect", attrs: { x: 24, y: 30, width: 52, height: 40, rx: 5, fill: "none", stroke: KO, "stroke-width": 6 } },
    {
      el: "path",
      attrs: { d: "M33 42 L41 50 L33 58", fill: "none", stroke: KO, "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round" },
    },
    { el: "line", attrs: { x1: 47, y1: 58, x2: 60, y2: 58, stroke: KO, "stroke-width": 5, "stroke-linecap": "round" } },
  ],
  bulb: [
    {
      el: "path",
      attrs: {
        d: "M50 22 C37 22, 30 32, 30 41 C30 49, 35 53, 39 58 L39 64 L61 64 L61 58 C65 53, 70 49, 70 41 C70 32, 63 22, 50 22 Z",
        fill: "none",
        stroke: KO,
        "stroke-width": 6,
        "stroke-linejoin": "round",
      },
    },
    { el: "line", attrs: { x1: 42, y1: 71, x2: 58, y2: 71, stroke: KO, "stroke-width": 5, "stroke-linecap": "round" } },
    { el: "line", attrs: { x1: 45, y1: 78, x2: 55, y2: 78, stroke: KO, "stroke-width": 5, "stroke-linecap": "round" } },
  ],
  chat: [
    {
      el: "path",
      attrs: { d: "M26 28 L74 28 L74 62 L48 62 L36 74 L36 62 L26 62 Z", fill: "none", stroke: KO, "stroke-width": 6, "stroke-linejoin": "round" },
    },
    ...[0, 1, 2].map((i): ShapePrimitive => ({ el: "circle", attrs: { cx: 38 + i * 12, cy: 45, r: 3, fill: KO } })),
  ],
  layers: [
    { el: "path", attrs: { d: "M50 22 L78 36 L50 50 L22 36 Z", fill: "none", stroke: KO, "stroke-width": 6, "stroke-linejoin": "round" } },
    {
      el: "path",
      attrs: { d: "M25 47 L50 60 L75 47", fill: "none", stroke: KO, "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round" },
    },
    {
      el: "path",
      attrs: { d: "M25 58 L50 71 L75 58", fill: "none", stroke: KO, "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round" },
    },
  ],
};

export const GLYPH_NAMES = Object.keys(GLYPH_SHAPES);

/** FNV-1a 32-bit hash — the deterministic seed source. */
function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic glyph name for a seed. */
export function pickGlyphName(seed: string): string {
  return GLYPH_NAMES[hashString(seed) % GLYPH_NAMES.length]!;
}
