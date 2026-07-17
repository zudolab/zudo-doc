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
        {
          "category": "shape",
          "component": "card-grid",
          "cssVar": "--zdc-card-radius",
          "default": "var(--zdc-surface-radius, var(--radius-DEFAULT))",
          "property": "border-radius",
          "selector": "a.group.block.rounded",
          "surface": "chrome",
        },
        {
          "category": "layout",
          "component": "doc-content-band",
          "cssVar": "--zdc-content-max-width",
          "default": "clamp(50rem,75vw,90rem)",
          "property": "max-width",
          "selector": ".zd-doc-content-band",
          "surface": "chrome",
        },
        {
          "category": "layout",
          "component": "toc",
          "cssVar": "--zdc-toc-width",
          "default": "280px",
          "property": "width",
          "selector": "nav[data-zd-toc]",
          "surface": "chrome",
        },
        {
          "category": "typography",
          "component": "nav-active",
          "cssVar": "--zdc-nav-active-indicator-color",
          "default": "var(--color-fg)",
          "property": "background-color",
          "selector": "a[data-nav-active]",
          "surface": "chrome",
        },
        {
          "category": "typography",
          "component": "nav-active",
          "cssVar": "--zdc-nav-active-weight",
          "default": "var(--font-weight-medium)",
          "property": "font-weight",
          "selector": "a[data-nav-active]",
          "surface": "chrome",
        },
        {
          "category": "typography",
          "component": "chrome",
          "cssVar": "--zdc-chrome-font",
          "default": "var(--font-sans)",
          "property": "font-family",
          "selector": "body",
          "surface": "chrome",
        },
        {
          "category": "typography",
          "component": "header",
          "cssVar": "--zdc-header-font",
          "default": "var(--zdc-chrome-font, var(--font-sans))",
          "property": "font-family",
          "selector": "header[data-header]",
          "surface": "chrome",
        },
        {
          "category": "typography",
          "component": "sidebar",
          "cssVar": "--zdc-sidebar-font",
          "default": "var(--zdc-chrome-font, var(--font-sans))",
          "property": "font-family",
          "selector": "#desktop-sidebar, aside[data-zd-mobile-sidebar]",
          "surface": "chrome",
        },
        {
          "category": "typography",
          "component": "toc",
          "cssVar": "--zdc-toc-font",
          "default": "var(--zdc-chrome-font, var(--font-sans))",
          "property": "font-family",
          "selector": "nav[data-zd-toc], div[data-zd-mobile-toc]",
          "surface": "chrome",
        },
      ]
    `);
  });

  it("contains exactly 21 tokens in the #2887 registry (12 content + 9 chrome)", () => {
    expect(COMPONENT_TOKENS).toHaveLength(21);
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

  it("12 content tokens and 9 chrome tokens (#2887 adds the body font seam + 3 per-surface knobs)", () => {
    const contentTokens = COMPONENT_TOKENS.filter((t) => t.surface === "content");
    const chromeTokens = COMPONENT_TOKENS.filter((t) => t.surface === "chrome");
    expect(contentTokens).toHaveLength(12);
    expect(chromeTokens).toHaveLength(9);
  });

  // The seam that makes theme-pack fonts reach the app shell (#2887 / epic
  // #2886). Without a `body` rule pointing at the token, header/sidebar/TOC/
  // footer inherit Tailwind preflight's hardcoded literal stack and a pack's
  // `--font-sans` override is unreachable. Pinned here so a future edit cannot
  // quietly retarget or drop it.
  it("--zdc-chrome-font is the body-level font seam defaulting to var(--font-sans)", () => {
    const seam = COMPONENT_TOKENS.find((t) => t.cssVar === "--zdc-chrome-font");
    expect(seam).toBeDefined();
    expect(seam?.selector).toBe("body");
    expect(seam?.property).toBe("font-family");
    expect(seam?.default).toBe("var(--font-sans)");
    expect(seam?.surface).toBe("chrome");
  });

  // Each per-surface font knob must cover BOTH its desktop and mobile emitter,
  // so one consumer override lands on both viewports. The mobile TOC in
  // particular does NOT reuse `nav[data-zd-toc]` — it emits its own <div>.
  it("per-surface chrome font knobs cover both the desktop and mobile emitters", () => {
    const bySurface = (name: string) =>
      COMPONENT_TOKENS.find((t) => t.cssVar === name)?.selector;

    expect(bySurface("--zdc-sidebar-font")).toContain("#desktop-sidebar");
    expect(bySurface("--zdc-sidebar-font")).toContain("[data-zd-mobile-sidebar]");
    expect(bySurface("--zdc-toc-font")).toContain("nav[data-zd-toc]");
    expect(bySurface("--zdc-toc-font")).toContain("[data-zd-mobile-toc]");
  });

  it("every default chains to a token or inherit — never a bare literal color/size", () => {
    for (const token of COMPONENT_TOKENS) {
      // Preferred: "inherit" or a var() reference (including multi-value defaults
      // that contain var() like "0 var(--radius-DEFAULT) var(--radius-DEFAULT) 0").
      // Documented exceptions:
      //   - "underline" (#2460): no text-decoration scale token exists.
      //   - "4px" (#2460): no border-width scale token exists.
      //   - "280px" (#2461): no fixed-width token exists for the TOC width.
      //   - clamp(...) expressions (#2461): no design token for the content band
      //     clamp expression; bare CSS function is the documented exception.
      // Bare hex colors and named CSS colors remain forbidden.
      const isAllowed =
        token.default === "inherit" ||
        token.default.includes("var(") ||
        token.default === "underline" ||
        token.default === "4px" ||
        token.default === "280px" ||
        token.default.startsWith("clamp(");
      expect(isAllowed).toBe(true);
    }
  });
});
