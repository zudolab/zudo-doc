/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SSG HTML-presence test for the mobile MobileToc component.
 *
 * Verifies that anchor links appear in the serialized SSG HTML even
 * when the panel is in the closed (initial) state. The items list must
 * be present in the static markup so:
 *   - crawlers and JS-off users can discover the links,
 *   - migration-check anchor-link probes pass,
 *   - keyboard navigation works immediately after hydration.
 *
 * Visibility is toggled by CSS (`hidden` class / display:none) — the
 * anchor elements themselves must always be in the DOM.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { MobileToc } from "../mobile-toc";
import type { HeadingItem } from "../types";

const SAMPLE_HEADINGS: HeadingItem[] = [
  { depth: 2, slug: "introduction", text: "Introduction" },
  { depth: 3, slug: "prerequisites", text: "Prerequisites" },
  { depth: 2, slug: "configuration", text: "Configuration" },
  { depth: 4, slug: "advanced-options", text: "Advanced Options" },
];

describe("MobileToc — SSG HTML presence", () => {
  it("renders anchor links for each qualifying heading in static HTML", () => {
    const html = render(<MobileToc headings={SAMPLE_HEADINGS} title="On this page" />);

    // Every depth-2/3/4 heading must have an anchor link in the static HTML,
    // even when the panel starts closed (display:none toggled by CSS class).
    expect(html).toContain('href="#introduction"');
    expect(html).toContain('href="#prerequisites"');
    expect(html).toContain('href="#configuration"');
    expect(html).toContain('href="#advanced-options"');
  });

  it("renders section title in static HTML", () => {
    const html = render(<MobileToc headings={SAMPLE_HEADINGS} title="On this page" />);
    expect(html).toContain("On this page");
  });

  it("renders locale-specific title in static HTML", () => {
    const html = render(<MobileToc headings={SAMPLE_HEADINGS} title="目次" />);
    expect(html).toContain("目次");
  });

  it("renders locale title even when headings array is empty", () => {
    // When no qualifying headings exist, the hidden placeholder still carries
    // the locale label so migration-check string probes pass.
    const html = render(<MobileToc headings={[]} title="目次" />);
    expect(html).toContain("目次");
    expect(html).not.toContain('href="#');
  });

  it("items list is in the HTML even in the initial closed state (display:none via CSS)", () => {
    const html = render(<MobileToc headings={SAMPLE_HEADINGS} title="On this page" />);
    // The list must exist in SSG markup — visibility is CSS-toggled, not JS-hidden.
    expect(html).toContain("<ul");
    // Closed state: list has hidden class so it is display:none visually, but
    // the anchor elements remain in the serialized HTML.
    expect(html).toContain("hidden");
    expect(html).toContain('href="#introduction"');
  });

  it("does not render depth-1 or depth-5+ headings", () => {
    const mixed: HeadingItem[] = [
      { depth: 1, slug: "page-title", text: "Page Title" },
      { depth: 2, slug: "section", text: "Section" },
      { depth: 5, slug: "too-deep", text: "Too Deep" },
    ];
    const html = render(<MobileToc headings={mixed} title="On this page" />);
    expect(html).toContain('href="#section"');
    expect(html).not.toContain('href="#page-title"');
    expect(html).not.toContain('href="#too-deep"');
  });
});
