// Snapshot guard for the @takazudo/zudo-doc --zdc-* component token registry.
//
// Locks the token keyset (cssVar, selector, property, default, component,
// surface, category) so adding, removing, or renaming a token breaks this test
// until the snapshot is intentionally updated with `vitest run --update-snapshots`.
//
// This test imports from the compiled dist entry (the public subpath) so it
// also verifies the ./component-tokens subpath wiring is correct — if the
// dist/config/component-tokens.{js,d.ts} file is absent the import itself
// will fail before any assertion runs.

import { describe, it, expect } from "vitest";
import { COMPONENT_TOKENS } from "../config/component-tokens.js";

describe("COMPONENT_TOKENS keyset snapshot", () => {
  it("matches the frozen token registry (cssVar + selector + property + default)", () => {
    // Snapshot the full keyset — each field that a consumer may depend on.
    // Any addition, removal, or rename will break this test.
    const snapshot = COMPONENT_TOKENS.map((t) => ({
      cssVar: t.cssVar,
      selector: t.selector,
      property: t.property,
      default: t.default,
      component: t.component,
      surface: t.surface,
      category: t.category,
    }));

    expect(snapshot).toMatchInlineSnapshot(`
      [
        {
          "category": "typography",
          "component": "doc-title",
          "cssVar": "--zdc-doc-title-font",
          "default": "inherit",
          "property": "font-family",
          "selector": "h1.text-heading",
          "surface": "content",
        },
        {
          "category": "typography",
          "component": "doc-title",
          "cssVar": "--zdc-doc-title-weight",
          "default": "var(--font-weight-bold)",
          "property": "font-weight",
          "selector": "h1.text-heading",
          "surface": "content",
        },
        {
          "category": "typography",
          "component": "doc-title",
          "cssVar": "--zdc-doc-title-tracking",
          "default": "var(--tracking-normal)",
          "property": "letter-spacing",
          "selector": "h1.text-heading",
          "surface": "content",
        },
        {
          "category": "typography",
          "component": "heading-h2",
          "cssVar": "--zdc-doc-h2-font",
          "default": "inherit",
          "property": "font-family",
          "selector": "h2.text-title",
          "surface": "content",
        },
        {
          "category": "typography",
          "component": "heading-h2",
          "cssVar": "--zdc-doc-h2-weight",
          "default": "var(--font-weight-bold)",
          "property": "font-weight",
          "selector": "h2.text-title",
          "surface": "content",
        },
        {
          "category": "typography",
          "component": "heading-h2",
          "cssVar": "--zdc-doc-h2-tracking",
          "default": "var(--tracking-normal)",
          "property": "letter-spacing",
          "selector": "h2.text-title",
          "surface": "content",
        },
        {
          "category": "typography",
          "component": "heading-h3",
          "cssVar": "--zdc-doc-h3-weight",
          "default": "var(--font-weight-bold)",
          "property": "font-weight",
          "selector": "h3.text-body.font-bold",
          "surface": "content",
        },
        {
          "category": "typography",
          "component": "heading-h4",
          "cssVar": "--zdc-doc-h4-weight",
          "default": "var(--font-weight-semibold)",
          "property": "font-weight",
          "selector": "h4.text-body.font-semibold",
          "surface": "content",
        },
        {
          "category": "typography",
          "component": "doc-prose",
          "cssVar": "--zdc-doc-prose-font",
          "default": "var(--font-sans)",
          "property": "font-family",
          "selector": ".zd-content",
          "surface": "content",
        },
        {
          "category": "typography",
          "component": "content-link",
          "cssVar": "--zdc-doc-link-decoration",
          "default": "underline",
          "property": "text-decoration",
          "selector": "a.text-accent.underline",
          "surface": "content",
        },
        {
          "category": "shape",
          "component": "admonition",
          "cssVar": "--zdc-admonition-radius",
          "default": "0 var(--radius-DEFAULT) var(--radius-DEFAULT) 0",
          "property": "border-radius",
          "selector": "[data-admonition]",
          "surface": "content",
        },
        {
          "category": "shape",
          "component": "admonition",
          "cssVar": "--zdc-admonition-border-width",
          "default": "4px",
          "property": "border-left-width",
          "selector": "[data-admonition]",
          "surface": "content",
        },
      ]
    `);
  });

  it("contains exactly 12 tokens in the Wave 5 registry", () => {
    expect(COMPONENT_TOKENS).toHaveLength(12);
  });

  it("every cssVar follows the --zdc- prefix convention", () => {
    for (const token of COMPONENT_TOKENS) {
      expect(token.cssVar).toMatch(/^--zdc-/);
    }
  });

  it("every token declares a valid surface (content or chrome)", () => {
    for (const token of COMPONENT_TOKENS) {
      expect(["content", "chrome"]).toContain(token.surface);
    }
  });

  it("all current Wave 5 tokens are content-surface", () => {
    for (const token of COMPONENT_TOKENS) {
      expect(token.surface).toBe("content");
    }
  });

  it("every default chains to a token or inherit — never a bare literal color/size", () => {
    for (const token of COMPONENT_TOKENS) {
      // Preferred: "inherit" or a var() reference (including multi-value defaults
      // that contain var() like "0 var(--radius-DEFAULT) var(--radius-DEFAULT) 0").
      // Documented exceptions (#2460): CSS keywords or literals with no token
      // equivalent — "underline" (no text-decoration scale) and "4px" (no
      // border-width scale). Bare hex colors and named CSS colors remain forbidden.
      const isAllowed =
        token.default === "inherit" ||
        token.default.includes("var(") ||
        token.default === "underline" ||
        token.default === "4px";
      expect(isAllowed).toBe(true);
    }
  });
});
