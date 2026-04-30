/**
 * strip-toc-heading.test.ts
 *
 * Unit tests for hasTocHeading(), stripTocHeading(), and
 * maybeStripTocHeading() from lib/strip-toc-heading.mjs.
 *
 * Covers:
 *   - Matching h2 inside <main> is stripped (EN: "On this page", JA: "目次")
 *   - h2 outside <main> is left alone
 *   - h2 with different text is left alone (partial match does NOT trigger)
 *   - h3 with the same text is left alone
 *   - Toggle disabled (enabled=false) → strip is a no-op
 *   - Edge case: whitespace / nested span around the text content (matched after trim)
 *   - hasTocHeading detection mirrors stripTocHeading scope (main-only)
 */

import { describe, expect, it } from "vitest";
import {
  hasTocHeading,
  stripTocHeading,
  maybeStripTocHeading,
} from "../lib/strip-toc-heading.mjs";

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Simple in-content TOC headings as rendered by zfb DocLayout inside <main>.
const H2_EN = `<h2>On this page</h2>`;
const H2_JA = `<h2>目次</h2>`;

// Heading wrapped in a span (edge case: inner tags around text).
const H2_EN_SPAN = `<h2><span>On this page</span></h2>`;
const H2_JA_SPAN = `<h2><span class="toc-label">目次</span></h2>`;

// Non-matching headings that must be left untouched.
const H2_PARTIAL = `<h2>On this page only</h2>`;
const H2_OTHER = `<h2>Table of contents</h2>`;
const H3_EN = `<h3>On this page</h3>`;
const H3_JA = `<h3>目次</h3>`;

// Full-page wrappers used in most tests.
const wrap = (mainContent: string, extraOutsideMain = "") =>
  `<body>${extraOutsideMain}<main>${mainContent}</main></body>`;

// ── hasTocHeading ─────────────────────────────────────────────────────────────

describe("hasTocHeading", () => {
  it("detects EN heading inside main", () => {
    expect(hasTocHeading(wrap(H2_EN))).toBe(true);
  });

  it("detects JA heading inside main", () => {
    expect(hasTocHeading(wrap(H2_JA))).toBe(true);
  });

  it("detects EN heading with surrounding content inside main", () => {
    const html = wrap(`<p>Intro</p>${H2_EN}<nav>toc items</nav>`);
    expect(hasTocHeading(html)).toBe(true);
  });

  it("detects JA heading with surrounding content inside main", () => {
    const html = wrap(`<p>イントロ</p>${H2_JA}<nav>目次アイテム</nav>`);
    expect(hasTocHeading(html)).toBe(true);
  });

  it("returns false when matching h2 is outside main", () => {
    const html = `<body>${H2_EN}<main><p>Content</p></main></body>`;
    expect(hasTocHeading(html)).toBe(false);
  });

  it("returns false when h2 text is a partial match (different text)", () => {
    expect(hasTocHeading(wrap(H2_PARTIAL))).toBe(false);
  });

  it("returns false when h2 has entirely different text", () => {
    expect(hasTocHeading(wrap(H2_OTHER))).toBe(false);
  });

  it("returns false for h3 with EN TOC text — only h2 is stripped", () => {
    expect(hasTocHeading(wrap(H3_EN))).toBe(false);
  });

  it("returns false for h3 with JA TOC text — only h2 is stripped", () => {
    expect(hasTocHeading(wrap(H3_JA))).toBe(false);
  });

  it("returns false when there is no main element at all", () => {
    expect(hasTocHeading(`<body>${H2_EN}</body>`)).toBe(false);
  });

  it("returns false on a page with no h2 at all", () => {
    expect(hasTocHeading(wrap(`<p>Content only</p>`))).toBe(false);
  });

  it("detects EN heading even when wrapped in a span (inner-tag stripping)", () => {
    expect(hasTocHeading(wrap(H2_EN_SPAN))).toBe(true);
  });

  it("detects JA heading even when wrapped in a span with a class", () => {
    expect(hasTocHeading(wrap(H2_JA_SPAN))).toBe(true);
  });
});

// ── stripTocHeading ───────────────────────────────────────────────────────────

describe("stripTocHeading", () => {
  it("removes EN TOC h2 inside main", () => {
    const html = wrap(`<p>Intro</p>${H2_EN}<nav>toc</nav>`);
    const result = stripTocHeading(html);
    expect(result).not.toContain("On this page");
    expect(result).toContain("<p>Intro</p>");
    expect(result).toContain("<nav>toc</nav>");
  });

  it("removes JA TOC h2 inside main", () => {
    const html = wrap(`<p>イントロ</p>${H2_JA}<nav>toc</nav>`);
    const result = stripTocHeading(html);
    expect(result).not.toContain("目次");
    expect(result).toContain("<p>イントロ</p>");
  });

  it("leaves the rest of the document intact after stripping EN heading", () => {
    const html = wrap(`${H2_EN}<article>Doc content</article>`);
    const result = stripTocHeading(html);
    expect(result).toBe(wrap(`<article>Doc content</article>`));
  });

  it("leaves the rest of the document intact after stripping JA heading", () => {
    const html = wrap(`${H2_JA}<article>ドキュメント</article>`);
    const result = stripTocHeading(html);
    expect(result).toBe(wrap(`<article>ドキュメント</article>`));
  });

  it("does NOT strip h2 with matching text that is outside main", () => {
    const html = `<body>${H2_EN}<main><article>Content</article></main></body>`;
    const result = stripTocHeading(html);
    expect(result).toContain("On this page");
    expect(result).toContain("<article>Content</article>");
  });

  it("does NOT strip h2 with partial-match text inside main", () => {
    const html = wrap(H2_PARTIAL);
    expect(stripTocHeading(html)).toBe(html);
  });

  it("does NOT strip h2 with different text inside main", () => {
    const html = wrap(H2_OTHER);
    expect(stripTocHeading(html)).toBe(html);
  });

  it("does NOT strip h3 with matching EN text inside main", () => {
    const html = wrap(H3_EN);
    expect(stripTocHeading(html)).toBe(html);
  });

  it("does NOT strip h3 with matching JA text inside main", () => {
    const html = wrap(H3_JA);
    expect(stripTocHeading(html)).toBe(html);
  });

  it("is a no-op when main has no TOC heading", () => {
    const html = wrap(`<p>Content</p><h2>Related articles</h2>`);
    expect(stripTocHeading(html)).toBe(html);
  });

  it("strips EN TOC h2 wrapped in a span (inner-tag stripping)", () => {
    const html = wrap(`${H2_EN_SPAN}<p>Body</p>`);
    const result = stripTocHeading(html);
    expect(result).not.toContain("On this page");
    expect(result).toContain("<p>Body</p>");
  });

  it("strips JA TOC h2 wrapped in a span with a class", () => {
    const html = wrap(`${H2_JA_SPAN}<p>本文</p>`);
    const result = stripTocHeading(html);
    expect(result).not.toContain("目次");
    expect(result).toContain("<p>本文</p>");
  });

  it("strips multiple occurrences of the TOC heading inside main", () => {
    // Unlikely in practice but the walker is a loop — verify all are removed.
    const html = wrap(`${H2_EN}<p>Mid</p>${H2_JA}`);
    const result = stripTocHeading(html);
    expect(result).not.toContain("On this page");
    expect(result).not.toContain("目次");
    expect(result).toContain("<p>Mid</p>");
  });

  it("is a no-op when there is no main element", () => {
    const html = `<body>${H2_EN}<div>Content</div></body>`;
    expect(stripTocHeading(html)).toBe(html);
  });

  it("strips only the TOC heading, leaving other h2s intact", () => {
    const html = wrap(`${H2_EN}<h2>Chapter 1</h2><p>Text</p>`);
    const result = stripTocHeading(html);
    expect(result).not.toContain("On this page");
    expect(result).toContain("<h2>Chapter 1</h2>");
    expect(result).toContain("<p>Text</p>");
  });

  it("symmetric stripping: A-side without heading and B-side without heading both pass through", () => {
    // Pages without any TOC heading — must be no-ops on both sides.
    const sideA = wrap(`<article>Doc content</article>`);
    const sideB = wrap(`<article>Doc content</article>`);
    expect(stripTocHeading(sideA)).toBe(sideA);
    expect(stripTocHeading(sideB)).toBe(sideB);
  });
});

// ── maybeStripTocHeading ──────────────────────────────────────────────────────

describe("maybeStripTocHeading", () => {
  const withHeading = wrap(`${H2_EN}<article>Page content</article>`);
  const withoutHeading = wrap(`<article>Page content</article>`);

  it("strips TOC heading when enabled=true and heading is present", () => {
    const result = maybeStripTocHeading(withHeading, true);
    expect(result).not.toContain("On this page");
    expect(result).toContain("Page content");
  });

  it("is a no-op when enabled=false even if heading is present", () => {
    const result = maybeStripTocHeading(withHeading, false);
    expect(result).toBe(withHeading);
  });

  it("is a no-op when enabled=true but no heading is present", () => {
    const result = maybeStripTocHeading(withoutHeading, true);
    expect(result).toBe(withoutHeading);
  });

  it("is a no-op when enabled=false and no heading is present", () => {
    expect(maybeStripTocHeading(withoutHeading, false)).toBe(withoutHeading);
  });

  it("symmetric stripping: both sides lose the TOC heading, keeping identical content", () => {
    // A-side (Astro) has no in-content TOC heading inside main — pass through.
    const sideA = wrap(`<article>Doc content</article>`);
    // B-side (zfb) emits <h2>On this page</h2> inside main.
    const sideB = wrap(`${H2_EN}<article>Doc content</article>`);

    const strippedA = maybeStripTocHeading(sideA, true);
    const strippedB = maybeStripTocHeading(sideB, true);

    expect(strippedA).not.toContain("On this page");
    expect(strippedB).not.toContain("On this page");
    expect(strippedA).toContain("Doc content");
    expect(strippedB).toContain("Doc content");
  });

  it("JA symmetric stripping works the same way", () => {
    const sideA = wrap(`<article>コンテンツ</article>`);
    const sideB = wrap(`${H2_JA}<article>コンテンツ</article>`);

    const strippedA = maybeStripTocHeading(sideA, true);
    const strippedB = maybeStripTocHeading(sideB, true);

    expect(strippedA).not.toContain("目次");
    expect(strippedB).not.toContain("目次");
    expect(strippedA).toContain("コンテンツ");
    expect(strippedB).toContain("コンテンツ");
  });
});
