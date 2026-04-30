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

// ── Astro framework runtime stripping (B-14-1) ───────────────────────────────

describe("normalizeHtml – Astro runtime noise stripping", () => {
  it("strips the astro-island/astro-slot display:contents style block", () => {
    const html =
      '<head><style>astro-island,astro-slot,astro-static-slot{display:contents}</style></head><body><main><p>Content</p></main></body>';
    const result = normalizeHtml(html);
    expect(result).not.toContain("astro-island,astro-slot");
    expect(result).not.toContain("display:contents");
    expect(result).toContain("<p>Content</p>");
  });

  it("strips an inline script containing self.Astro", () => {
    const html =
      '<main><script>(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event("astro:load"));})();</script><p>Content</p></main>';
    const result = normalizeHtml(html);
    expect(result).not.toContain("self.Astro");
    expect(result).toContain("<p>Content</p>");
  });

  it("strips an inline script containing astro:idle", () => {
    const html =
      '<main><script>(()=>{var l=(n,t)=>{window.addEventListener("astro:idle",()=>{})}})();</script><p>Content</p></main>';
    const result = normalizeHtml(html);
    expect(result).not.toContain("astro:idle");
    expect(result).toContain("<p>Content</p>");
  });

  it("strips an inline script containing astro-island class registration", () => {
    const html =
      '<header><script>(()=>{class astro-island extends HTMLElement{}})()</script><nav>Nav</nav></header>';
    const result = normalizeHtml(html);
    expect(result).not.toContain("astro-island extends");
    expect(result).toContain("<nav>Nav</nav>");
  });

  it("leaves unrelated inline scripts intact", () => {
    const html = '<script>var x = 1; console.log(x);</script><p>Text</p>';
    const result = normalizeHtml(html);
    expect(result).toContain("var x = 1");
    expect(result).toContain("<p>Text</p>");
  });

  it("leaves external scripts (with src) intact", () => {
    const html = '<script src="/app.js"></script><p>Text</p>';
    const result = normalizeHtml(html);
    expect(result).toContain('src="/app.js"');
    expect(result).toContain("<p>Text</p>");
  });

  it("leaves JSON-LD scripts (with type attribute) intact", () => {
    const html =
      '<script type="application/ld+json">{"@type":"WebPage"}</script><p>Text</p>';
    const result = normalizeHtml(html);
    expect(result).toContain("application/ld+json");
    expect(result).toContain("@type");
  });
});

// ── Non-breaking whitespace canonicalization (B-14-3) ────────────────────────

describe("normalizeHtml – non-breaking whitespace canonicalization", () => {
  it("converts &nbsp; entity to plain ASCII space", () => {
    const html = "<p>#ai&nbsp;(3)</p>";
    const result = normalizeHtml(html);
    expect(result).not.toContain("&nbsp;");
    expect(result).toContain("#ai");
    expect(result).toContain("(3)");
  });

  it("converts multiple &nbsp; occurrences", () => {
    const html = "<p>#ai&nbsp;(3)&nbsp;#cloudflare&nbsp;(2)</p>";
    const result = normalizeHtml(html);
    expect(result).not.toContain("&nbsp;");
  });

  it("is case-insensitive for &NBSP; / &Nbsp;", () => {
    const html = "<p>foo&NBSP;bar</p>";
    const result = normalizeHtml(html);
    expect(result).not.toContain("&NBSP;");
    expect(result).not.toContain("&nbsp;");
  });

  it("converts U+00A0 non-breaking space to plain ASCII space", () => {
    // U+00A0 is the decoded form of &nbsp; — also canonicalize it
    const html = "<p>tag (5)</p>";
    const result = normalizeHtml(html);
    expect(result).not.toContain(" ");
    expect(result).toContain("tag");
    expect(result).toContain("(5)");
  });

  it("preserves other content around &nbsp;", () => {
    const html = "<span>#ai</span><span>&nbsp;(3)</span>";
    const result = normalizeHtml(html);
    expect(result).not.toContain("&nbsp;");
    expect(result).toContain("#ai");
    expect(result).toContain("(3)");
  });

  it("converts &#160; (decimal NCR for U+00A0) to plain ASCII space", () => {
    const html = "<p>#ai&#160;(3)</p>";
    const result = normalizeHtml(html);
    expect(result).not.toContain("&#160;");
    expect(result).toContain("#ai (3)");
  });

  it("converts &#xa0; (hex NCR for U+00A0) to plain ASCII space", () => {
    const html = "<p>#ai&#xa0;(3)</p><p>#ja&#xA0;(2)</p><p>#en&#x00a0;(1)</p>";
    const result = normalizeHtml(html);
    expect(result).not.toContain("&#xa0;");
    expect(result).not.toContain("&#xA0;");
    expect(result).not.toContain("&#x00a0;");
    expect(result).toContain("#ai (3)");
    expect(result).toContain("#ja (2)");
    expect(result).toContain("#en (1)");
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

// ── og:title brand-suffix stripping (B-15-1) ─────────────────────────────────

describe("normalizeHtml – og:title brand-suffix stripping", () => {
  it("strips the configured brandSuffix from og:title content", () => {
    const html = '<meta property="og:title" content="Page Title | zudo-doc">';
    const result = normalizeHtml(html, { brandSuffix: " | zudo-doc" });
    expect(result).toContain('content="Page Title"');
    expect(result).not.toContain("| zudo-doc");
  });

  it("leaves og:title unchanged when content has no brandSuffix", () => {
    const html = '<meta property="og:title" content="Page Title">';
    const result = normalizeHtml(html, { brandSuffix: " | zudo-doc" });
    expect(result).toContain('content="Page Title"');
  });

  it("respects a custom brandSuffix (e.g. \" | foo\")", () => {
    const html = '<meta property="og:title" content="Some Page | foo">';
    const result = normalizeHtml(html, { brandSuffix: " | foo" });
    expect(result).toContain('content="Some Page"');
    expect(result).not.toContain("| foo");
  });

  it("is a no-op when brandSuffix is empty string (disabled)", () => {
    const html = '<meta property="og:title" content="Page Title | zudo-doc">';
    const result = normalizeHtml(html, { brandSuffix: "" });
    expect(result).toContain('content="Page Title | zudo-doc"');
  });

  it("is a no-op when brandSuffix option is not provided", () => {
    const html = '<meta property="og:title" content="Page Title | zudo-doc">';
    const result = normalizeHtml(html);
    expect(result).toContain('content="Page Title | zudo-doc"');
  });

  it("does not affect other og: meta tags", () => {
    const html =
      '<meta property="og:description" content="Desc | zudo-doc">' +
      '<meta property="og:url" content="https://example.com/page">';
    const result = normalizeHtml(html, { brandSuffix: " | zudo-doc" });
    expect(result).toContain('content="Desc | zudo-doc"');
    expect(result).toContain('content="https://example.com/page"');
  });

  it("handles attributes in either order (property before content)", () => {
    // After normalizeHtml step 3 attrs are sorted (content before property),
    // but this test verifies the regex works regardless of order.
    const html = '<meta property="og:title" content="My Doc | zudo-doc">';
    const result = normalizeHtml(html, { brandSuffix: " | zudo-doc" });
    expect(result).toContain('content="My Doc"');
  });
});

// ── Astro view-transitions meta tag stripping (B-15-1) ───────────────────────

describe("normalizeHtml – Astro view-transitions meta stripping", () => {
  it("removes astro-view-transitions-enabled meta when toggle is on", () => {
    const html =
      '<meta name="astro-view-transitions-enabled" content="true"><p>Body</p>';
    const result = normalizeHtml(html, { stripAstroViewTransitionsMeta: true });
    expect(result).not.toContain("astro-view-transitions-enabled");
    expect(result).toContain("<p>Body</p>");
  });

  it("removes astro-view-transitions-fallback meta when toggle is on", () => {
    const html =
      '<meta name="astro-view-transitions-fallback" content="animate"><p>Body</p>';
    const result = normalizeHtml(html, { stripAstroViewTransitionsMeta: true });
    expect(result).not.toContain("astro-view-transitions-fallback");
    expect(result).toContain("<p>Body</p>");
  });

  it("removes both view-transitions meta tags when both are present", () => {
    const html =
      '<meta name="astro-view-transitions-enabled" content="true">' +
      '<meta name="astro-view-transitions-fallback" content="animate">' +
      "<title>Page</title>";
    const result = normalizeHtml(html, { stripAstroViewTransitionsMeta: true });
    expect(result).not.toContain("astro-view-transitions-enabled");
    expect(result).not.toContain("astro-view-transitions-fallback");
    expect(result).toContain("<title>Page</title>");
  });

  it("is a no-op when toggle is false", () => {
    const html =
      '<meta name="astro-view-transitions-enabled" content="true"><p>Body</p>';
    const result = normalizeHtml(html, { stripAstroViewTransitionsMeta: false });
    expect(result).toContain("astro-view-transitions-enabled");
  });

  it("is a no-op when toggle is not provided (defaults false)", () => {
    const html =
      '<meta name="astro-view-transitions-enabled" content="true"><p>Body</p>';
    const result = normalizeHtml(html);
    expect(result).toContain("astro-view-transitions-enabled");
  });

  it("does NOT strip other astro-view-transitions-* prefixed tags (over-matching guard)", () => {
    // Only the two known names (enabled, fallback) should be stripped.
    // A hypothetical future tag must not be accidentally removed.
    const html =
      '<meta name="astro-view-transitions-custom" content="foo"><p>Body</p>';
    const result = normalizeHtml(html, { stripAstroViewTransitionsMeta: true });
    expect(result).toContain("astro-view-transitions-custom");
  });

  it("leaves unrelated meta tags intact", () => {
    const html =
      '<meta name="description" content="Hello world">' +
      '<meta name="astro-view-transitions-enabled" content="true">';
    const result = normalizeHtml(html, { stripAstroViewTransitionsMeta: true });
    expect(result).toContain('name="description"');
    expect(result).toContain('content="Hello world"');
    expect(result).not.toContain("astro-view-transitions-enabled");
  });
});
