/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// head-with-defaults theme-pack emission tests (ADR
// `docs/adr/theme-packs.md` Decision 3; #2822).
//
// The ADR's "Ordering note (MUST-verify in #2822)": assert the theme-pack
// provider renders IMMEDIATELY AFTER <ColorSchemeProvider/> in the
// head-with-defaults output, and that the emitted bootstrap contains the
// document.write + noscript shapes.

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { createHeadWithDefaults } from "../index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import type { ThemePackRegistry } from "../../theme-packs-registry/index.js";

const REGISTRY = [
  { slug: "default", meta: { version: "0.0.0" }, hasStylesheet: false },
  { slug: "foundry", meta: { version: "1.2.3" }, hasStylesheet: true },
] as unknown as ThemePackRegistry;

// Distinct substring markers: the color-scheme bootstrap pins its storage key
// as `STORAGE_KEY="zudo-doc-theme"`, the theme-pack bootstrap as
// `KEY="zudo-doc-theme-pack"` — beware "zudo-doc-theme" being a prefix of
// "zudo-doc-theme-pack" (the exact `STORAGE_KEY=` form disambiguates).
const COLOR_SCHEME_MARKER = 'STORAGE_KEY="zudo-doc-theme"';
const THEME_PACK_MARKER = 'KEY="zudo-doc-theme-pack"';

function makeCtx(overrides: {
  themePackRegistry?: ThemePackRegistry | null;
  themePack?: string;
}) {
  return makeFakeChromeContext({
    settings: {
      // colorMode on → ColorSchemeProvider emits its bootstrap script, so the
      // ordering of the two inline scripts is assertable.
      colorMode: { defaultMode: "light", respectPrefersColorScheme: false },
      ...(overrides.themePack !== undefined ? { themePack: overrides.themePack } : {}),
    },
    overrides: {
      themePackRegistry: overrides.themePackRegistry ?? null,
    },
  });
}

describe("HeadWithDefaults — theme-pack bootstrap emission", () => {
  it("renders the theme-pack bootstrap IMMEDIATELY AFTER the ColorSchemeProvider output", () => {
    const ctx = makeCtx({ themePackRegistry: REGISTRY });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);

    const colorSchemeIdx = out.indexOf(COLOR_SCHEME_MARKER);
    const themePackIdx = out.indexOf(THEME_PACK_MARKER);
    expect(colorSchemeIdx).toBeGreaterThan(-1);
    expect(themePackIdx).toBeGreaterThan(colorSchemeIdx);
    // "Immediately after": nothing but the script boundary sits between the
    // color-scheme bootstrap's closing </script> and the theme-pack script.
    const between = out.slice(
      out.indexOf("</script>", colorSchemeIdx) + "</script>".length,
      out.lastIndexOf("<script>", themePackIdx),
    );
    expect(between).toBe("");
  });

  it("inlines the enabled {slug → version} map and the base prefix", () => {
    const ctx = makeCtx({ themePackRegistry: REGISTRY, themePack: "foundry" });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);

    expect(out).toContain('{"default":"0.0.0","foundry":"1.2.3"}');
    expect(out).toContain('var configured="foundry"');
    expect(out).toContain('var base="/"');
    // Non-default configured pack → noscript fallback for the no-JS path.
    expect(out).toContain(
      '<noscript><link rel="stylesheet" href="/theme-packs/foundry/pack.css?v=1.2.3"/></noscript>',
    );
  });

  it("omits the noscript fallback when the configured pack is default", () => {
    const ctx = makeCtx({ themePackRegistry: REGISTRY });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);

    expect(out).toContain(THEME_PACK_MARKER);
    expect(out).not.toContain("<noscript>");
  });

  it("emits NOTHING theme-pack related when the registry was not threaded (feature inert)", () => {
    const ctx = makeCtx({ themePackRegistry: null, themePack: "foundry" });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);

    expect(out).not.toContain(THEME_PACK_MARKER);
    expect(out).not.toContain("theme-packs/");
    // The pre-existing color-scheme output is unaffected.
    expect(out).toContain(COLOR_SCHEME_MARKER);
  });
});
