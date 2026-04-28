/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { CodeBlockEnhancer } from "../code-block-enhancer";
import { CODE_BLOCK_ENHANCER_SCRIPT } from "../code-block-enhancer-script";

describe("<CodeBlockEnhancer />", () => {
  it("renders the screen-reader announce region", () => {
    const html = render(<CodeBlockEnhancer />);
    expect(html).toContain('class="code-block-sr-announce"');
    expect(html).toContain('aria-live="polite"');
  });

  it("renders a <script> tag with the init script", () => {
    const html = render(<CodeBlockEnhancer />);
    expect(html).toContain("<script");
    // The script content should be present (not escaped as HTML entities).
    expect(html).toContain("enhanceCodeBlocks");
    expect(html).toContain("code-block-wrapper");
  });

  it("script contains copy and wrap button creation logic", () => {
    const html = render(<CodeBlockEnhancer />);
    expect(html).toContain("createCopyButton");
    expect(html).toContain("createWrapButton");
    expect(html).toContain("code-btn-copy");
    expect(html).toContain("code-btn-wrap");
  });

  it("script hooks into astro:page-load for view transitions", () => {
    const html = render(<CodeBlockEnhancer />);
    expect(html).toContain("astro:page-load");
  });

  it("script cleans up before page swap", () => {
    const html = render(<CodeBlockEnhancer />);
    expect(html).toContain("astro:before-swap");
  });
});

describe("CODE_BLOCK_ENHANCER_SCRIPT", () => {
  it("is a non-empty string", () => {
    expect(typeof CODE_BLOCK_ENHANCER_SCRIPT).toBe("string");
    expect(CODE_BLOCK_ENHANCER_SCRIPT.length).toBeGreaterThan(0);
  });

  it("wraps the logic in an IIFE", () => {
    expect(CODE_BLOCK_ENHANCER_SCRIPT).toMatch(/^\(function\s*\(\)/);
    expect(CODE_BLOCK_ENHANCER_SCRIPT.trimEnd()).toMatch(/\)\(\);$/);
  });

  it("targets pre.astro-code elements", () => {
    expect(CODE_BLOCK_ENHANCER_SCRIPT).toContain("pre.astro-code");
  });

  it("uses ResizeObserver for overflow detection", () => {
    expect(CODE_BLOCK_ENHANCER_SCRIPT).toContain("ResizeObserver");
  });
});
