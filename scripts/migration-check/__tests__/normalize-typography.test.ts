/**
 * normalize-typography.test.ts
 *
 * Tests for the quote / apostrophe canonicalization step that converges
 * zfb's MDX output (literal &quot; entity, U+0027 straight apostrophe) with
 * Astro's smartypants output (U+201C / U+201D / U+2018 / U+2019 Unicode
 * glyphs). Both sides should collapse to the same straight-ASCII form so
 * migration-check signal extraction does not flag them as content drift.
 *
 * The transform must be idempotent so the harness can apply it more than
 * once without changing the result.
 */

import { describe, expect, it } from "vitest";
import {
  applyTypographyNormalizationToTextNodes,
  normalizeTypography,
} from "../lib/normalize-typography.mjs";
import { normalizeHtml } from "../lib/normalize-html.mjs";

// ── Plain string normalization ────────────────────────────────────────────────

describe("normalizeTypography – HTML quote entities", () => {
  it("decodes &quot; to a straight ASCII double quote", () => {
    expect(normalizeTypography("Terminology: &quot;Update docs&quot;")).toBe(
      'Terminology: "Update docs"',
    );
  });

  it("decodes &#34; / &#x22; to straight ASCII double quote", () => {
    expect(normalizeTypography("a &#34; b &#x22; c")).toBe('a " b " c');
  });

  it("decodes &apos; / &#39; / &#x27; to straight ASCII apostrophe", () => {
    expect(normalizeTypography("a &apos; b &#39; c &#x27; d")).toBe(
      "a ' b ' c ' d",
    );
  });

  it("matches case-insensitively (&QUOT; / &#X22;)", () => {
    expect(normalizeTypography("a &QUOT; b &#X22; c")).toBe('a " b " c');
  });
});

describe("normalizeTypography – Unicode curly quotes", () => {
  it("normalizes left/right double curly quotes to straight ASCII", () => {
    expect(normalizeTypography("“Update docs”")).toBe('"Update docs"');
  });

  it("normalizes left/right single curly quotes to straight ASCII", () => {
    expect(normalizeTypography("Don’t")).toBe("Don't");
    expect(normalizeTypography("‘What’s’")).toBe("'What's'");
  });

  it("leaves text without quotes untouched", () => {
    expect(normalizeTypography("Hello, world!")).toBe("Hello, world!");
  });
});

describe("normalizeTypography – idempotency", () => {
  // The harness applies this transform exactly once, but the contract is
  // idempotent so callers can re-run it without surprise.
  const inputs = [
    "Terminology: &quot;Update docs&quot;",
    "Don’t",
    "“Hello” and 'world'",
    "Plain text without quotes",
    "Mixed: &quot;a” and ‘b&apos;",
  ];

  for (const input of inputs) {
    it(`normalizeTypography(normalizeTypography(${JSON.stringify(input)})) === normalizeTypography(input)`, () => {
      const once = normalizeTypography(input);
      const twice = normalizeTypography(once);
      expect(twice).toBe(once);
    });
  }
});

// ── HTML-aware text-node walker ───────────────────────────────────────────────

describe("applyTypographyNormalizationToTextNodes – HTML walking", () => {
  it("normalizes text content between tags", () => {
    const html = "<h2>Terminology: &quot;Update docs&quot;</h2>";
    expect(applyTypographyNormalizationToTextNodes(html)).toBe(
      '<h2>Terminology: "Update docs"</h2>',
    );
  });

  it("normalizes Unicode curly apostrophe in heading text", () => {
    const html = "<h3>Using zudo-doc’s Design Tokens</h3>";
    expect(applyTypographyNormalizationToTextNodes(html)).toBe(
      "<h3>Using zudo-doc's Design Tokens</h3>",
    );
  });

  it("does not touch attribute values that contain &quot;", () => {
    // &quot; inside an attribute value is the legitimate way to encode `"`.
    // Decoding it would break attribute parsing downstream.
    const html = '<a title="say &quot;hi&quot;" href="/foo">link</a>';
    expect(applyTypographyNormalizationToTextNodes(html)).toBe(html);
  });

  it("normalizes text but leaves attributes alone in mixed input", () => {
    const html = '<a href="/x?y=&quot;z&quot;">Don’t</a>';
    expect(applyTypographyNormalizationToTextNodes(html)).toBe(
      '<a href="/x?y=&quot;z&quot;">Don\'t</a>',
    );
  });

  it("handles multiple text nodes", () => {
    const html = "<p>&quot;a&quot;</p><p>‘b’</p>";
    expect(applyTypographyNormalizationToTextNodes(html)).toBe(
      "<p>\"a\"</p><p>'b'</p>",
    );
  });
});

// ── Integration with normalizeHtml ────────────────────────────────────────────

describe("normalizeHtml – typography parity", () => {
  // The B-13-3 acceptance criterion: a zfb-flavoured HTML snapshot and an
  // Astro-flavoured HTML snapshot of the same heading produce the same
  // normalized output once typography is canonicalized.
  it("converges zfb &quot; entity output with Astro Unicode quote output", () => {
    const zfb = "<h2>Terminology: &quot;Update docs&quot;</h2>";
    const astro = "<h2>Terminology: “Update docs”</h2>";
    expect(normalizeHtml(zfb)).toBe(normalizeHtml(astro));
  });

  it("converges zfb straight-apostrophe output with Astro curly-apostrophe output", () => {
    const zfb = "<h3>Don't</h3>";
    const astro = "<h3>Don’t</h3>";
    expect(normalizeHtml(zfb)).toBe(normalizeHtml(astro));
  });

  it("converges the /docs/reference/component-first heading", () => {
    const zfb = "<h2>Using zudo-doc's Design Tokens</h2>";
    const astro = "<h2>Using zudo-doc’s Design Tokens</h2>";
    expect(normalizeHtml(zfb)).toBe(normalizeHtml(astro));
  });

  it("converges the /docs/guides/layout-demos/hide-toc heading", () => {
    const zfb = "<h2>What's Happening</h2>";
    const astro = "<h2>What’s Happening</h2>";
    expect(normalizeHtml(zfb)).toBe(normalizeHtml(astro));
  });

  it("preserves typography characters inside <pre> blocks (code parity)", () => {
    // Code blocks must not be touched — `&quot;` inside <pre> is part of
    // the rendered source and must compare verbatim on both sides.
    const html = "<pre>const s = &quot;hello&quot;;</pre>";
    expect(normalizeHtml(html)).toContain("&quot;hello&quot;");
  });

  it("preserves typography characters inside <code> blocks", () => {
    const html = "<p>Use <code>&quot;literal&quot;</code> here.</p>";
    expect(normalizeHtml(html)).toContain("<code>&quot;literal&quot;</code>");
  });

  it("is idempotent when normalizeHtml is applied twice", () => {
    const inputs = [
      "<h2>Terminology: &quot;Update docs&quot;</h2>",
      "<h3>Don’t</h3>",
      "<p>“Hello” ‘world’</p>",
    ];
    for (const input of inputs) {
      const once = normalizeHtml(input);
      const twice = normalizeHtml(once);
      expect(twice).toBe(once);
    }
  });
});
