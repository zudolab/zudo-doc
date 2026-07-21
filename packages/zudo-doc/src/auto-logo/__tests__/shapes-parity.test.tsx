/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { describe, it, expect } from "vitest";
import { render } from "preact-render-to-string";
import { AutoLogo } from "../index.js";
import { renderAutoLogoStandaloneSvg } from "../standalone.js";
import {
  PLATE_SHAPE,
  INNER_FRAME_SHAPE,
  RAY_SHAPES,
  DISC_SHAPE,
  GLYPH_SHAPES,
  pickGlyphName,
  type ShapePrimitive,
} from "../shapes.js";

// Geometry-parity: prove `AutoLogo` (JSX) and `renderAutoLogoStandaloneSvg`
// (string builder) both draw exactly the primitives declared in shapes.ts —
// by importing the shared module and counting element types against each
// renderer's output, not by diffing the two renderers' output against each
// other (that would only prove they match one another, not that either
// actually reflects the shared data).

const EL_TYPES = ["path", "line", "circle", "rect"] as const;

function countTags(html: string, el: (typeof EL_TYPES)[number]): number {
  const re = new RegExp(`<${el}[ />]`, "g");
  return html.match(re)?.length ?? 0;
}

function countByEl(shapes: ShapePrimitive[], el: (typeof EL_TYPES)[number]): number {
  return shapes.filter((s) => s.el === el).length;
}

describe("AutoLogo and renderAutoLogoStandaloneSvg consume the same shapes.ts data", () => {
  const seed = "zudo-doc";
  const glyphName = pickGlyphName(seed);
  const glyphShapes = GLYPH_SHAPES[glyphName]!;
  const plateShapes: ShapePrimitive[] = [PLATE_SHAPE, INNER_FRAME_SHAPE, ...RAY_SHAPES, DISC_SHAPE];
  const allShapes = [...plateShapes, ...glyphShapes];

  it("AutoLogo's rendered tag counts match the imported shapes exactly (per element type)", () => {
    const html = render(<AutoLogo seed={seed} />);
    for (const el of EL_TYPES) {
      expect(countTags(html, el), `<${el}> count`).toBe(countByEl(allShapes, el));
    }
  });

  it("renderAutoLogoStandaloneSvg's tag counts match the imported shapes exactly (+1 rect for the masked visible layer)", () => {
    const svg = renderAutoLogoStandaloneSvg(seed);
    for (const el of EL_TYPES) {
      const extra = el === "rect" ? 1 : 0; // the single solid rect the mask is applied to
      expect(countTags(svg, el), `<${el}> count`).toBe(countByEl(allShapes, el) + extra);
    }
  });

  it("RAY_SHAPES always has exactly 4 corner rays (both renderers depend on this)", () => {
    expect(RAY_SHAPES).toHaveLength(4);
  });
});
