import { describe, it, expect } from "vitest";
import { SQUARE_SIZE, SQUARE_DISC_R, SQUARE_PLATE_SHAPES } from "../shapes-square.js";
import { H, INSET, W, DISC_R } from "../shapes.js";

// Data-level checks for the square recomposition (#3286) — the square plate
// must be the same visual system as the rect logo, rebuilt for W=H from the
// shared builder, with the shapes.ts two-token color contract intact.

const INK = "currentColor";
const KO = "var(--color-bg)";

const CENTER = SQUARE_SIZE / 2;

describe("SQUARE_PLATE_SHAPES geometry", () => {
  it("plate is a full-bleed square", () => {
    expect(SQUARE_PLATE_SHAPES.plate.el).toBe("rect");
    expect(SQUARE_PLATE_SHAPES.plate.attrs).toMatchObject({
      x: 0,
      y: 0,
      width: SQUARE_SIZE,
      height: SQUARE_SIZE,
    });
  });

  it("inner frame is inset by the rect logo's INSET with the same stroke width", () => {
    expect(SQUARE_PLATE_SHAPES.innerFrame.attrs).toMatchObject({
      x: INSET,
      y: INSET,
      width: SQUARE_SIZE - INSET * 2,
      height: SQUARE_SIZE - INSET * 2,
      "stroke-width": 1.6,
    });
  });

  it("has exactly 4 corner rays, starting at the 4 inset corners", () => {
    expect(SQUARE_PLATE_SHAPES.rays).toHaveLength(4);
    const starts = SQUARE_PLATE_SHAPES.rays.map((ray) => [ray.attrs["x1"], ray.attrs["y1"]]);
    const far = SQUARE_SIZE - INSET;
    expect(starts).toEqual([
      [INSET, INSET],
      [far, INSET],
      [INSET, far],
      [far, far],
    ]);
  });

  it("every ray stops 7 units short of the disc edge", () => {
    for (const [i, ray] of SQUARE_PLATE_SHAPES.rays.entries()) {
      const dx = Number(ray.attrs["x2"]) - CENTER;
      const dy = Number(ray.attrs["y2"]) - CENTER;
      expect(Math.hypot(dx, dy), `ray[${i}] endpoint distance from center`).toBeCloseTo(SQUARE_DISC_R + 7, 9);
    }
  });

  it("disc is centered at S/2 with the square radius", () => {
    expect(SQUARE_PLATE_SHAPES.disc.el).toBe("circle");
    expect(SQUARE_PLATE_SHAPES.disc.attrs).toMatchObject({
      cx: CENTER,
      cy: CENTER,
      r: SQUARE_DISC_R,
    });
  });

  it("glyph transform centers the scaled 100×100 glyph box on the disc", () => {
    const match = /^translate\(([-\d.]+), ([-\d.]+)\) scale\(([-\d.]+)\)$/.exec(SQUARE_PLATE_SHAPES.glyphTransform);
    expect(match, "glyphTransform should be a translate+scale pair").not.toBeNull();
    const [, tx, ty, scale] = match!;
    expect(Number(scale)).toBeCloseTo(SQUARE_PLATE_SHAPES.glyphScale, 9);
    expect(Number(tx)).toBeCloseTo(CENTER - 50 * SQUARE_PLATE_SHAPES.glyphScale, 9);
    expect(Number(ty)).toBeCloseTo(CENTER - 50 * SQUARE_PLATE_SHAPES.glyphScale, 9);
  });

  it("preserves the rect logo's disc/short-side ratio ≈ 0.65 (pinned by #3286)", () => {
    const rectRatio = (DISC_R * 2) / Math.min(W, H); // 68/105
    const squareRatio = (SQUARE_DISC_R * 2) / SQUARE_SIZE;
    expect(squareRatio).toBeCloseTo(rectRatio, 1);
    expect(squareRatio).toBe(0.65);
  });
});

describe("square composition color contract", () => {
  it("plate is the knockout; frame, rays, and disc are ink — same roles as the rect logo", () => {
    expect(SQUARE_PLATE_SHAPES.plate.attrs["fill"]).toBe(KO);
    expect(SQUARE_PLATE_SHAPES.innerFrame.attrs["fill"]).toBe("none");
    expect(SQUARE_PLATE_SHAPES.innerFrame.attrs["stroke"]).toBe(INK);
    for (const [i, ray] of SQUARE_PLATE_SHAPES.rays.entries()) {
      expect(ray.attrs["stroke"], `rays[${i}].stroke`).toBe(INK);
    }
    expect(SQUARE_PLATE_SHAPES.disc.attrs["fill"]).toBe(INK);
  });

  it("no shape carries a color value outside the two-token contract", () => {
    const shapes = [
      SQUARE_PLATE_SHAPES.plate,
      SQUARE_PLATE_SHAPES.innerFrame,
      ...SQUARE_PLATE_SHAPES.rays,
      SQUARE_PLATE_SHAPES.disc,
    ];
    for (const shape of shapes) {
      for (const attr of ["fill", "stroke"] as const) {
        const value = shape.attrs[attr];
        if (value === undefined || value === "none") continue;
        expect([INK, KO], `${shape.el}.${attr} = ${String(value)}`).toContain(value);
      }
    }
  });
});
