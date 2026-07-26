/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { describe, it, expect } from "vitest";
import { render } from "preact-render-to-string";
import { AutoLogo, pickGlyphName } from "../index.js";
import {
  GLYPH_NAMES,
  GLYPH_SHAPES,
  PLATE_SHAPE,
  INNER_FRAME_SHAPE,
  RAY_SHAPES,
  DISC_SHAPE,
} from "../shapes.js";

// The two color-role tokens of the shapes.ts color contract (#3108):
// ink paints the frame, rays, and disc; knockout paints the plate and glyph.
const INK = "currentColor";
const KO = "var(--color-bg)";

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("AutoLogo", () => {
  it("is deterministic — same seed renders identical markup", () => {
    const a = render(<AutoLogo seed="zudo-doc" />);
    const b = render(<AutoLogo seed="zudo-doc" />);
    expect(a).toBe(b);
  });

  it("different seeds can produce different glyphs (sanity over a name pool)", () => {
    const names = ["zudo-doc", "acme-docs", "hyperfab", "notes-garden", "quickref", "moon-kit"];
    const glyphs = new Set(names.map((n) => pickGlyphName(n)));
    expect(glyphs.size).toBeGreaterThan(1);
  });

  it("renders the decorated-plate structure: plate, frame, 4 corner rays, disc, glyph", () => {
    const html = render(<AutoLogo seed="zudo-doc" />);
    expect(html).toContain('viewBox="0 0 200 105"');
    // both color roles resolve through theme tokens, never a hardcoded color
    expect(html).toContain(INK);
    expect(html).toContain(KO);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    // 4 corner rays
    expect(html.match(/<line[^>]*stroke-width="1.4"/g)).toHaveLength(4);
    // disc
    expect(html).toContain(`r="34"`);
    // decorative: hidden from AT
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(`data-auto-logo="${pickGlyphName("zudo-doc")}"`);
  });

  // Serialization-level counterpart to the data-level role assertions below —
  // proves the attrs actually reach the rendered markup.
  it("paints the plate with the knockout token and the frame/rays/disc with ink", () => {
    const html = render(<AutoLogo seed="zudo-doc" />);

    // full-bleed plate rect (200×105) — page background, NOT ink
    expect(html).toMatch(new RegExp(`<rect[^>]*width="200"[^>]*height="105"[^>]*fill="${escapeRe(KO)}"`));
    // inset frame rect (188×93) — ink stroke, no fill
    expect(html).toMatch(new RegExp(`<rect[^>]*width="188"[^>]*fill="none"[^>]*stroke="${escapeRe(INK)}"`));
    // all 4 corner rays — ink stroke
    expect(html.match(new RegExp(`<line[^>]*stroke="${escapeRe(INK)}"[^>]*stroke-width="1.4"`, "g"))).toHaveLength(4);
    // centered disc — ink fill
    expect(html).toMatch(new RegExp(`<circle[^>]*r="34"[^>]*fill="${escapeRe(INK)}"`));
  });

  it("knocks the seeded glyph out of the ink disc (no ink inside the glyph group)", () => {
    const html = render(<AutoLogo seed="zudo-doc" />);
    const glyphGroup = /<g transform="[^"]*">([\s\S]*)<\/g>/.exec(html)?.[1];
    expect(glyphGroup, "glyph <g> should be present in the rendered output").toBeTruthy();
    expect(glyphGroup).toContain(KO);
    // `var(--color-bg)` does not contain the substring "currentColor", so this
    // is a real assertion that no glyph primitive is painted in ink.
    expect(glyphGroup).not.toContain(INK);
  });

  it("passes the class prop through to the root svg", () => {
    const html = render(<AutoLogo seed="x" class="w-[320px] text-fg" />);
    expect(html).toContain('class="w-[320px] text-fg"');
  });
});

describe("shapes.ts color contract", () => {
  it("plate is the knockout; frame, rays, and disc are ink", () => {
    expect(PLATE_SHAPE.attrs["fill"]).toBe(KO);
    expect(INNER_FRAME_SHAPE.attrs["fill"]).toBe("none");
    expect(INNER_FRAME_SHAPE.attrs["stroke"]).toBe(INK);
    expect(RAY_SHAPES).toHaveLength(4);
    for (const [i, ray] of RAY_SHAPES.entries()) {
      expect(ray.attrs["stroke"], `RAY_SHAPES[${i}].stroke`).toBe(INK);
    }
    expect(DISC_SHAPE.attrs["fill"]).toBe(INK);
  });

  // A single seeded render only exercises one glyph — assert the color roles
  // at the data level so all 8 are covered.
  it("declares exactly the 8 known glyphs", () => {
    expect(GLYPH_NAMES).toHaveLength(8);
    expect(new Set(GLYPH_NAMES)).toEqual(
      new Set(["book", "doc", "bookmark", "compass", "terminal", "bulb", "chat", "layers"]),
    );
  });

  it.each(GLYPH_NAMES)("%s glyph: every painted fill/stroke is the knockout token", (name) => {
    const shapes = GLYPH_SHAPES[name]!;
    expect(shapes.length).toBeGreaterThan(0);

    let painted = 0;
    for (const [i, shape] of shapes.entries()) {
      for (const attr of ["fill", "stroke"] as const) {
        const value = shape.attrs[attr];
        if (value === undefined || value === "none") continue;
        expect(value, `${name}[${i}].${attr}`).toBe(KO);
        painted++;
      }
    }
    // guards against a glyph whose primitives carry no color attrs at all,
    // which would make the loop above pass vacuously
    expect(painted, `${name} should paint at least one fill/stroke`).toBeGreaterThan(0);
  });
});
