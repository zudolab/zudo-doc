import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_SOURCE = resolve(__dirname, "../features.css");
const css = readFileSync(CSS_SOURCE, "utf8");

describe("src/features.css source contract", () => {
  it("keeps the default header on an opaque surface layer", () => {
    expect(css).toContain("header[data-header]");
    expect(css).toContain("background-color: var(--color-surface, var(--color-bg));");
  });

  it("keeps the default header above scrolling page content", () => {
    expect(css).toContain("z-index: var(--z-index-toolbar, 20);");
  });

  it("styles both highlighted block shapes without matching every pre", () => {
    const highlightedPre = ':is(pre.hi-root, pre[class*="syntect-"])';

    expect(css).toContain(
      `${highlightedPre} [data-line-highlight="true"]`,
    );
    expect(css).toContain(`${highlightedPre} .line .highlighted-word`);
    expect(css).toContain(`.code-block-container ${highlightedPre}`);
    expect(css).not.toContain('pre[class^="syntect-"]');
  });

  it("applies word wrapping to highlighted blocks and raw tab fallbacks", () => {
    const enhanceablePre =
      ':is(pre.hi-root, pre[class*="syntect-"], .tab-panel pre)';

    expect(css).toContain(`${enhanceablePre}.word-wrap {`);
    expect(css).toContain(`${enhanceablePre}.word-wrap code {`);
  });

  it("keeps variable-based token colors scoped away from class output", () => {
    expect(css).toContain('[data-theme] pre[class*="syntect-"] span');
    expect(css).toContain("color: light-dark(var(--shiki-light)");
    expect(css).not.toMatch(
      /\[data-theme\][^{]*hi-root[^{]*\{[^}]*--shiki-/s,
    );
  });
});
