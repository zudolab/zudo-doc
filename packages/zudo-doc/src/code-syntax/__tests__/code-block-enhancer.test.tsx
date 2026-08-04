/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { CodeBlockEnhancer } from "../code-block-enhancer.js";
import {
  CODE_BLOCK_ENHANCER_SCRIPT,
  CODE_BLOCK_ENHANCER_SELECTOR,
  CODE_WRAP_STORAGE_KEY,
  HIGHLIGHTED_CODE_BLOCK_SELECTOR,
} from "../code-block-enhancer-script.js";
import {
  AFTER_NAVIGATE_EVENT,
  BEFORE_NAVIGATE_EVENT,
} from "../../transitions/page-events.js";

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

  it("targets current highlighted pre elements only", () => {
    expect(HIGHLIGHTED_CODE_BLOCK_SELECTOR).toBe("pre.hi-root");
    expect(CODE_BLOCK_ENHANCER_SELECTOR).not.toContain("syntect-");
    expect(CODE_BLOCK_ENHANCER_SCRIPT).not.toContain("syntect-");
  });

  it("also targets bare <pre> inside tab panels", () => {
    expect(CODE_BLOCK_ENHANCER_SELECTOR).toBe(
      `${HIGHLIGHTED_CODE_BLOCK_SELECTOR}, .tab-panel pre`,
    );
  });

  it("does not broaden enhancement to unrelated plain pre elements", () => {
    expect(CODE_BLOCK_ENHANCER_SELECTOR.split(", ")).not.toContain("pre");
    expect(CODE_BLOCK_ENHANCER_SCRIPT).toContain(
      JSON.stringify(CODE_BLOCK_ENHANCER_SELECTOR),
    );
  });

  it("remains valid browser JavaScript", () => {
    expect(() => new Function(CODE_BLOCK_ENHANCER_SCRIPT)).not.toThrow();
  });

  it("uses ResizeObserver for overflow detection", () => {
    expect(CODE_BLOCK_ENHANCER_SCRIPT).toContain("ResizeObserver");
  });

  it("persists the wrap preference under the session-scoped key", () => {
    // Behaviour is covered in code-block-wrap-persistence.test.ts; this
    // pins the storage key itself, which is the compatibility surface —
    // renaming it silently drops every user's remembered preference.
    expect(CODE_WRAP_STORAGE_KEY).toBe("zudo-doc-code-wrap");
    expect(CODE_BLOCK_ENHANCER_SCRIPT).toContain(
      JSON.stringify(CODE_WRAP_STORAGE_KEY),
    );
    expect(CODE_BLOCK_ENHANCER_SCRIPT).toContain("sessionStorage");
    expect(CODE_BLOCK_ENHANCER_SCRIPT).not.toContain("localStorage");
  });
});
