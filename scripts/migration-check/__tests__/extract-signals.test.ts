/**
 * extract-signals.test.ts
 *
 * Tests for the extractSignals() function covering all signal fields:
 * domShapeHash, visibleText, textHash, headings, metaTags,
 * canonicalUrl, jsonLd, rssLinks, linkTargets, assetRefs,
 * scriptInventory, and landmarks.
 *
 * Also verifies fixture-category properties (identical, structural, etc.).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractSignals } from "../lib/extract-signals.mjs";
import { normalizeHtml } from "../lib/normalize-html.mjs";

const FIXTURES = join(import.meta.dirname, "fixtures");

function fixture(category: string, file: string) {
  return readFileSync(join(FIXTURES, category, file), "utf8");
}

function sha256(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// ── Headings ──────────────────────────────────────────────────────────────────

describe("extractSignals – headings", () => {
  it("extracts h1–h6 headings as [level, text] tuples", () => {
    const html = `<html><body>
      <h1>Title</h1>
      <h2>Section One</h2>
      <h3>Sub-section</h3>
      <h2>Section Two</h2>
    </body></html>`;
    const { headings } = extractSignals(normalizeHtml(html));
    expect(headings).toEqual([
      [1, "Title"],
      [2, "Section One"],
      [3, "Sub-section"],
      [2, "Section Two"],
    ]);
  });

  it("strips inline tags from heading text", () => {
    const html = '<h2><a href="/foo">Linked <em>heading</em></a></h2>';
    const { headings } = extractSignals(normalizeHtml(html));
    expect(headings).toEqual([[2, "Linked heading"]]);
  });
});

// ── Meta tags ─────────────────────────────────────────────────────────────────

describe("extractSignals – metaTags", () => {
  it("extracts <meta name=...> tags", () => {
    const html = `<head>
      <meta name="description" content="Page description">
      <meta name="author" content="Alice">
    </head>`;
    const { metaTags } = extractSignals(normalizeHtml(html));
    expect(metaTags).toContainEqual(["description", "Page description"]);
    expect(metaTags).toContainEqual(["author", "Alice"]);
  });

  it("extracts <meta property=...> OpenGraph tags", () => {
    const html = `<head>
      <meta property="og:title" content="OG Title">
      <meta property="og:description" content="OG Desc">
    </head>`;
    const { metaTags } = extractSignals(normalizeHtml(html));
    expect(metaTags).toContainEqual(["og:title", "OG Title"]);
    expect(metaTags).toContainEqual(["og:description", "OG Desc"]);
  });

  it("extracts Twitter Card meta tags", () => {
    const html = '<meta name="twitter:card" content="summary_large_image">';
    const { metaTags } = extractSignals(normalizeHtml(html));
    expect(metaTags).toContainEqual(["twitter:card", "summary_large_image"]);
  });

  it("does not include <meta charset=> (no content attr)", () => {
    const html = '<head><meta charset="UTF-8"></head>';
    const { metaTags } = extractSignals(normalizeHtml(html));
    // charset has no content= attribute so it should not appear
    expect(metaTags.map(([k]) => k)).not.toContain("charset");
  });
});

// ── Canonical URL ─────────────────────────────────────────────────────────────

describe("extractSignals – canonicalUrl", () => {
  it("extracts <link rel=canonical href=...>", () => {
    const html = '<head><link rel="canonical" href="/docs/intro/"></head>';
    const { canonicalUrl } = extractSignals(normalizeHtml(html));
    expect(canonicalUrl).toBe("/docs/intro/");
  });

  it("returns null when no canonical is present", () => {
    const html = "<head><title>No canonical</title></head>";
    const { canonicalUrl } = extractSignals(normalizeHtml(html));
    expect(canonicalUrl).toBeNull();
  });
});

// ── JSON-LD ───────────────────────────────────────────────────────────────────

describe("extractSignals – jsonLd", () => {
  it("parses JSON-LD script blocks", () => {
    const html = `<head>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"WebPage","name":"Test"}
      </script>
    </head>`;
    const { jsonLd } = extractSignals(normalizeHtml(html));
    expect(jsonLd).toHaveLength(1);
    expect(jsonLd[0]).toMatchObject({ "@type": "WebPage", name: "Test" });
  });

  it("returns empty array when no JSON-LD present", () => {
    const html = "<head></head><body></body>";
    const { jsonLd } = extractSignals(normalizeHtml(html));
    expect(jsonLd).toEqual([]);
  });

  it("skips malformed JSON-LD blocks", () => {
    const html = `<script type="application/ld+json">{ invalid json }</script>`;
    const { jsonLd } = extractSignals(normalizeHtml(html));
    expect(jsonLd).toEqual([]);
  });
});

// ── RSS links ─────────────────────────────────────────────────────────────────

describe("extractSignals – rssLinks", () => {
  it("extracts RSS feed links", () => {
    const html = `<head>
      <link rel="alternate" type="application/rss+xml" href="/rss.xml" title="RSS">
    </head>`;
    const { rssLinks } = extractSignals(normalizeHtml(html));
    expect(rssLinks).toContain("/rss.xml");
  });

  it("extracts Atom feed links", () => {
    const html = `<head>
      <link rel="alternate" type="application/atom+xml" href="/atom.xml">
    </head>`;
    const { rssLinks } = extractSignals(normalizeHtml(html));
    expect(rssLinks).toContain("/atom.xml");
  });

  it("returns empty when no feed links", () => {
    const html = "<head></head>";
    const { rssLinks } = extractSignals(normalizeHtml(html));
    expect(rssLinks).toEqual([]);
  });
});

// ── Link targets ──────────────────────────────────────────────────────────────

describe("extractSignals – linkTargets", () => {
  it("collects all <a href> values", () => {
    const html = `<body>
      <a href="/docs/intro/">Intro</a>
      <a href="/docs/guide/">Guide</a>
      <a href="https://example.com">External</a>
    </body>`;
    const { linkTargets } = extractSignals(normalizeHtml(html));
    expect(linkTargets).toContain("/docs/intro/");
    expect(linkTargets).toContain("/docs/guide/");
    expect(linkTargets).toContain("https://example.com");
  });
});

// ── Asset refs ────────────────────────────────────────────────────────────────

describe("extractSignals – assetRefs", () => {
  it("collects stylesheet href, script src, and image src", () => {
    const html = `<head>
      <link rel="stylesheet" href="/style.css">
      <script src="/app.js"></script>
    </head>
    <body>
      <img src="/hero.jpg" alt="Hero">
    </body>`;
    const { assetRefs } = extractSignals(normalizeHtml(html));
    expect(assetRefs).toContain("/style.css");
    expect(assetRefs).toContain("/app.js");
    expect(assetRefs).toContain("/hero.jpg");
  });

  it("does not include plain anchor hrefs in assetRefs", () => {
    const html = `<a href="/docs/page/">Link</a>
      <link rel="stylesheet" href="/style.css">`;
    const { assetRefs } = extractSignals(normalizeHtml(html));
    expect(assetRefs).not.toContain("/docs/page/");
    expect(assetRefs).toContain("/style.css");
  });

  // ── Framework-noise stripping (#1327) ────────────────────────────────────

  it("strips /_astro/*.js script refs (Astro hashed JS chunks absent in zfb)", () => {
    const html = `<head>
      <script src="/_astro/ClientRouter.astro_abc123.js" type="module"></script>
      <script src="/_astro/search.astro_xyz789.js" type="module"></script>
      <link rel="stylesheet" href="/_astro/base.HWDxbTAy.css">
    </head>`;
    const { assetRefs } = extractSignals(normalizeHtml(html));
    // JS chunks must be gone
    expect(assetRefs).not.toContain("/_astro/ClientRouter.astro_abc123.js");
    expect(assetRefs).not.toContain("/_astro/search.astro_xyz789.js");
    // CSS entry must survive (needed for stylesheet-presence check in hasAssetLoss)
    expect(assetRefs).toContain("/_astro/base.HWDxbTAy.css");
  });

  it("strips /_astro/*.js refs even when a query string is appended", () => {
    const html = `<script src="/_astro/mermaid-init.astro_abc.js?v=1"></script>`;
    const { assetRefs } = extractSignals(normalizeHtml(html));
    expect(assetRefs).not.toContain("/_astro/mermaid-init.astro_abc.js?v=1");
  });

  it("strips CDN KaTeX stylesheet (zfb bundles KaTeX into its main CSS instead)", () => {
    const html = `<head>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.38/dist/katex.min.css">
      <link rel="stylesheet" href="/local.css">
    </head>`;
    const { assetRefs } = extractSignals(normalizeHtml(html));
    expect(assetRefs).not.toContain(
      "https://cdn.jsdelivr.net/npm/katex@0.16.38/dist/katex.min.css",
    );
    // Unrelated local stylesheet must survive
    expect(assetRefs).toContain("/local.css");
  });

  it("preserves non-/_astro script refs and unrelated asset refs", () => {
    const html = `<head>
      <script src="/assets/app.js" type="module"></script>
      <img src="/images/hero.png" alt="">
    </head>`;
    const { assetRefs } = extractSignals(normalizeHtml(html));
    expect(assetRefs).toContain("/assets/app.js");
    expect(assetRefs).toContain("/images/hero.png");
  });
});

// ── Script inventory ──────────────────────────────────────────────────────────

describe("extractSignals – scriptInventory", () => {
  it("collects external script src values only", () => {
    const html = `<head>
      <script src="/bundle.js" type="module"></script>
      <script>console.log('inline');</script>
      <script src="/analytics.js" defer></script>
    </head>`;
    const { scriptInventory } = extractSignals(normalizeHtml(html));
    expect(scriptInventory).toContain("/bundle.js");
    expect(scriptInventory).toContain("/analytics.js");
    expect(scriptInventory).toHaveLength(2);
  });

  it("returns empty array when no external scripts", () => {
    const html = "<script>window.foo = 1;</script>";
    const { scriptInventory } = extractSignals(normalizeHtml(html));
    expect(scriptInventory).toEqual([]);
  });

  // (#1327) Strip Astro hashed JS chunks here for the same reason extractAssetRefs
  // strips them — they would otherwise dominate hasAssetLoss against zfb output.
  it("strips Astro hashed JS chunks under /_astro/", () => {
    const html = `<head>
      <script src="/_astro/ClientRouter.astro_astro_type_script_index_0_lang.DmQZLfuR.js" type="module"></script>
      <script src="/_astro/search.astro_astro_type_script_index_0_lang.L0QHLS6J.js"></script>
      <script src="/bundle.js" type="module"></script>
    </head>`;
    const { scriptInventory } = extractSignals(normalizeHtml(html));
    expect(scriptInventory).toContain("/bundle.js");
    expect(scriptInventory).not.toContain(
      "/_astro/ClientRouter.astro_astro_type_script_index_0_lang.DmQZLfuR.js"
    );
    expect(scriptInventory).not.toContain(
      "/_astro/search.astro_astro_type_script_index_0_lang.L0QHLS6J.js"
    );
    expect(scriptInventory).toHaveLength(1);
  });
});

// ── Landmarks ─────────────────────────────────────────────────────────────────

describe("extractSignals – landmarks", () => {
  it("extracts semantic landmark elements", () => {
    const html = `<body>
      <nav aria-label="Primary">Nav</nav>
      <main>Main content</main>
      <footer>Footer</footer>
    </body>`;
    const { landmarks } = extractSignals(normalizeHtml(html));
    expect(landmarks).toContainEqual(["navigation", "Primary"]);
    expect(landmarks).toContainEqual(["main", ""]);
    expect(landmarks).toContainEqual(["contentinfo", ""]);
  });

  it("extracts sections with aria-label as region landmarks", () => {
    const html = '<section aria-label="Features">Content</section>';
    const { landmarks } = extractSignals(normalizeHtml(html));
    expect(landmarks).toContainEqual(["region", "Features"]);
  });

  it("does not include bare <section> without aria-label as a landmark", () => {
    const html = "<section><p>Content</p></section>";
    const { landmarks } = extractSignals(normalizeHtml(html));
    expect(landmarks.map(([r]) => r)).not.toContain("region");
  });

  it("extracts explicit role=... attributes", () => {
    const html = '<div role="search" aria-label="Site search">...</div>';
    const { landmarks } = extractSignals(normalizeHtml(html));
    expect(landmarks).toContainEqual(["search", "Site search"]);
  });
});

// ── DOM shape hash ────────────────────────────────────────────────────────────

describe("extractSignals – domShapeHash", () => {
  it("produces same domShapeHash for structurally identical HTML", () => {
    const htmlA = "<html><body><h1>Title</h1><p>Text</p></body></html>";
    const htmlB = '<html><body><h1 class="diff-attr">Title</h1><p>Different text</p></body></html>';
    const { domShapeHash: hashA } = extractSignals(normalizeHtml(htmlA));
    const { domShapeHash: hashB } = extractSignals(normalizeHtml(htmlB));
    expect(hashA).toBe(hashB);
  });

  it("produces different domShapeHash for structurally different HTML", () => {
    const htmlA = "<html><body><h1>Title</h1><p>Text</p></body></html>";
    const htmlB = "<html><body><h2>Title</h2><p>Text</p></body></html>";
    const { domShapeHash: hashA } = extractSignals(normalizeHtml(htmlA));
    const { domShapeHash: hashB } = extractSignals(normalizeHtml(htmlB));
    expect(hashA).not.toBe(hashB);
  });

  it("domShapeHash is a non-empty hex string", () => {
    const { domShapeHash } = extractSignals("<html></html>");
    expect(domShapeHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ── Text hash ─────────────────────────────────────────────────────────────────

describe("extractSignals – textHash", () => {
  it("textHash matches sha256 of visibleText", () => {
    const html = "<html><body><h1>Hello</h1><p>World</p></body></html>";
    const { visibleText, textHash } = extractSignals(normalizeHtml(html));
    expect(textHash).toBe(sha256(visibleText));
  });

  it("visibleText excludes script and style content", () => {
    const html = `<html><body>
      <style>.foo { color: red; }</style>
      <script>window.bar = 42;</script>
      <p>Visible text only</p>
    </body></html>`;
    const { visibleText } = extractSignals(normalizeHtml(html));
    expect(visibleText).not.toContain("color");
    expect(visibleText).not.toContain("window.bar");
    expect(visibleText).toContain("Visible text only");
  });
});

// ── Fixture-category signal tests ─────────────────────────────────────────────

describe("extractSignals – fixture categories", () => {
  it("identical: both pages share all signal hashes", () => {
    const sigA = extractSignals(normalizeHtml(fixture("identical", "a.html")));
    const sigB = extractSignals(normalizeHtml(fixture("identical", "b.html")));
    expect(sigA.domShapeHash).toBe(sigB.domShapeHash);
    expect(sigA.textHash).toBe(sigB.textHash);
    expect(sigA.headings).toEqual(sigB.headings);
    expect(sigA.canonicalUrl).toBe(sigB.canonicalUrl);
  });

  it("cosmetic-only: pages share all semantic signals after normalization", () => {
    const sigA = extractSignals(normalizeHtml(fixture("cosmetic-only", "a.html")));
    const sigB = extractSignals(normalizeHtml(fixture("cosmetic-only", "b.html")));
    expect(sigA.domShapeHash).toBe(sigB.domShapeHash);
    expect(sigA.textHash).toBe(sigB.textHash);
    expect(sigA.headings).toEqual(sigB.headings);
  });

  it("structural: domShapeHash differs between the two pages", () => {
    const sigA = extractSignals(normalizeHtml(fixture("structural", "a.html")));
    const sigB = extractSignals(normalizeHtml(fixture("structural", "b.html")));
    expect(sigA.domShapeHash).not.toBe(sigB.domShapeHash);
  });

  it("content-loss: textHash differs; B has fewer headings than A", () => {
    const sigA = extractSignals(normalizeHtml(fixture("content-loss", "a.html")));
    const sigB = extractSignals(normalizeHtml(fixture("content-loss", "b.html")));
    expect(sigA.textHash).not.toBe(sigB.textHash);
    expect(sigA.headings.length).toBeGreaterThan(sigB.headings.length);
  });

  it("meta-changed: metaTags differ between A and B", () => {
    const sigA = extractSignals(normalizeHtml(fixture("meta-changed", "a.html")));
    const sigB = extractSignals(normalizeHtml(fixture("meta-changed", "b.html")));
    expect(sigA.metaTags).not.toEqual(sigB.metaTags);
  });

  it("asset-loss: B has fewer assetRefs and scriptInventory entries than A", () => {
    const sigA = extractSignals(normalizeHtml(fixture("asset-loss", "a.html")));
    const sigB = extractSignals(normalizeHtml(fixture("asset-loss", "b.html")));
    expect(sigA.assetRefs.length).toBeGreaterThan(sigB.assetRefs.length);
    expect(sigA.scriptInventory.length).toBeGreaterThan(sigB.scriptInventory.length);
  });

  it("error: error page headings contain the 404 status", () => {
    const sig = extractSignals(normalizeHtml(fixture("error", "a.html")));
    const headingTexts = sig.headings.map(([, text]) => text);
    expect(headingTexts).toContain("404");
  });
});
