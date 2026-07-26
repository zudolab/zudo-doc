import { describe, it, expect } from "vitest";
import { renderAutoLogoStandaloneSvg } from "../standalone.js";
import { pickGlyphName } from "../shapes.js";

// Luminance-mask colors the two shapes.ts tokens are substituted with:
// ink (currentColor) -> white (visible), knockout (var(--color-bg)) -> black.
const VISIBLE = "#fff";
const CUT = "#000";

/** The `<mask …>…</mask>` inner content — the final output rect sits OUTSIDE
 *  it and is also `fill="#000"`, so whole-document assertions on the mask
 *  colors would be ambiguous. */
function maskContentOf(svg: string): string {
  const match = /<mask\b[^>]*>([\s\S]*)<\/mask>/.exec(svg);
  expect(match, "standalone SVG should contain a <mask> element").not.toBeNull();
  return match![1]!;
}

describe("renderAutoLogoStandaloneSvg", () => {
  it("is deterministic — same seed produces byte-identical output", () => {
    const a = renderAutoLogoStandaloneSvg("zudo-doc");
    const b = renderAutoLogoStandaloneSvg("zudo-doc");
    expect(a).toBe(b);
  });

  it("emits xmlns and a well-formed luminance mask", () => {
    const svg = renderAutoLogoStandaloneSvg("zudo-doc");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 200 105"');
    expect(svg).toMatch(
      /<mask[^>]*mask-type="luminance"[^>]*maskUnits="userSpaceOnUse"[^>]*maskContentUnits="userSpaceOnUse"[^>]*x="0"[^>]*y="0"[^>]*width="200"[^>]*height="105"/,
    );
  });

  it("carries the design entirely as alpha — no var(...) or currentColor anywhere", () => {
    const svg = renderAutoLogoStandaloneSvg("zudo-doc");
    expect(svg).not.toContain("var(");
    expect(svg).not.toContain("currentColor");
  });

  // #3108 role swap: the plate is cut away, the frame/rays/disc are visible,
  // and the glyph is punched back out of the disc. Scoped to the mask content
  // because the final output rect (outside the mask) is also fill="#000".
  it("maps the swapped color roles into the mask: plate cut, frame/rays/disc visible, glyph cut", () => {
    const mask = maskContentOf(renderAutoLogoStandaloneSvg("zudo-doc"));

    // full-bleed plate rect (200×105) — cut away (a no-op over the black default)
    expect(mask).toMatch(new RegExp(`<rect[^>]*width="200"[^>]*height="105"[^>]*fill="${CUT}"`));
    // inset frame rect (188 wide) — visible stroke, unfilled
    expect(mask).toMatch(new RegExp(`<rect[^>]*width="188"[^>]*fill="none"[^>]*stroke="${VISIBLE}"`));
    // all 4 corner rays — visible strokes
    expect(mask.match(new RegExp(`<line[^>]*stroke="${VISIBLE}"[^>]*stroke-width="1.4"`, "g"))).toHaveLength(4);
    // centered disc — visible fill
    expect(mask).toMatch(new RegExp(`<circle[^>]*r="34"[^>]*fill="${VISIBLE}"`));
  });

  it("punches the glyph out of the disc — no visible paint inside the glyph group", () => {
    const mask = maskContentOf(renderAutoLogoStandaloneSvg("zudo-doc"));
    const glyphGroup = /<g transform="[^"]*">([\s\S]*)<\/g>/.exec(mask)?.[1];
    expect(glyphGroup, "mask content should contain the transformed glyph group").toBeTruthy();
    expect(glyphGroup).toContain(CUT);
    expect(glyphGroup).not.toContain(VISIBLE);
  });

  it("applies the swapped roles for every glyph, not just the default seed", () => {
    // one seed per distinct glyph, so all 8 glyph shape sets are exercised
    const seen = new Map<string, string>();
    for (let i = 0; i < 200 && seen.size < 8; i++) {
      const seed = `seed-${i}`;
      const glyph = pickGlyphName(seed);
      if (!seen.has(glyph)) seen.set(glyph, seed);
    }
    expect(seen.size, "probe pool should cover all 8 glyphs").toBe(8);

    for (const [glyph, seed] of seen) {
      const mask = maskContentOf(renderAutoLogoStandaloneSvg(seed));
      const glyphGroup = /<g transform="[^"]*">([\s\S]*)<\/g>/.exec(mask)?.[1];
      expect(glyphGroup, `${glyph} glyph group`).toBeTruthy();
      expect(glyphGroup, `${glyph} glyph should be cut out, not visible`).not.toContain(VISIBLE);
      expect(mask, `${glyph}: disc stays visible`).toMatch(new RegExp(`<circle[^>]*r="34"[^>]*fill="${VISIBLE}"`));
    }
  });

  it("reuses pickGlyphName so the ejected glyph matches logo: \"auto\" mode", () => {
    for (const seed of ["zudo-doc", "acme-docs", "hyperfab", "notes-garden"]) {
      const svg = renderAutoLogoStandaloneSvg(seed);
      expect(svg).toContain(`data-auto-logo="${pickGlyphName(seed)}"`);
    }
  });

  it("different seeds selecting different glyphs produce different output", () => {
    const names = ["zudo-doc", "acme-docs", "hyperfab", "notes-garden", "quickref", "moon-kit"];
    const bySeed = new Map(names.map((n) => [n, pickGlyphName(n)]));
    const [seedA, glyphA] = [...bySeed.entries()][0]!;
    const other = [...bySeed.entries()].find(([, g]) => g !== glyphA);
    expect(other, "fixture seed pool should span more than one glyph").toBeDefined();
    const [seedB] = other!;
    expect(renderAutoLogoStandaloneSvg(seedA)).not.toBe(renderAutoLogoStandaloneSvg(seedB));
  });
});
