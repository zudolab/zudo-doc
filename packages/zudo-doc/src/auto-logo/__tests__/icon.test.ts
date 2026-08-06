import { describe, it, expect } from "vitest";
import { renderAutoLogoIconSvg, ICON_BG, ICON_INK } from "../icon.js";
import { GLYPH_SHAPES, pickGlyphName, type ShapePrimitive } from "../shapes.js";
import { SQUARE_SIZE, SQUARE_DISC_R, SQUARE_PLATE_SHAPES } from "../shapes-square.js";

// Renderer-level checks for the direct-paint square icon (#3286). Unlike the
// standalone luminance-mask builder, this output is directly painted artwork
// for the app icon: fully opaque, exactly the two concrete palette hexes,
// zero CSS tokens, no <mask>.

const CENTER = SQUARE_SIZE / 2;

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function glyphGroupOf(svg: string): string {
  const group = /<g transform="[^"]*">([\s\S]*)<\/g>/.exec(svg)?.[1];
  expect(group, "icon SVG should contain the transformed glyph group").toBeTruthy();
  return group!;
}

describe("renderAutoLogoIconSvg", () => {
  it("is deterministic — same seed produces byte-identical output", () => {
    const a = renderAutoLogoIconSvg("zudo-doc");
    const b = renderAutoLogoIconSvg("zudo-doc");
    expect(a).toBe(b);
  });

  it("emits xmlns and a square viewBox", () => {
    const svg = renderAutoLogoIconSvg("zudo-doc");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain(`viewBox="0 0 ${SQUARE_SIZE} ${SQUARE_SIZE}"`);
  });

  it("is direct paint — no mask, no CSS tokens, no transparency", () => {
    const svg = renderAutoLogoIconSvg("zudo-doc");
    expect(svg).not.toContain("<mask");
    expect(svg).not.toContain("var(");
    expect(svg).not.toContain("currentColor");
    expect(svg).not.toContain("opacity");
  });

  it("paints every fill/stroke with one of the two concrete palette hexes (or none)", () => {
    const svg = renderAutoLogoIconSvg("zudo-doc");
    const values = [...svg.matchAll(/(?:fill|stroke)="([^"]*)"/g)].map((m) => m[1]!);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect([ICON_BG, ICON_INK, "none"], `paint value ${value}`).toContain(value);
    }
    // both palette colors are actually used — opaque bg plate + ink artwork
    expect(values).toContain(ICON_BG);
    expect(values).toContain(ICON_INK);
  });

  it("starts with a full-bleed opaque bg plate so the icon has no transparent interior", () => {
    const svg = renderAutoLogoIconSvg("zudo-doc");
    expect(svg).toMatch(
      new RegExp(
        `^<svg[^>]*><rect x="0" y="0" width="${SQUARE_SIZE}" height="${SQUARE_SIZE}" fill="${escapeRe(ICON_BG)}" />`,
      ),
    );
  });

  it("draws the square recomposition: inset frame, 4 rays, disc centered at S/2", () => {
    const svg = renderAutoLogoIconSvg("zudo-doc");
    // inset frame rect — ink stroke, unfilled
    expect(svg).toMatch(
      new RegExp(`<rect[^>]*width="${SQUARE_SIZE - 12}"[^>]*fill="none"[^>]*stroke="${escapeRe(ICON_INK)}"`),
    );
    // all 4 corner rays — ink strokes
    expect(svg.match(new RegExp(`<line[^>]*stroke="${escapeRe(ICON_INK)}"[^>]*stroke-width="1.4"`, "g"))).toHaveLength(
      4,
    );
    // centered disc — ink fill
    expect(svg).toMatch(
      new RegExp(`<circle cx="${CENTER}" cy="${CENTER}" r="${SQUARE_DISC_R}" fill="${escapeRe(ICON_INK)}"`),
    );
  });

  it("tag counts match the square shape data exactly (per element type)", () => {
    const seed = "zudo-doc";
    const glyphShapes = GLYPH_SHAPES[pickGlyphName(seed)]!;
    const allShapes: ShapePrimitive[] = [
      SQUARE_PLATE_SHAPES.plate,
      SQUARE_PLATE_SHAPES.innerFrame,
      ...SQUARE_PLATE_SHAPES.rays,
      SQUARE_PLATE_SHAPES.disc,
      ...glyphShapes,
    ];
    const svg = renderAutoLogoIconSvg(seed);
    for (const el of ["path", "line", "circle", "rect"] as const) {
      const expected = allShapes.filter((s) => s.el === el).length;
      expect(svg.match(new RegExp(`<${el}[ />]`, "g"))?.length ?? 0, `<${el}> count`).toBe(expected);
    }
  });

  it("knocks the glyph out of the disc in the plate color, for every one of the 8 glyphs", () => {
    // one seed per distinct glyph, so all 8 glyph shape sets are exercised
    const seen = new Map<string, string>();
    for (let i = 0; i < 200 && seen.size < 8; i++) {
      const seed = `seed-${i}`;
      const glyph = pickGlyphName(seed);
      if (!seen.has(glyph)) seen.set(glyph, seed);
    }
    expect(seen.size, "probe pool should cover all 8 glyphs").toBe(8);

    for (const [glyph, seed] of seen) {
      const svg = renderAutoLogoIconSvg(seed);
      expect(svg, `${glyph}: data attr`).toContain(`data-auto-logo="${glyph}"`);
      const group = glyphGroupOf(svg);
      expect(group, `${glyph}: glyph painted in the plate color`).toContain(ICON_BG);
      expect(group, `${glyph}: no ink inside the glyph group`).not.toContain(ICON_INK);
      expect(svg, `${glyph}: disc stays ink`).toMatch(
        new RegExp(`<circle[^>]*r="${SQUARE_DISC_R}"[^>]*fill="${escapeRe(ICON_INK)}"`),
      );
    }
  });

  it('reuses pickGlyphName so the icon glyph matches logo: "auto" mode and the ejected logo', () => {
    for (const seed of ["zudo-doc", "acme-docs", "hyperfab", "notes-garden"]) {
      expect(renderAutoLogoIconSvg(seed)).toContain(`data-auto-logo="${pickGlyphName(seed)}"`);
    }
    // the committed Tauri icon's seed (epic #3285): zudo-doc -> bookmark
    expect(pickGlyphName("zudo-doc")).toBe("bookmark");
  });

  it("different seeds selecting different glyphs produce different output", () => {
    const names = ["zudo-doc", "acme-docs", "hyperfab", "notes-garden", "quickref", "moon-kit"];
    const bySeed = new Map(names.map((n) => [n, pickGlyphName(n)]));
    const [seedA, glyphA] = [...bySeed.entries()][0]!;
    const other = [...bySeed.entries()].find(([, g]) => g !== glyphA);
    expect(other, "fixture seed pool should span more than one glyph").toBeDefined();
    const [seedB] = other!;
    expect(renderAutoLogoIconSvg(seedA)).not.toBe(renderAutoLogoIconSvg(seedB));
  });
});
