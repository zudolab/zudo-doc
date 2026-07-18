import { describe, it, expect } from "vitest";
import { validateThemePack, type ThemePackValidationInput } from "../validator.js";

const VALID_FOUNDRY_META = {
  schemaVersion: 1,
  slug: "foundry",
  name: "Foundry",
  description: "GitHub-neutral baseline.",
  mode: "light",
  version: "1.0.0",
  fonts: {
    sans: "Inter",
    mono: "System",
    loaded: ["Inter"],
  },
  preview: {
    light: {
      bg: "#ffffff",
      fg: "#1f2328",
      accent: "#0969da",
      syntax: { keyword: "#cf222e", string: "#0a3069", comment: "#6e7781", callable: "#8250df" },
    },
    dark: {
      bg: "#0d1117",
      fg: "#e6edf3",
      accent: "#4493f8",
      syntax: { keyword: "#ff7b72", string: "#a5d6ff", comment: "#8b949e", callable: "#d2a8ff" },
    },
  },
};

const VALID_FOUNDRY_CSS = `
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url("./fonts/Inter-latin.woff2") format("woff2");
}
html[data-theme-pack="foundry"] {
  --zd-bg: light-dark(#ffffff, #0d1117);
  --zd-accent: light-dark(#0969da, #4493f8);
  --font-sans: "Inter", system-ui, sans-serif;
}
html[data-theme-pack="foundry"] header[data-header] {
  background: var(--zd-surface);
}
`;

function baseInput(overrides: Partial<ThemePackValidationInput> = {}): ThemePackValidationInput {
  return {
    dirName: "foundry",
    metaRaw: VALID_FOUNDRY_META,
    cssContent: VALID_FOUNDRY_CSS,
    fontFiles: ["Inter-latin.woff2", "OFL.txt"],
    ...overrides,
  };
}

describe("validateThemePack", () => {
  it("accepts a well-formed non-default pack", () => {
    const result = validateThemePack(baseInput());
    expect(result.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.meta?.slug).toBe("foundry");
  });

  it("accepts the reserved default pack (meta.json only, no pack.css)", () => {
    const result = validateThemePack({
      dirName: "default",
      metaRaw: {
        schemaVersion: 1,
        slug: "default",
        name: "Default",
        description: "Stock look.",
        mode: "dark",
        version: "1.0.0",
        fonts: { sans: "System", mono: "System", loaded: [] },
        preview: {
          light: {
            bg: "oklch(0.965 0.004 65)",
            fg: "oklch(0.185 0.005 65)",
            accent: "oklch(0.47 0.12 56)",
            syntax: {
              keyword: "oklch(0.47 0.12 56)",
              string: "oklch(0.47 0.14 145)",
              comment: "oklch(0.48 0.008 65)",
              callable: "oklch(0.485 0.122 245)",
            },
          },
          dark: {
            bg: "oklch(0.185 0.005 65)",
            fg: "oklch(0.965 0.004 65)",
            accent: "oklch(0.7 0.158 62)",
            syntax: {
              keyword: "oklch(0.7 0.158 62)",
              string: "oklch(0.68 0.145 145)",
              comment: "oklch(0.705 0.008 65)",
              callable: "oklch(0.68 0.13 245)",
            },
          },
        },
      },
      cssContent: null,
      fontFiles: [],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects the default pack shipping a pack.css", () => {
    const result = validateThemePack(
      baseInput({ dirName: "default", metaRaw: { ...VALID_FOUNDRY_META, slug: "default" } }),
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.rule === "css-presence")).toBe(true);
  });

  it("rejects a non-default pack with a missing/empty pack.css", () => {
    expect(validateThemePack(baseInput({ cssContent: null })).valid).toBe(false);
    expect(validateThemePack(baseInput({ cssContent: "   " })).valid).toBe(false);
  });

  it("rejects a directory name that doesn't match the slug pattern", () => {
    const result = validateThemePack(baseInput({ dirName: "Foundry!" }));
    expect(result.issues.some((i) => i.rule === "slug-dir-parity")).toBe(true);
  });

  it("rejects meta.slug / directory-name mismatch", () => {
    const result = validateThemePack(
      baseInput({ dirName: "other-slug", metaRaw: { ...VALID_FOUNDRY_META, slug: "foundry" } }),
    );
    expect(result.issues.some((i) => i.rule === "slug-dir-parity")).toBe(true);
  });

  it("rejects a malformed meta.json (schema failure) and omits `meta` from the result", () => {
    const result = validateThemePack(baseInput({ metaRaw: { schemaVersion: 1 } }));
    expect(result.valid).toBe(false);
    expect(result.meta).toBeUndefined();
    expect(result.issues.some((i) => i.rule === "meta-schema")).toBe(true);
  });

  it("rejects a rule not scoped under html[data-theme-pack=\"<slug>\"]", () => {
    const result = validateThemePack(
      baseInput({
        cssContent: `${VALID_FOUNDRY_CSS}\n.zd-content h2 { color: red; }`,
      }),
    );
    expect(result.issues.some((i) => i.rule === "scoping")).toBe(true);
  });

  it("allows @font-face as the sole unscoped exception", () => {
    // baseInput's CSS already contains an @font-face block with no
    // html[data-theme-pack] scoping — must not itself trigger "scoping".
    const result = validateThemePack(baseInput());
    expect(result.issues.filter((i) => i.rule === "scoping")).toEqual([]);
  });

  it("rejects an unknown custom-property name (typo catch)", () => {
    const result = validateThemePack(
      baseInput({
        cssContent: `html[data-theme-pack="foundry"] { --zd-syntx-keyword: red; --radius: 4px; }`,
      }),
    );
    const unknownRule = result.issues.filter((i) => i.rule === "known-token-names");
    expect(unknownRule.map((i) => i.message).join("\n")).toContain("--zd-syntx-keyword");
    expect(unknownRule.map((i) => i.message).join("\n")).toContain("--radius");
  });

  it("accepts every known --zd-*/--zdc-*/--font-*/--zfb-hi-* token name", () => {
    const result = validateThemePack(
      baseInput({
        cssContent: `html[data-theme-pack="foundry"] {
          --zd-syntax-keyword: light-dark(red, pink);
          --zdc-card-radius: 6px;
          --font-display: "Jost", sans-serif;
          --zfb-hi-str: light-dark(green, lightgreen);
        }`,
      }),
    );
    expect(result.issues.filter((i) => i.rule === "known-token-names")).toEqual([]);
  });

  it("forbids !important except on a border-image declaration", () => {
    const disallowed = validateThemePack(
      baseInput({
        cssContent: `html[data-theme-pack="foundry"] .zd-content h2 { color: red !important; }`,
      }),
    );
    const importantIssues = disallowed.issues.filter((i) => i.rule === "important-allowlist");
    expect(importantIssues).toHaveLength(1);
    expect(importantIssues[0]?.message).toContain(
      "the h2–h4 heading-rule gradient carve-out, Decision 6.6",
    );

    const allowed = validateThemePack(
      baseInput({
        cssContent: `${VALID_FOUNDRY_CSS}\nhtml[data-theme-pack="foundry"] .zd-content h2 { border-image: none !important; }`,
      }),
    );
    expect(allowed.issues.filter((i) => i.rule === "important-allowlist")).toEqual([]);
  });

  it("forbids color-scheme: declarations", () => {
    const result = validateThemePack(
      baseInput({
        cssContent: `html[data-theme-pack="foundry"] { color-scheme: light dark; }`,
      }),
    );
    expect(result.issues.some((i) => i.rule === "no-color-scheme")).toBe(true);
  });

  it("forbids [data-theme] selectors but allows [data-theme-pack]", () => {
    const withDataTheme = validateThemePack(
      baseInput({
        cssContent: `html[data-theme-pack="foundry"] [data-theme="dark"] { color: red; }`,
      }),
    );
    expect(withDataTheme.issues.some((i) => i.rule === "no-data-theme-selector")).toBe(true);

    const withoutDataTheme = validateThemePack(baseInput());
    expect(withoutDataTheme.issues.filter((i) => i.rule === "no-data-theme-selector")).toEqual([]);
  });

  it("requires fonts.loaded <-> @font-face parity (both directions)", () => {
    const missingFontFace = validateThemePack(
      baseInput({
        cssContent: `html[data-theme-pack="foundry"] { --zd-bg: light-dark(#fff, #000); }`,
      }),
    );
    expect(missingFontFace.issues.some((i) => i.rule === "font-face-parity")).toBe(true);

    const extraFontFace = validateThemePack(
      baseInput({
        metaRaw: { ...VALID_FOUNDRY_META, fonts: { ...VALID_FOUNDRY_META.fonts, loaded: [] } },
      }),
    );
    expect(extraFontFace.issues.some((i) => i.rule === "font-face-parity")).toBe(true);
  });

  it("rejects a local @font-face source missing from fontFiles", () => {
    const result = validateThemePack(
      baseInput({
        cssContent: VALID_FOUNDRY_CSS.replace("Inter-latin.woff2", "Missing.woff2"),
      }),
    );
    const issue = result.issues.find((i) => i.rule === "font-file-missing");
    expect(issue?.severity).toBe("error");
    expect(result.valid).toBe(false);
  });

  it("accepts local @font-face sources listed in fontFiles", () => {
    const result = validateThemePack(baseInput());
    expect(result.issues.filter((i) => i.rule === "font-file-missing")).toEqual([]);
  });

  it("skips non-local and cache-busted @font-face sources", () => {
    const cssContent = VALID_FOUNDRY_CSS.replace(
      'url("./fonts/Inter-latin.woff2")',
      [
        'url("data:font/woff2;base64,AA==")',
        'url("https://example.com/Inter.woff2")',
        'url("../fonts/Inter.woff2")',
        'url("./fonts/Inter.woff2?v=1")',
        'url("./fonts/Inter.woff2#variation")',
      ].join(", "),
    );
    const result = validateThemePack(baseInput({ cssContent, fontFiles: [] }));
    expect(result.issues.filter((i) => i.rule === "font-file-missing")).toEqual([]);
  });

  it("requires OFL.txt when font binaries ship", () => {
    const result = validateThemePack(baseInput({ fontFiles: ["Inter-latin.woff2"] }));
    expect(result.issues.some((i) => i.rule === "ofl-required")).toBe(true);
  });

  it("does not require OFL.txt for a system-fonts-only pack", () => {
    const result = validateThemePack(
      baseInput({
        cssContent: `html[data-theme-pack="foundry"] { --font-sans: system-ui, sans-serif; }`,
        metaRaw: { ...VALID_FOUNDRY_META, fonts: { sans: "System", mono: "System", loaded: [] } },
        fontFiles: [],
      }),
    );
    expect(result.issues.filter((i) => i.rule === "ofl-required")).toEqual([]);
  });

  it("rejects a commercial typeface anywhere in fonts or CSS", () => {
    const inMeta = validateThemePack(
      baseInput({ metaRaw: { ...VALID_FOUNDRY_META, fonts: { ...VALID_FOUNDRY_META.fonts, sans: "Helvetica Neue" } } }),
    );
    expect(inMeta.issues.some((i) => i.rule === "commercial-font-denylist")).toBe(true);

    const inCss = validateThemePack(
      baseInput({
        cssContent: `${VALID_FOUNDRY_CSS}\nhtml[data-theme-pack="foundry"] { --font-sans: "Futura", sans-serif; }`,
      }),
    );
    expect(inCss.issues.some((i) => i.rule === "commercial-font-denylist")).toBe(true);
  });

  it("does NOT flag a denylisted substring that appears only in the scoping-attribute slug", () => {
    // A pack legitimately named after a face (e.g. "futura-editorial") must be
    // authorable: the LOADED face is the OFL substitute (Jost), and "futura"
    // appears only inside the mandatory html[data-theme-pack="futura-editorial"]
    // scoping selector — never in a real font reference. The denylist scan must
    // ignore the scoping attribute value (its value is always the slug).
    const result = validateThemePack(
      baseInput({
        dirName: "futura-editorial",
        metaRaw: {
          ...VALID_FOUNDRY_META,
          slug: "futura-editorial",
          name: "Futura Editorial",
          fonts: { sans: "Jost", mono: "Space Mono", loaded: ["Jost", "Space Mono"] },
        },
        cssContent: `
@font-face { font-family: "Jost"; font-display: swap; src: url("./fonts/Jost-latin.woff2") format("woff2"); }
html[data-theme-pack="futura-editorial"] { --font-sans: "Jost", system-ui, sans-serif; }
html[data-theme-pack="futura-editorial"] header[data-header] { background: var(--zd-surface); }
`,
        fontFiles: ["Jost-latin.woff2", "OFL.txt"],
      }),
    );
    expect(result.issues.some((i) => i.rule === "commercial-font-denylist")).toBe(false);
  });

  it("does NOT flag a commercial typeface mentioned only in a CSS comment", () => {
    const result = validateThemePack(
      baseInput({ cssContent: `/* Futura substitute: Inter */\n${VALID_FOUNDRY_CSS}` }),
    );
    expect(result.issues.some((i) => i.rule === "commercial-font-denylist")).toBe(false);
    expect(result.valid).toBe(true);
  });

  it("rejects preview swatches that aren't plain resolved colors", () => {
    const withVar = validateThemePack(
      baseInput({
        metaRaw: {
          ...VALID_FOUNDRY_META,
          preview: {
            ...VALID_FOUNDRY_META.preview,
            light: { ...VALID_FOUNDRY_META.preview.light, bg: "var(--zd-bg)" },
          },
        },
      }),
    );
    expect(withVar.issues.some((i) => i.rule === "preview-swatch-color")).toBe(true);

    const withLightDark = validateThemePack(
      baseInput({
        metaRaw: {
          ...VALID_FOUNDRY_META,
          preview: {
            ...VALID_FOUNDRY_META.preview,
            dark: { ...VALID_FOUNDRY_META.preview.dark, accent: "light-dark(#000, #fff)" },
          },
        },
      }),
    );
    expect(withLightDark.issues.some((i) => i.rule === "preview-swatch-color")).toBe(true);
  });

  it("warns (does not error) above the ~250 KB soft payload budget", () => {
    const result = validateThemePack(baseInput({ totalPayloadBytes: 300 * 1024 }));
    const budgetIssue = result.issues.find((i) => i.rule === "payload-budget");
    expect(budgetIssue?.severity).toBe("warning");
    expect(result.valid).toBe(true);
  });

  it("does not warn under the soft payload budget", () => {
    const result = validateThemePack(baseInput({ totalPayloadBytes: 100 * 1024 }));
    expect(result.issues.some((i) => i.rule === "payload-budget")).toBe(false);
  });
});
