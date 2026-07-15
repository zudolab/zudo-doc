import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_SOURCE = resolve(__dirname, "../features.css");
const css = readFileSync(CSS_SOURCE, "utf8");

const bridgeMarker = "/* zfb's default class-mode stylesheet";
const bridgeStart = css.indexOf(bridgeMarker);
const bridgeRootStart = css.indexOf(":root {", bridgeStart);
const bridgeEnd = css.indexOf("\n}", bridgeRootStart) + 2;
const highlightBridge = css.slice(bridgeStart, bridgeEnd);
const highlightBridgeRules = css.slice(bridgeRootStart, bridgeEnd);

function bridgeValue(name: string): string | undefined {
  return highlightBridge
    .match(new RegExp(`${name.replaceAll("-", "\\-")}:\\s*([^;]+);`))?.[1]
    ?.replace(/\s+/g, " ")
    .trim();
}

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

  it("bridges all 18 zfb roles onto the compact zudo syntax semantics", () => {
    const roles = {
      esc: "var(--zd-syntax-string)",
      op: "var(--zd-code-fg)",
      com: "var(--zd-syntax-comment)",
      str: "var(--zd-syntax-string)",
      num: "var(--zd-syntax-number)",
      const: "var(--zd-syntax-number)",
      kw: "var(--zd-syntax-keyword)",
      fn: "var(--zd-syntax-callable)",
      ty: "var(--zd-syntax-type)",
      ns: "var(--zd-syntax-type)",
      prop: "var(--zd-syntax-name)",
      var: "var(--zd-syntax-name)",
      tag: "var(--zd-syntax-name)",
      attr: "var(--zd-syntax-name)",
      punct: "var(--zd-code-fg)",
      ins: "var(--zd-syntax-inserted)",
      del: "var(--zd-syntax-deleted)",
      hd: "var(--zd-syntax-keyword)",
    } as const;

    expect(Object.keys(roles)).toHaveLength(18);
    for (const [suffix, value] of Object.entries(roles)) {
      expect(bridgeValue(`--zfb-hi-${suffix}`)).toBe(value);
    }
  });

  it("bridges class-mode roots and diff backgrounds without raw colors", () => {
    expect(highlightBridgeRules.match(/--zfb-hi-[\w-]+:/g)).toHaveLength(22);
    expect(bridgeValue("--zfb-hi-fg")).toBe("var(--zd-code-fg)");
    expect(bridgeValue("--zfb-hi-bg")).toBe("var(--zd-code-bg)");
    expect(bridgeValue("--zfb-hi-ins-bg")).toBe(
      "color-mix( in srgb, var(--zd-syntax-inserted) 15%, var(--zd-code-bg) )",
    );
    expect(bridgeValue("--zfb-hi-del-bg")).toBe(
      "color-mix( in srgb, var(--zd-syntax-deleted) 15%, var(--zd-code-bg) )",
    );
    expect(highlightBridge).not.toMatch(/#[\da-f]{3,8}\b/i);
    expect(highlightBridge).not.toMatch(/\b(?:oklch|rgba?|hsla?)\(/i);
    expect(highlightBridge).not.toContain("!important");
    expect(highlightBridgeRules).not.toContain("@layer");
  });

  it("keeps Shiki compatibility colors scoped away from class output", () => {
    expect(css).toContain('[data-theme] pre[class*="syntect-"] span');
    expect(css).toContain("color: light-dark(var(--shiki-light)");
    expect(css).not.toMatch(
      /\[data-theme\][^{]*hi-root[^{]*\{[^}]*--shiki-/s,
    );
  });
});
