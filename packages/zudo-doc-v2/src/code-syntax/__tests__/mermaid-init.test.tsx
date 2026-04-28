/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { MermaidInit } from "../mermaid-init";
import { MERMAID_INIT_SCRIPT } from "../mermaid-init-script";

describe("<MermaidInit />", () => {
  it("renders a <script> tag", () => {
    const html = render(<MermaidInit />);
    expect(html).toContain("<script");
  });

  it("script contains mermaid init logic", () => {
    const html = render(<MermaidInit />);
    expect(html).toContain("initMermaid");
    expect(html).toContain("data-mermaid");
  });

  it("script hooks into astro:page-load for view transitions", () => {
    const html = render(<MermaidInit />);
    expect(html).toContain("astro:page-load");
  });

  it("script observes color scheme changes via MutationObserver", () => {
    const html = render(<MermaidInit />);
    expect(html).toContain("MutationObserver");
    expect(html).toContain("reinitMermaid");
  });

  it("renders no extra HTML beyond the script tag", () => {
    const html = render(<MermaidInit />);
    // Should just be a script tag, no divs etc.
    expect(html.trimStart()).toMatch(/^<script/);
  });
});

describe("MERMAID_INIT_SCRIPT", () => {
  it("is a non-empty string", () => {
    expect(typeof MERMAID_INIT_SCRIPT).toBe("string");
    expect(MERMAID_INIT_SCRIPT.length).toBeGreaterThan(0);
  });

  it("wraps the logic in an IIFE", () => {
    expect(MERMAID_INIT_SCRIPT).toMatch(/^\(function\s*\(\)/);
    expect(MERMAID_INIT_SCRIPT.trimEnd()).toMatch(/\)\(\);$/);
  });

  it("lazily imports mermaid via dynamic import", () => {
    expect(MERMAID_INIT_SCRIPT).toContain('import("mermaid")');
  });

  it("resolves CSS custom properties for theme variables", () => {
    expect(MERMAID_INIT_SCRIPT).toContain("resolveColor");
    expect(MERMAID_INIT_SCRIPT).toContain("--zd-mermaid-node-bg");
    expect(MERMAID_INIT_SCRIPT).toContain("--zd-bg");
  });

  it("detects dark mode from background luminance", () => {
    expect(MERMAID_INIT_SCRIPT).toContain("luminance");
    expect(MERMAID_INIT_SCRIPT).toContain("darkMode");
  });

  it("skips already-rendered diagrams", () => {
    expect(MERMAID_INIT_SCRIPT).toContain("data-mermaid-rendered");
  });
});
