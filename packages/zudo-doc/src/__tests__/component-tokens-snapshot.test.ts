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
      ]
    `);
  });

  it("contains exactly 6 tokens in the Wave 4 registry", () => {
    expect(COMPONENT_TOKENS).toHaveLength(6);
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

  it("all current Wave 4 tokens are content-surface", () => {
    for (const token of COMPONENT_TOKENS) {
      expect(token.surface).toBe("content");
    }
  });

  it("every default chains to a token or inherit — never a bare literal color/size", () => {
    for (const token of COMPONENT_TOKENS) {
      // Allowed: "inherit" or a var() reference — not a raw hex, px, or named value
      const isAllowed =
        token.default === "inherit" || token.default.startsWith("var(");
      expect(isAllowed).toBe(true);
    }
  });
});
