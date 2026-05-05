/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { MermaidInit } from "../mermaid-init";
import {
  MERMAID_INIT_SCRIPT,
  MERMAID_CDN_MODULE_URL,
  buildMermaidInitScript,
} from "../mermaid-init-script";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/page-events";

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

  it("script hooks into the v2 after-navigate event for view transitions", () => {
    // After zudolab/zudo-doc#1335 (E2 task 2 half B) the script reads
    // event names from `transitions/page-events.ts` rather than hard-
    // coded `astro:*` literals.
    const html = render(<MermaidInit />);
    expect(html).toContain(JSON.stringify(AFTER_NAVIGATE_EVENT));
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

  it("lazily imports mermaid via dynamic import to a CDN URL (not the bare specifier)", () => {
    // Wave 13 (zudolab/zudo-doc#1355 Topic 4): the bare `import("mermaid")`
    // form fails at runtime under zfb because the inline <script> has no
    // bundler in the path to resolve the specifier. The script must
    // import from the configured CDN URL instead.
    expect(MERMAID_INIT_SCRIPT).toContain(
      `import(${JSON.stringify(MERMAID_CDN_MODULE_URL)})`,
    );
    expect(MERMAID_INIT_SCRIPT).not.toContain('import("mermaid")');
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

  // zudolab/zudo-doc#1458 — khroma 2.1.0 (mermaid 11.4.1's transitive
  // dep) does not understand the CSS `light-dark()` function. CSS
  // custom properties on `:root` are written as
  // `light-dark(#hex-light, #hex-dark)` when colorMode is enabled
  // (see `generateLightDarkCssProperties` in
  // `src/config/color-scheme-utils.ts`), and `getPropertyValue` returns
  // them as the literal string. The init script must syntactically
  // parse `light-dark(...)` and pick the matching arg from
  // `document.documentElement.dataset.theme` BEFORE any value reaches
  // mermaid — relying on the browser to resolve `light-dark()` via the
  // temp-element trick was unreliable in production.
  it("parses CSS light-dark(...) syntactically against data-theme", () => {
    expect(MERMAID_INIT_SCRIPT).toContain("parseLightDark");
    expect(MERMAID_INIT_SCRIPT).toContain("light-dark(");
    // Reads the theme attribute that the color-scheme-provider bootstrap
    // sets on `:root` (see packages/zudo-doc-v2/src/theme/color-scheme-provider.tsx).
    expect(MERMAID_INIT_SCRIPT).toContain("data-theme");
  });

  it("parseLightDark picks the light arg when data-theme=light", () => {
    // Extract the parser body from the inline script and exercise it
    // in a sandbox so the runtime branch is unit-tested, not just
    // string-matched. The function signature `parseLightDark(raw, theme)`
    // is the public contract used by the value-reader `v()`.
    const fn = extractParseLightDark(MERMAID_INIT_SCRIPT);
    expect(fn("light-dark(#abcdef, #123456)", "light")).toBe("#abcdef");
    expect(fn("light-dark(#abcdef, #123456)", "dark")).toBe("#123456");
    // Whitespace tolerance — `generateLightDarkCssProperties` emits
    // `light-dark(#a, #b)` with a single space, but a future formatter
    // change could add more.
    expect(fn("light-dark( #ff0000 , #00ff00 )", "light")).toBe("#ff0000");
    expect(fn("light-dark( #ff0000 , #00ff00 )", "dark")).toBe("#00ff00");
  });

  it("parseLightDark returns null for non-light-dark inputs", () => {
    const fn = extractParseLightDark(MERMAID_INIT_SCRIPT);
    expect(fn("#abcdef", "light")).toBeNull();
    expect(fn("rgb(1, 2, 3)", "dark")).toBeNull();
    expect(fn("", "light")).toBeNull();
  });

  it("parseLightDark falls back to the light arg when theme is unknown", () => {
    // `data-theme` may be missing on first paint (before the bootstrap
    // script runs) — pick the light arg as a deterministic default
    // rather than returning null and forcing the caller to handle it.
    const fn = extractParseLightDark(MERMAID_INIT_SCRIPT);
    expect(fn("light-dark(#abcdef, #123456)", undefined)).toBe("#abcdef");
    expect(fn("light-dark(#abcdef, #123456)", "")).toBe("#abcdef");
    expect(fn("light-dark(#abcdef, #123456)", "auto")).toBe("#abcdef");
  });

  it("re-renders diagrams when the data-theme attribute changes", () => {
    // The theme-toggle island flips `:root[data-theme]` between
    // `"light"` and `"dark"`. Mermaid's resolved theme colors are
    // baked into the rendered SVG, so the script must re-run
    // `mermaid.initialize` + clear `data-mermaid-rendered` on the
    // attribute change.
    expect(MERMAID_INIT_SCRIPT).toContain('"data-theme"');
    // Either a separate observer or an extended attributeFilter that
    // covers `data-theme`.
    const observesDataTheme =
      /attributeFilter\s*:\s*\[[^\]]*"data-theme"[^\]]*\]/.test(
        MERMAID_INIT_SCRIPT,
      );
    expect(observesDataTheme).toBe(true);
  });
});

/**
 * Pull the inline `parseLightDark` function out of the IIFE-wrapped
 * init script and return it as a callable function. Lets the parser's
 * runtime branches be unit-tested directly, instead of only
 * string-matched.
 */
function extractParseLightDark(
  script: string,
): (raw: string, theme: string | undefined) => string | null {
  // The function body is a top-level declaration inside the IIFE, so a
  // straightforward `function parseLightDark(...) { ... }` capture
  // works. We re-emit it as an expression for `new Function` so the
  // function value is returned without polluting any global.
  const match = script.match(
    /function\s+parseLightDark\s*\([^)]*\)\s*\{[\s\S]*?\n\s{2}\}/,
  );
  if (!match) {
    throw new Error("parseLightDark not found in MERMAID_INIT_SCRIPT");
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(`${match[0]}\nreturn parseLightDark;`)() as (
    raw: string,
    theme: string | undefined,
  ) => string | null;
}

describe("MERMAID_CDN_MODULE_URL", () => {
  it("is an https ESM CDN URL pinned to a major version", () => {
    expect(MERMAID_CDN_MODULE_URL).toMatch(/^https:\/\//);
    // Must encode some version pin (major-only `@11`, exact `@11.x.y`,
    // or range `@11.x`) so the runtime resolution can't drift across a
    // mermaid major bump.
    expect(MERMAID_CDN_MODULE_URL).toMatch(/mermaid@\d+/);
  });
});

describe("buildMermaidInitScript / cdnUrl override", () => {
  it("interpolates the supplied URL into the dynamic import", () => {
    // Codex review surfaced that the public override knob has to
    // actually take effect — exporting `MERMAID_CDN_MODULE_URL` alone
    // is ineffective because the script string is frozen at module
    // load. The builder rebuilds the script with the caller's URL.
    const customUrl = "https://example.test/internal-mirror/mermaid.mjs";
    const built = buildMermaidInitScript(customUrl);
    expect(built).toContain(`import(${JSON.stringify(customUrl)})`);
    expect(built).not.toContain(JSON.stringify(MERMAID_CDN_MODULE_URL));
  });

  it("the default-URL constant is built via the same builder for parity", () => {
    expect(MERMAID_INIT_SCRIPT).toBe(
      buildMermaidInitScript(MERMAID_CDN_MODULE_URL),
    );
  });

  it("<MermaidInit cdnUrl=… /> emits a script with the supplied URL", () => {
    const customUrl = "https://example.test/cdn/mermaid";
    const html = render(<MermaidInit cdnUrl={customUrl} />);
    expect(html).toContain(`import(${JSON.stringify(customUrl)})`);
    expect(html).not.toContain(JSON.stringify(MERMAID_CDN_MODULE_URL));
  });

  it("<MermaidInit script=… /> wins over cdnUrl when both are passed", () => {
    const customUrl = "https://example.test/cdn/mermaid";
    const customScript = `(function(){/* sentinel-${Math.random()} */})();`;
    const html = render(
      <MermaidInit script={customScript} cdnUrl={customUrl} />,
    );
    expect(html).toContain(customScript);
    expect(html).not.toContain(`import(${JSON.stringify(customUrl)})`);
  });

  it("escapes literal </script> sequences inside the cdnUrl", () => {
    // Defense-in-depth: if a developer ever passes a URL containing
    // `</script>` (or even just `</script` as a substring), the inline
    // <script> tag carrying the init body would otherwise be torn
    // apart by the HTML parser. The builder rewrites `</script` to
    // `<\/script` in the JS string literal so the JS lexer collapses
    // it back to the right URL but the HTML parser never sees the
    // closing tag pattern.
    const malicious = "https://evil.test/</script><img src=x onerror=alert(1)>";
    const built = buildMermaidInitScript(malicious);
    expect(built).not.toContain("</script>");
    expect(built).not.toContain("</script");
    expect(built).toContain("<\\/script");
  });
});
