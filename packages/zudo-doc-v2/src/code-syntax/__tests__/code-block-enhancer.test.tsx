/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { CodeBlockEnhancer } from "../code-block-enhancer";
import { CODE_BLOCK_ENHANCER_SCRIPT } from "../code-block-enhancer-script";
import {
  AFTER_NAVIGATE_EVENT,
  BEFORE_NAVIGATE_EVENT,
} from "../../transitions/page-events";

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

  it("script hooks into the v2 after-navigate event for view transitions", () => {
    // After zudolab/zudo-doc#1335 (E2 task 2 half B) the script reads
    // event names from `transitions/page-events.ts` rather than hard-
    // coded `astro:*` literals.
    const html = render(<CodeBlockEnhancer />);
    expect(html).toContain(JSON.stringify(AFTER_NAVIGATE_EVENT));
  });

  it("script cleans up before navigating away", () => {
    const html = render(<CodeBlockEnhancer />);
    expect(html).toContain(JSON.stringify(BEFORE_NAVIGATE_EVENT));
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
