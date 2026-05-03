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
});

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
