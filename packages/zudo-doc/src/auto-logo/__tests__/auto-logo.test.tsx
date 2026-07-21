/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { describe, it, expect } from "vitest";
import { render } from "preact-render-to-string";
import { AutoLogo, pickGlyphName } from "../index.js";

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
    expect(html).toContain('fill="currentColor"');
    // knockouts resolve through the page-bg token, never a hardcoded color
    expect(html).toContain("var(--color-bg)");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    // 4 corner rays
    expect(html.match(/<line[^>]*stroke-width="1.4"/g)).toHaveLength(4);
    // disc
    expect(html).toContain(`r="34"`);
    // decorative: hidden from AT
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(`data-auto-logo="${pickGlyphName("zudo-doc")}"`);
  });

  it("passes the class prop through to the root svg", () => {
    const html = render(<AutoLogo seed="x" class="w-[320px] text-fg" />);
    expect(html).toContain('class="w-[320px] text-fg"');
  });
});
