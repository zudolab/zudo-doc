import { test, expect } from "@playwright/test";
import {
  expectHtmlLink,
  expectHtmlTagWithAttr,
  expectHtmlTagWithClass,
} from "./html-assertions";
import { readDistFile } from "./smoke-dist-helper";

/**
 * L3 golden coverage for markdown-behavior clusters that matter to this
 * project, asserted against the SHIPPING zfb Rust pipeline's built `dist/`
 * output — not the retired `packages/md-plugins` JS shim corpus.
 *
 * Why this file exists (zudolab/zudo-doc#2539): `packages/md-plugins`'
 * 80-test golden corpus tests a JS pipeline that no production code path
 * imports anymore (production markdown is entirely the zfb Rust pipeline),
 * and nothing previously asserted the Rust pipeline's own markdown-link /
 * CJK / table behavior end-to-end. See `packages/md-plugins/AUDIT.md` for
 * the full plugin-by-plugin classification and the corrected NOTE-1/NOTE-2
 * entries this spec makes true.
 *
 * Cluster coverage split across specs (do not duplicate):
 *   - admonitions/directives → e2e/smoke-admonitions.spec.ts,
 *     e2e/smoke-directives.spec.ts (pre-existing, unchanged by #2539)
 *   - CJK-friendly emphasis, .md/.mdx link rewriting (incl. query strings),
 *     GFM tables, KaTeX math → THIS file
 *
 * The retired-JS-bug decision (do not relitigate): `packages/md-plugins/
 * __fixtures__/expected-html/08-md-links.html` line 6 still pins the old
 * `rehypeStripMdExtension` regex bug (`./other.md?foo=bar` left unrewritten)
 * on purpose — that fixture proves the JS shim's own historical behavior for
 * parity-diffing, not what ships. The "With query" case below is the L3
 * proof that the PRODUCTION Rust pipeline does not have this bug.
 */

// ---------------------------------------------------------------------------
// .md/.mdx link rewriting (resolveMarkdownLinks + stripMdExt)
// ---------------------------------------------------------------------------

test.describe("Markdown links: resolveMarkdownLinks + stripMdExt", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("docs/guides/md-links-test/index.html");
  });

  test("markdown-syntax link to a sibling .mdx file resolves to its real route", () => {
    expectHtmlLink(html, "/docs/guides/page-1/", "Sibling page");
  });

  test("markdown-syntax link with an anchor resolves and keeps the anchor", () => {
    expectHtmlLink(html, "/docs/guides/page-1/#section", "With anchor");
  });

  test("markdown-syntax link with a query string resolves AND keeps the query string (the retired JS bug does not reproduce in production)", () => {
    // This is the golden that proves packages/md-plugins/__fixtures__/
    // expected-html/08-md-links.html line 6 pins RETIRED JS behavior, not a
    // live regression: the JS regex /\.mdx?(#.*)?$/ never matched query
    // strings, so `./other.md?foo=bar` stayed unrewritten there. The Rust
    // pipeline resolves the link to its real route AND preserves `?foo=bar`.
    expectHtmlLink(html, "/docs/guides/page-1/?foo=bar", "With query");
  });

  test("markdown-syntax link with both an anchor and a query string resolves correctly", () => {
    expectHtmlLink(
      html,
      "/docs/guides/page-1/?foo=bar#section",
      "With anchor and query",
    );
  });

  test("external .md link is left untouched", () => {
    expectHtmlLink(html, "https://example.com/foo.md", "External");
  });

  test("mailto link is left untouched", () => {
    expectHtmlLink(html, "mailto:hi@example.com", "Mailto");
  });

  test("pure in-page anchor link is left untouched", () => {
    expectHtmlLink(html, "#section", "Anchor only");
  });

  test("a JSX-authored raw <a> keeps its authored href (not a markdown link node, so resolveMarkdownLinks/stripMdExt never see it)", () => {
    // Documents a genuine divergence from the JS pipeline: the JS driver
    // parses raw HTML via rehype-raw into the same hast tree markdown
    // links flow through, so rehypeStripMdExtension touches BOTH forms
    // (see packages/md-plugins/__fixtures__/13-strip-md-extension.mdx). In
    // the production MDX pipeline, JSX-authored <a> compiles straight to
    // JSX and never becomes a markdown mdast link node, so neither
    // resolveMarkdownLinks nor StripMdExtensionPlugin process it.
    expectHtmlLink(
      html,
      "./page-1.md?foo=bar",
      "raw JSX anchor, left exactly as authored",
    );
  });
});

// ---------------------------------------------------------------------------
// GFM tables
// ---------------------------------------------------------------------------

test.describe("Tables: GFM table rendering", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("docs/guides/tables-test/index.html");
  });

  test("simple table renders <table>/<thead>/<tbody> with header and data cells", () => {
    expect(html).toContain("<thead><tr><th>Field</th><th>Type</th><th>Required</th></tr></thead>");
    expect(html).toContain("<td>name</td><td>string</td><td>yes</td>");
    expect(html).toContain("<td>tags</td><td>string[]</td><td>no</td>");
  });

  test("table cells render inline marks (code, bold) correctly", () => {
    expect(html).toContain("<td><code>key</code></td>");
    expect(html).toMatch(/<td>An <strong\b[^>]*>important<\/strong> value<\/td>/);
    expectHtmlTagWithClass(html, "strong", "font-bold");
    expectHtmlTagWithClass(html, "strong", "text-fg");
  });

  test("table cells render links, resolved the same as prose links", () => {
    expectHtmlLink(html, "/docs/guides/page-1/", "Writing Docs");
  });

  test("no raw GFM table pipe syntax remains in output", () => {
    expect(html).not.toContain("| Field | Type");
  });
});

// ---------------------------------------------------------------------------
// CJK-friendly emphasis (zfb's on-by-default CjkFriendlyPlugin — "CJK
// line-break behaviour" in packages/zudo-doc/src/preset.ts's own wording)
// ---------------------------------------------------------------------------

test.describe("CJK-friendly: emphasis markers adjacent to CJK characters", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("docs/guides/cjk-test/index.html");
  });

  // The smoke fixture does not set `cjkFriendly` in settings.ts (see
  // .fixture-settings-drift-allowlist) — these assertions exercise zfb's
  // Rust default (CjkFriendlyPlugin is the first mdast visitor registered
  // by Pipeline::with_defaults(), on regardless of the setting being unset).

  test("Japanese: bold marker immediately adjacent to kanji parses as emphasis", () => {
    expect(html).toMatch(/これは<strong\b[^>]*>重要<\/strong>な機能です。/);
  });

  test("Chinese: bold marker immediately adjacent to hanzi parses as emphasis", () => {
    expect(html).toMatch(/中文<strong\b[^>]*>强调<\/strong>测试。/);
  });

  test("Korean: bold marker adjacent to hangul parses as emphasis", () => {
    expect(html).toMatch(/한국어 <strong\b[^>]*>강조<\/strong> 테스트\./);
  });

  test("ASCII baseline (ordinary CommonMark emphasis between English words) is unaffected", () => {
    expect(html).toMatch(
      /this is <strong\b[^>]*>bold<\/strong> between English words/,
    );
  });

  test("mixed CJK + ASCII line renders emphasis correctly on both sides", () => {
    expect(html).toMatch(/日本語の <strong\b[^>]*>bold<\/strong> とテキスト。/);
  });

  test("no literal, unparsed ** markers remain in the article content", () => {
    // Scoped to <article> — the page also ships inline <script> boilerplate
    // (tabs/theme-sync helpers) that legitimately contains "**" inside JSDoc
    // comments, unrelated to markdown emphasis parsing.
    const articleMatch = html.match(/<article[^>]*>[\s\S]*?<\/article>/);
    expect(articleMatch).not.toBeNull();
    expect(articleMatch?.[0]).not.toContain("**");
  });
});

// ---------------------------------------------------------------------------
// Math (KaTeX via the <MathBlock> JSX component)
// ---------------------------------------------------------------------------
//
// The smoke fixture enables `math: true` (zudolab/zudo-doc#2539 — was
// `false`). In practice this setting is documentation-only: MathBlock is
// registered unconditionally in packages/zudo-doc/src/mdx-components/
// index.ts regardless of `settings.math`, so flipping the value doesn't
// change any wiring — it only makes the fixture's settings.ts describe its
// own content accurately (a math-using project sets `math: true`). `$...$`
// / `$$...$$` fence syntax is NOT supported by the zfb Rust MDX emitter;
// `<MathBlock latex="…" />` is the only supported authoring path (see
// src/content/docs/components/math-equations.mdx).

test.describe("Math: KaTeX rendering via <MathBlock>", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("docs/guides/math-test/index.html");
  });

  test("inline math renders a KaTeX span with the correct source annotation", () => {
    expectHtmlTagWithClass(html, "span", "math-inline");
    expectHtmlTagWithClass(html, "span", "katex");
    expectHtmlTagWithAttr(html, "annotation", "encoding", "application/x-tex");
    expect(html).toContain(">E = mc^2</annotation>");
  });

  test("block math renders a KaTeX display div with the correct source annotation", () => {
    expectHtmlTagWithClass(html, "div", "math-display");
    expectHtmlTagWithAttr(html, "annotation", "encoding", "application/x-tex");
    expect(html).toContain(
      ">\\int_0^{\\infty} e^{-x^2} \\, dx = \\frac{\\sqrt{\\pi}}{2}</annotation>",
    );
  });

  test("KaTeX MathML fallback is present for accessibility", () => {
    expectHtmlTagWithAttr(
      html,
      "math",
      "xmlns",
      "http://www.w3.org/1998/Math/MathML",
    );
  });
});
