import { describe, it, expect } from "vitest";
import { renderAutoLogoStandaloneSvg } from "../standalone.js";
import { pickGlyphName } from "../shapes.js";

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
