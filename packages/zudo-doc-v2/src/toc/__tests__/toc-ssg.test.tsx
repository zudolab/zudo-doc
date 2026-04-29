/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SSG HTML-presence test for the desktop Toc component.
 *
 * Verifies that anchor links appear in the serialized HTML produced by
 * `preact-render-to-string` (which mirrors what the zfb SSG renderer
 * emits into `dist/**\/index.html`). This is the contract that
 * migration-check and crawlers rely on — JS-off users must see the TOC
 * links in the static markup.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { Toc } from "../toc";
import type { HeadingItem } from "../types";

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

  it("renders section title in static HTML", () => {
    const html = render(<Toc headings={SAMPLE_HEADINGS} title="On this page" />);
    expect(html).toContain("On this page");
  });

  it("renders locale title even when headings array is empty", () => {
    const html = render(<Toc headings={[]} title="目次" />);
    // Title must be present for migration-check parity.
    expect(html).toContain("目次");
    // No spurious anchor links when there are no headings.
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
