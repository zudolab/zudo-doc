/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SSG HTML-presence test for the desktop Toc component.
 *
 * Verifies that anchor links appear in the serialized HTML produced by
 * `preact-render-to-string` (which mirrors what the zfb SSG renderer
 * emits into `dist/**\/index.html`). This is the contract that crawlers
 * rely on — JS-off users must see the TOC links in the static markup.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { Toc } from "../toc.js";
import type { HeadingItem } from "../types.js";

const SAMPLE_HEADINGS: HeadingItem[] = [
  { depth: 2, slug: "introduction", text: "Introduction" },
  { depth: 3, slug: "prerequisites", text: "Prerequisites" },
  { depth: 2, slug: "configuration", text: "Configuration" },
  { depth: 4, slug: "advanced-options", text: "Advanced Options" },
];

describe("Toc — SSG HTML presence", () => {
  it("renders anchor links for each qualifying heading in static HTML", () => {
    const html = render(<Toc headings={SAMPLE_HEADINGS} title="On this page" />);

    // Every depth-2/3/4 heading should produce an anchor link.
    expect(html).toContain('href="#introduction"');
    expect(html).toContain('href="#prerequisites"');
    expect(html).toContain('href="#configuration"');
    expect(html).toContain('href="#advanced-options"');
  });

  it("renders the nav landmark with aria-label in static HTML", () => {
    const html = render(<Toc headings={SAMPLE_HEADINGS} title="On this page" />);
    expect(html).toContain('aria-label="Table of contents"');
  });

  it("renders heading text inside anchor elements", () => {
    const html = render(<Toc headings={SAMPLE_HEADINGS} title="On this page" />);
    expect(html).toContain("Introduction");
    expect(html).toContain("Prerequisites");
    expect(html).toContain("Configuration");
  });

  it("does not render a visible title <p> in static HTML (desktop heading removed, issue #1655/T1)", () => {
    const html = render(<Toc headings={SAMPLE_HEADINGS} title="On this page" />);
    // Desktop Toc no longer emits a visible heading — the nav landmark is the
    // accessible section boundary for screen readers.
    expect(html).not.toContain("On this page");
    // The aria-label landmark must still be present.
    expect(html).toContain('aria-label="Table of contents"');
  });

  it("renders no content when headings array is empty (title <p> absent)", () => {
    const html = render(<Toc headings={[]} title="目次" />);
    // No visible title and no anchor links when there are no headings.
    expect(html).not.toContain("目次");
    expect(html).not.toContain('href="#');
  });

  it("does not render depth-1 or depth-5+ headings", () => {
    const mixed: HeadingItem[] = [
      { depth: 1, slug: "page-title", text: "Page Title" },
      { depth: 2, slug: "section", text: "Section" },
      { depth: 5, slug: "too-deep", text: "Too Deep" },
    ];
    const html = render(<Toc headings={mixed} title="On this page" />);
    expect(html).toContain('href="#section"');
    expect(html).not.toContain('href="#page-title"');
    expect(html).not.toContain('href="#too-deep"');
  });
});
