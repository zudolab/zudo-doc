/**
 * normalize-html.test.ts
 *
 * Tests for the normalizeHtml() function covering all normalization rules:
 * whitespace collapsing, attribute sorting, hash-query stripping,
 * hash-filename stripping, site prefix stripping, CF overlay removal,
 * and hydration data-* attribute stripping.
 *
 * Also verifies that identical / cosmetic-only fixture pairs produce
 * the same normalized output.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeHtml } from "../lib/normalize-html.mjs";

const FIXTURES = join(import.meta.dirname, "fixtures");

function fixture(category: string, file: string) {
  return readFileSync(join(FIXTURES, category, file), "utf8");
}

// ── Whitespace ────────────────────────────────────────────────────────────────

describe("normalizeHtml – whitespace between tags", () => {
  it("collapses whitespace between tags outside pre/code", () => {
    const html = "<div>  \n  <p>  hello  </p>  \n  </div>";
    const result = normalizeHtml(html);
    expect(result).toBe("<div><p>  hello  </p></div>");
  });

  it("preserves whitespace inside <pre> blocks", () => {
    const html = "<div><pre>  line one\n  line two\n</pre></div>";
    const result = normalizeHtml(html);
    expect(result).toContain("<pre>  line one\n  line two\n</pre>");
  });

  it("preserves whitespace inside <code> blocks", () => {
    const html = "<p><code>  spaced  code  </code></p>";
    const result = normalizeHtml(html);
    expect(result).toContain("<code>  spaced  code  </code>");
  });

  it("preserves whitespace inside <textarea> blocks", () => {
    const html = "<form><textarea>  some\n  text\n</textarea></form>";
    const result = normalizeHtml(html);
    expect(result).toContain("<textarea>  some\n  text\n</textarea>");
  });
});

// ── Attribute sorting ─────────────────────────────────────────────────────────

describe("normalizeHtml – attribute sorting", () => {
  it("sorts attributes alphabetically", () => {
    const html = '<div id="bar" class="foo" aria-label="baz">';
    const result = normalizeHtml(html);
    expect(result).toBe('<div aria-label="baz" class="foo" id="bar">');
  });

  it("handles single-attribute tags unchanged (effectively)", () => {
    const html = '<p class="text">';
    const result = normalizeHtml(html);
    expect(result).toBe('<p class="text">');
  });

  it("handles tags without attributes unchanged", () => {
    const html = "<main>";
    const result = normalizeHtml(html);
    expect(result).toBe("<main>");
  });

  it("handles self-closing tags with sorted attributes", () => {
    const html = '<img src="foo.jpg" alt="A photo" loading="lazy">';
    const result = normalizeHtml(html);
    // Attributes should be sorted: alt, loading, src
    expect(result).toBe('<img alt="A photo" loading="lazy" src="foo.jpg">');
  });
});

// ── Build-hash query strings ───────────────────────────────────────────────────

describe("normalizeHtml – strip build-hash query strings", () => {
  it("strips ?v=... from asset hrefs", () => {
    const html = '<link rel="stylesheet" href="/_assets/main.css?v=abc123">';
    const result = normalizeHtml(html);
    expect(result).toContain('href="/_assets/main.css"');
    expect(result).not.toContain("?v=");
  });

  it("strips ?rev=... from asset hrefs", () => {
    const html = '<script src="/app.js?rev=deadbeef"></script>';
    const result = normalizeHtml(html);
    expect(result).toContain('src="/app.js"');
    expect(result).not.toContain("?rev=");
  });
});

// ── Hash-suffixed filenames ───────────────────────────────────────────────────

describe("normalizeHtml – strip hash-suffixed asset filenames", () => {
  it("normalizes /_assets/main.abc123def4.js to /_assets/main.[hash].js", () => {
    const html = '<script src="/_assets/main.abc123def4.js"></script>';
    const result = normalizeHtml(html);
    expect(result).toContain('src="/_assets/main.[hash].js"');
  });

  it("normalizes /_assets/chunk.11223344.css to /_assets/chunk.[hash].css", () => {
    const html = '<link rel="stylesheet" href="/_assets/chunk.11223344.css">';
    const result = normalizeHtml(html);
    expect(result).toContain('href="/_assets/chunk.[hash].css"');
  });

  it("does not mangle short non-hash suffixes", () => {
    const html = '<link rel="stylesheet" href="/style.min.css">';
    const result = normalizeHtml(html);
    expect(result).toContain('href="/style.min.css"');
  });
});

// ── Site prefix stripping ─────────────────────────────────────────────────────

describe("normalizeHtml – sitePrefix stripping", () => {
  it("strips the site prefix from href values", () => {
    const html = '<a href="/pj/zudo-doc/docs/intro/">Intro</a>';
    const result = normalizeHtml(html, { sitePrefix: "/pj/zudo-doc/" });
    expect(result).toContain('href="/docs/intro/"');
  });

  it("strips the site prefix from canonical link", () => {
    const html = '<link rel="canonical" href="/pj/zudo-doc/docs/guide/">';
    const result = normalizeHtml(html, { sitePrefix: "/pj/zudo-doc/" });
    expect(result).toContain('href="/docs/guide/"');
  });

  it("does not mangle hrefs that do not start with the prefix", () => {
    const html = '<a href="/docs/intro/">Intro</a>';
    const result = normalizeHtml(html, { sitePrefix: "/pj/zudo-doc/" });
    expect(result).toContain('href="/docs/intro/"');
  });

  it("is a no-op when sitePrefix is not set", () => {
    const html = '<a href="/pj/zudo-doc/docs/intro/">Intro</a>';
    const result = normalizeHtml(html);
    expect(result).toContain('href="/pj/zudo-doc/docs/intro/"');
  });
});

// ── Hydration data-* attribute stripping ────────────────────────────────────

describe("normalizeHtml – hydration data-* attribute stripping", () => {
  it("strips data-zfb-island-* attributes", () => {
    const html = '<div data-zfb-island-id="sidebar" data-zfb-island-props="{}" class="sidebar">';
    const result = normalizeHtml(html);
    expect(result).toContain('class="sidebar"');
    expect(result).not.toContain("data-zfb-island-");
  });

  it("strips data-astro-* attributes", () => {
    const html = '<div data-astro-cid-abc123="true" class="content">';
    const result = normalizeHtml(html);
    expect(result).toContain('class="content"');
    expect(result).not.toContain("data-astro-");
  });

  it("keeps unrelated data-* attributes intact", () => {
    const html = '<button data-action="toggle" type="button">Click</button>';
    const result = normalizeHtml(html);
    expect(result).toContain('data-action="toggle"');
  });
});

// ── Cloudflare workerd overlay stripping ─────────────────────────────────────

describe("normalizeHtml – CF workerd error overlay stripping", () => {
  it("strips CF HTML comments", () => {
    const html =
      '<html><body><!-- cloudflare error overlay content --><main>Page</main></body></html>';
    const result = normalizeHtml(html);
    expect(result).not.toContain("cloudflare error overlay");
    expect(result).toContain("<main>Page</main>");
  });

  it("strips CF error overlay divs", () => {
    const html =
      '<div class="cf-error-details"><p>Error details</p></div><main>OK</main>';
    const result = normalizeHtml(html);
    expect(result).not.toContain("cf-error-details");
    expect(result).toContain("<main>OK</main>");
  });
});

// ── Fixture pair tests ────────────────────────────────────────────────────────

describe("normalizeHtml – fixture pairs", () => {
  it("identical/a and identical/b produce the same normalized output", () => {
    const a = normalizeHtml(fixture("identical", "a.html"));
    const b = normalizeHtml(fixture("identical", "b.html"));
    expect(a).toBe(b);
  });

  it("cosmetic-only/a and cosmetic-only/b produce the same normalized output", () => {
    // a and b differ only in: whitespace, attribute order, and build hash values —
    // all of which normalizeHtml erases.
    const a = normalizeHtml(fixture("cosmetic-only", "a.html"));
    const b = normalizeHtml(fixture("cosmetic-only", "b.html"));
    expect(a).toBe(b);
  });

  it("structural/a and structural/b produce different normalized outputs", () => {
    // a uses h3 headings under h2; b promotes them all to h2 — a structural diff.
    const a = normalizeHtml(fixture("structural", "a.html"));
    const b = normalizeHtml(fixture("structural", "b.html"));
    expect(a).not.toBe(b);
  });

  it("content-loss/a and content-loss/b produce different normalized outputs", () => {
    const a = normalizeHtml(fixture("content-loss", "a.html"));
    const b = normalizeHtml(fixture("content-loss", "b.html"));
    expect(a).not.toBe(b);
  });

  it("asset-loss/a and asset-loss/b produce different normalized outputs", () => {
    const a = normalizeHtml(fixture("asset-loss", "a.html"));
    const b = normalizeHtml(fixture("asset-loss", "b.html"));
    expect(a).not.toBe(b);
  });

  it("meta-changed/a and meta-changed/b produce different normalized outputs", () => {
    const a = normalizeHtml(fixture("meta-changed", "a.html"));
    const b = normalizeHtml(fixture("meta-changed", "b.html"));
    expect(a).not.toBe(b);
  });

  it("error/a is parseable and has a 404 heading", () => {
    const html = fixture("error", "a.html");
    const result = normalizeHtml(html);
    expect(result).toContain("<h1>404</h1>");
  });
});
