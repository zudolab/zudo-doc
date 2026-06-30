/**
 * WCAG 2.x contrast guard for color presets.
 *
 * Checks three contrast pairs per scheme:
 *  1. foreground vs background (AA normal text ≥ 4.5:1)
 *  2. accent vs background (AA UI / large text ≥ 3.0:1)
 *  3. admonition title color vs tinted admonition background (AA ≥ 4.5:1)
 *
 * Admonition backgrounds are CSS color-mix(in srgb, semanticColor 12%, --color-bg).
 * Admonition titles use the same semantic color as text.  font-size is text-small
 * (1rem / 16px) at font-weight semibold — NOT large-text territory, so the full
 * 4.5:1 normal-text threshold applies.
 *
 * Built-in schemes (Default Light / Default Dark) MUST pass without allowlisting.
 * Third-party terminal-emulator presets that fail are listed in ALLOWLIST /
 * ADMONITION_ALLOWLIST with a one-line reason, so the guard is meaningful but green.
 * Allowlist entries are expected to fire — a spurious entry (key that never matches
 * a real test) is caught by the stale-key audit at the bottom of this file.
 */

import { describe, it, expect } from "vitest";
import { rgb as culoriRgb } from "culori";
import { colorSchemes } from "../color-schemes";
import { colorTweakPresets } from "../color-tweak-presets";
import { resolveSemanticColors } from "../color-scheme-utils";
import type { ColorScheme, ColorRef } from "../color-schemes";

// ---------------------------------------------------------------------------
// WCAG 2.x luminance / contrast math — parses any CSS color via culori
// ---------------------------------------------------------------------------

/**
 * Parse any CSS color string (hex, oklch, rgb, hsl, …) and return sRGB
 * components clamped to [0, 1].  Throws on unparseable input.
 */
function parseSrgb(cssColor: string): { r: number; g: number; b: number } {
  const result = culoriRgb(cssColor);
  if (!result) throw new Error(`Cannot parse CSS color: "${cssColor}"`);
  // Clamp to [0, 1]: wide-gamut oklch can produce out-of-gamut sRGB components
  return {
    r: Math.max(0, Math.min(1, result.r)),
    g: Math.max(0, Math.min(1, result.g)),
    b: Math.max(0, Math.min(1, result.b)),
  };
}

function relativeLuminance(cssColor: string): number {
  const { r, g, b } = parseSrgb(cssColor);
  // WCAG 2.x linearization: gamma-encoded sRGB → linear light
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Simulate CSS color-mix(in srgb, color N%, bg (100-N)%).
 * Parses both inputs via culori, mixes in sRGB, returns a hex string.
 */
function colorMixSrgb(color: string, bg: string, pct: number): string {
  const f = parseSrgb(color);
  const bv = parseSrgb(bg);
  const ratio = pct / 100;
  const r = f.r * ratio + bv.r * (1 - ratio);
  const g = f.g * ratio + bv.g * (1 - ratio);
  const b = f.b * ratio + bv.b * (1 - ratio);
  const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ---------------------------------------------------------------------------
// Color resolution helpers (no settings import — resolves per-scheme only)
// ---------------------------------------------------------------------------

function resolveRef(ref: ColorRef | undefined, palette: string[], fallback: string): string {
  if (ref === undefined) return fallback;
  if (typeof ref === "number") return palette[ref] ?? fallback;
  return ref;
}

function resolveBg(scheme: ColorScheme): string {
  return resolveRef(scheme.background, scheme.palette, scheme.palette[9] ?? "#000");
}

function resolveFg(scheme: ColorScheme): string {
  return resolveRef(scheme.foreground, scheme.palette, scheme.palette[15] ?? "#fff");
}

// ---------------------------------------------------------------------------
// Admonition contrast helper
// Admonition bg = color-mix(in srgb, semanticColor TINT_PCT%, bgColor)
// ---------------------------------------------------------------------------

const ADMONITION_TINT_PCT = 12; // matches content.css "color-mix(in srgb, var(--color-X) 12%, var(--color-bg))"

function admonitionTitleContrast(colorHex: string, bgHex: string): number {
  const tintedBg = colorMixSrgb(colorHex, bgHex, ADMONITION_TINT_PCT);
  return contrastRatio(colorHex, tintedBg);
}

// ---------------------------------------------------------------------------
// ALLOWLIST — fg/accent failures in third-party presets
//
// Format: "PresetName:check-key" => one-line reason
// These are terminal-emulator palettes ported verbatim from upstream themes.
// We preserve fidelity over enforcing WCAG on the full ambient palette.
// ---------------------------------------------------------------------------

/** Tracks which allowlist keys were actually consulted during the test run. */
const _allowlistHits = new Set<string>();

const ALLOWLIST: Record<string, string> = {
  // --- fg-vs-bg failures ---
  // Solarized Light fg (p11) on bg (p15): ~4.1:1.
  // Upstream Solarized Light uses muted steel fg on parchment bg by design.
  "Solarized Light:fg-vs-bg": "upstream Solarized Light muted-steel fg on parchment bg is ~4.1:1 by design",
};

const ADMONITION_ALLOWLIST: Record<string, string> = {
  // All entries below are third-party terminal-emulator palettes.
  // The admonition title colour IS the upstream semantic colour — adjusting it
  // would diverge from the original theme.  The guard is enforced strictly only
  // on the two built-in schemes (Default Light / Default Dark), which are
  // project-owned and must pass without allowlisting.

  // Atom One Dark: accent (p5) and danger (p1) on near-black bg
  "Atom One Dark:admonition-accent": "upstream Atom One Dark purple accent on near-black bg — palette intrinsic",
  "Atom One Dark:admonition-danger": "upstream Atom One Dark salmon danger on near-black bg — palette intrinsic",

  // Catppuccin Frappe: info (p4) and danger (p1) on dark bg
  "Catppuccin Frappe:admonition-info": "upstream Catppuccin Frappe pastel blue on dark bg — palette intrinsic",
  "Catppuccin Frappe:admonition-danger": "upstream Catppuccin Frappe pastel red on dark bg — palette intrinsic",

  // Challenger Deep: accent (p5) on dark indigo bg
  "Challenger Deep:admonition-accent": "upstream Challenger Deep purple accent on dark indigo bg — palette intrinsic",

  // Doom One: accent (p5) on near-black bg and danger (p1)
  "Doom One:admonition-accent": "upstream Doom One purple accent on near-black bg — palette intrinsic",
  "Doom One:admonition-danger": "upstream Doom One coral danger on near-black bg — palette intrinsic",

  // Dracula: danger (p1) on dark bg
  "Dracula:admonition-danger": "upstream Dracula red danger on dark bg — palette intrinsic",

  // Duskfox: info (p4) on dark bg
  "Duskfox:admonition-info": "upstream Duskfox muted teal info on dark bg — palette intrinsic",

  // GitHub Dark Dimmed: all five admonition colours on mid-dark bg
  "GitHub Dark Dimmed:admonition-accent": "upstream GitHub Dark Dimmed purple accent on mid-dark bg — palette intrinsic",
  "GitHub Dark Dimmed:admonition-success": "upstream GitHub Dark Dimmed green success on mid-dark bg — palette intrinsic",
  "GitHub Dark Dimmed:admonition-warning": "upstream GitHub Dark Dimmed amber warning on mid-dark bg — palette intrinsic",
  "GitHub Dark Dimmed:admonition-info": "upstream GitHub Dark Dimmed blue info on mid-dark bg — palette intrinsic",
  "GitHub Dark Dimmed:admonition-danger": "upstream GitHub Dark Dimmed red danger on mid-dark bg — palette intrinsic",

  // Gruvbox Dark
  "Gruvbox Dark:admonition-success": "upstream Gruvbox Dark muted green on dark bg — palette intrinsic",
  "Gruvbox Dark:admonition-info": "upstream Gruvbox Dark muted teal on dark bg — palette intrinsic",
  "Gruvbox Dark:admonition-danger": "upstream Gruvbox Dark muted red on dark bg — palette intrinsic",

  // Gruvbox Dark Hard
  "Gruvbox Dark Hard:admonition-success": "upstream Gruvbox Dark Hard muted green on darker bg — palette intrinsic",
  "Gruvbox Dark Hard:admonition-info": "upstream Gruvbox Dark Hard muted teal on darker bg — palette intrinsic",
  "Gruvbox Dark Hard:admonition-danger": "upstream Gruvbox Dark Hard muted red on darker bg — palette intrinsic",

  // Gruvbox Material Dark: danger (p1)
  "Gruvbox Material Dark:admonition-danger": "upstream Gruvbox Material Dark muted red on dark bg — palette intrinsic",

  // Kanagawa Dragon: danger (p1)
  "Kanagawa Dragon:admonition-danger": "upstream Kanagawa Dragon muted terracotta on near-black bg — palette intrinsic",

  // Kanagawa Wave: accent (p5), success (p2), danger (p1)
  "Kanagawa Wave:admonition-accent": "upstream Kanagawa Wave muted purple accent on dark bg — palette intrinsic",
  "Kanagawa Wave:admonition-success": "upstream Kanagawa Wave muted olive success on dark bg — palette intrinsic",
  "Kanagawa Wave:admonition-danger": "upstream Kanagawa Wave muted red danger on dark bg — palette intrinsic",

  // Material Dark: success (p2), info (p4), danger (p1)
  "Material Dark:admonition-success": "upstream Material Dark dark-green success on near-black bg — palette intrinsic",
  "Material Dark:admonition-info": "upstream Material Dark dark-blue info on near-black bg — palette intrinsic",
  "Material Dark:admonition-danger": "upstream Material Dark dark-red danger on near-black bg — palette intrinsic",

  // Material Darker: danger (p1) on near-black bg
  "Material Darker:admonition-danger": "upstream Material Darker pink-red danger on near-black bg — palette intrinsic",

  // Monokai Pro: danger (p1)
  "Monokai Pro:admonition-danger": "upstream Monokai Pro salmon danger on dark bg — palette intrinsic",

  // Monokai Remastered: accent (p5), danger (p1) [same color]
  "Monokai Remastered:admonition-accent": "upstream Monokai Remastered hot-pink accent on near-black bg — palette intrinsic",
  "Monokai Remastered:admonition-danger": "upstream Monokai Remastered hot-pink danger on near-black bg — palette intrinsic",

  // Monokai Soda: accent (p5), info (p4), danger (p1)
  "Monokai Soda:admonition-accent": "upstream Monokai Soda hot-pink accent on near-black bg — palette intrinsic",
  "Monokai Soda:admonition-info": "upstream Monokai Soda purple info on near-black bg — palette intrinsic",
  "Monokai Soda:admonition-danger": "upstream Monokai Soda hot-pink danger on near-black bg — palette intrinsic",

  // Monokai Vivid: info (p4), danger (p1)
  "Monokai Vivid:admonition-info": "upstream Monokai Vivid deep-blue info on near-black bg — palette intrinsic",
  "Monokai Vivid:admonition-danger": "upstream Monokai Vivid bright-red danger on near-black bg — palette intrinsic",

  // Nightfox: accent (p5), danger (p1)
  "Nightfox:admonition-accent": "upstream Nightfox muted purple accent on dark navy bg — palette intrinsic",
  "Nightfox:admonition-danger": "upstream Nightfox muted rose danger on dark navy bg — palette intrinsic",

  // Nord: accent (p5), info (p4), danger (p1)
  "Nord:admonition-accent": "upstream Nord muted mauve accent on polar-night bg — palette intrinsic",
  "Nord:admonition-info": "upstream Nord muted blue info on polar-night bg — palette intrinsic",
  "Nord:admonition-danger": "upstream Nord muted red danger on polar-night bg — palette intrinsic",

  // Poimandres: danger (p1)
  "Poimandres:admonition-danger": "upstream Poimandres pink danger on dark bg — palette intrinsic",

  // Rose Pine: success (p2) on dark bg
  "Rose Pine:admonition-success": "upstream Rose Pine teal success on dark purple bg — palette intrinsic",

  // Rose Pine Moon: success (p2) on dark bg
  "Rose Pine Moon:admonition-success": "upstream Rose Pine Moon teal success on dark purple bg — palette intrinsic",

  // Snazzy: danger (p1)
  "Snazzy:admonition-danger": "upstream Snazzy bright-red danger on near-black bg — palette intrinsic",

  // Solarized Dark: all five fail on near-black bg
  "Solarized Dark:admonition-accent": "upstream Solarized Dark p5 (magenta) on deep-teal bg — palette intrinsic",
  "Solarized Dark:admonition-success": "upstream Solarized Dark muted-olive success on deep-teal bg — palette intrinsic",
  "Solarized Dark:admonition-warning": "upstream Solarized Dark amber warning on deep-teal bg — palette intrinsic",
  "Solarized Dark:admonition-info": "upstream Solarized Dark blue info on deep-teal bg — palette intrinsic",
  "Solarized Dark:admonition-danger": "upstream Solarized Dark red danger on deep-teal bg — palette intrinsic",

  // Solarized Light: success (p2), warning (p3) on very-light bg
  "Solarized Light:admonition-success": "upstream Solarized Light olive-green success on parchment bg — palette intrinsic",
  "Solarized Light:admonition-warning": "upstream Solarized Light amber warning on parchment bg — palette intrinsic",

  // VS Code Dark+: accent (p5), info (p4), danger (p1)
  "VS Code Dark+:admonition-accent": "upstream VS Code Dark+ purple accent on near-black bg — palette intrinsic",
  "VS Code Dark+:admonition-info": "upstream VS Code Dark+ dark-blue info on near-black bg — palette intrinsic",
  "VS Code Dark+:admonition-danger": "upstream VS Code Dark+ dark-red danger on near-black bg — palette intrinsic",

  // Atom One Light: near-white bg; upstream pastel palette on light bg
  "Atom One Light:admonition-success": "upstream Atom One Light olive-green success on near-white bg — palette intrinsic",
  "Atom One Light:admonition-warning": "upstream Atom One Light amber warning on near-white bg — palette intrinsic",
  "Atom One Light:admonition-info": "upstream Atom One Light dark-blue info on near-white bg — palette intrinsic",
  "Atom One Light:admonition-danger": "upstream Atom One Light red danger on near-white bg — palette intrinsic",

  // Ayu Light: very light bg; upstream Ayu Light pastel palette
  "Ayu Light:admonition-accent": "upstream Ayu Light neutral-grey accent on near-white bg — palette intrinsic",
  "Ayu Light:admonition-success": "upstream Ayu Light green success on near-white bg — palette intrinsic",
  "Ayu Light:admonition-warning": "upstream Ayu Light amber warning on near-white bg — palette intrinsic",
  "Ayu Light:admonition-info": "upstream Ayu Light blue info on near-white bg — palette intrinsic",
  "Ayu Light:admonition-danger": "upstream Ayu Light salmon danger on near-white bg — palette intrinsic",

  // Catppuccin Latte: off-white bg; upstream Catppuccin Latte pastel palette
  "Catppuccin Latte:admonition-accent": "upstream Catppuccin Latte pastel blue accent on off-white bg — palette intrinsic",
  "Catppuccin Latte:admonition-success": "upstream Catppuccin Latte green success on off-white bg — palette intrinsic",
  "Catppuccin Latte:admonition-warning": "upstream Catppuccin Latte yellow warning on off-white bg — palette intrinsic",
  "Catppuccin Latte:admonition-info": "upstream Catppuccin Latte blue info on off-white bg — palette intrinsic",
  "Catppuccin Latte:admonition-danger": "upstream Catppuccin Latte red danger on off-white bg — palette intrinsic",

  // Dawnfox: warm parchment bg
  "Dawnfox:admonition-success": "upstream Dawnfox muted-teal success on parchment bg — palette intrinsic",
  "Dawnfox:admonition-warning": "upstream Dawnfox amber warning on parchment bg — palette intrinsic",
  "Dawnfox:admonition-danger": "upstream Dawnfox muted-red danger on parchment bg — palette intrinsic",

  // Dayfox: warm light bg
  "Dayfox:admonition-warning": "upstream Dayfox amber-orange warning on warm bg — palette intrinsic",

  // Everforest Light: warm bg; all five admonition colours
  "Everforest Light:admonition-accent": "upstream Everforest Light muted-grey accent on warm bg — palette intrinsic",
  "Everforest Light:admonition-success": "upstream Everforest Light muted-green success on warm bg — palette intrinsic",
  "Everforest Light:admonition-warning": "upstream Everforest Light amber warning on warm bg — palette intrinsic",
  "Everforest Light:admonition-info": "upstream Everforest Light teal info on warm bg — palette intrinsic",
  "Everforest Light:admonition-danger": "upstream Everforest Light muted-red danger on warm bg — palette intrinsic",

  // GitHub Light: white bg
  "GitHub Light:admonition-accent": "upstream GitHub Light purple accent on white bg — palette intrinsic",
  "GitHub Light:admonition-info": "upstream GitHub Light blue info on white bg — palette intrinsic",
  "GitHub Light:admonition-danger": "upstream GitHub Light red danger on white bg — palette intrinsic",

  // Gruvbox Dark / Dark Hard: dark bg; accent (p5) purple/mauve
  "Gruvbox Dark:admonition-accent": "upstream Gruvbox Dark mauve accent on dark bg — palette intrinsic",
  "Gruvbox Dark Hard:admonition-accent": "upstream Gruvbox Dark Hard mauve accent on darker bg — palette intrinsic",

  // Gruvbox Light: cream bg; all five admonition colours are low-saturation
  "Gruvbox Light:admonition-accent": "upstream Gruvbox Light p5 purple on cream bg — palette intrinsic",
  "Gruvbox Light:admonition-success": "upstream Gruvbox Light olive success on cream bg — palette intrinsic",
  "Gruvbox Light:admonition-warning": "upstream Gruvbox Light amber warning on cream bg — palette intrinsic",
  "Gruvbox Light:admonition-info": "upstream Gruvbox Light teal info on cream bg — palette intrinsic",
  "Gruvbox Light:admonition-danger": "upstream Gruvbox Light red danger on cream bg — palette intrinsic",

  // Gruvbox Material Dark: accent (p5) mauve on dark bg
  "Gruvbox Material Dark:admonition-accent": "upstream Gruvbox Material Dark mauve accent on dark bg — palette intrinsic",

  // Material (light): grey bg
  "Material:admonition-success": "upstream Material dark-green success on grey bg — palette intrinsic",
  "Material:admonition-warning": "upstream Material amber-orange warning on grey bg — palette intrinsic",

  // Rose Pine Dawn: soft parchment bg
  "Rose Pine Dawn:admonition-warning": "upstream Rose Pine Dawn amber warning on parchment bg — palette intrinsic",
  "Rose Pine Dawn:admonition-info": "upstream Rose Pine Dawn teal info on parchment bg — palette intrinsic",
  "Rose Pine Dawn:admonition-danger": "upstream Rose Pine Dawn muted-red danger on parchment bg — palette intrinsic",

  // Solarized Dark Higher Contrast: deep bg
  "Solarized Dark Higher Contrast:admonition-accent": "upstream Solarized D-HC magenta accent on near-black bg — palette intrinsic",
  "Solarized Dark Higher Contrast:admonition-warning": "upstream Solarized D-HC amber warning on near-black bg — palette intrinsic",
  "Solarized Dark Higher Contrast:admonition-info": "upstream Solarized D-HC blue info on near-black bg — palette intrinsic",
  "Solarized Dark Higher Contrast:admonition-danger": "upstream Solarized D-HC red danger on near-black bg — palette intrinsic",

  // Solarized Light: parchment bg
  "Solarized Light:admonition-accent": "upstream Solarized Light magenta accent on parchment bg — palette intrinsic",
  "Solarized Light:admonition-info": "upstream Solarized Light blue info on parchment bg — palette intrinsic",
  "Solarized Light:admonition-danger": "upstream Solarized Light red danger on parchment bg — palette intrinsic",
};

// ---------------------------------------------------------------------------
// Preset registry
// ---------------------------------------------------------------------------

function getAllPresets(): Array<{ name: string; scheme: ColorScheme }> {
  return [
    ...Object.entries(colorSchemes).map(([name, scheme]) => ({ name, scheme })),
    ...Object.entries(colorTweakPresets).map(([name, scheme]) => ({ name, scheme })),
  ];
}

// ---------------------------------------------------------------------------
// Unit assertions: luminance / contrast math handles oklch strings
// ---------------------------------------------------------------------------

describe("luminance math — CSS color parsing", () => {
  it("oklch(0 0 0) parses as black (luminance ≈ 0)", () => {
    expect(relativeLuminance("oklch(0 0 0)")).toBeCloseTo(0, 5);
  });

  it("oklch(1 0 0) parses as white (luminance ≈ 1)", () => {
    expect(relativeLuminance("oklch(1 0 0)")).toBeCloseTo(1, 5);
  });

  it("black vs white contrast ≈ 21:1", () => {
    expect(contrastRatio("oklch(0 0 0)", "oklch(1 0 0)")).toBeCloseTo(21, 0);
  });

  it("mid-tone oklch(0.5 0.05 250) parses to a valid luminance in (0, 1)", () => {
    const lum = relativeLuminance("oklch(0.5 0.05 250)");
    expect(lum).toBeGreaterThan(0);
    expect(lum).toBeLessThan(1);
  });

  it("hex colors still parse correctly (#ffffff luminance ≈ 1)", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("hex colors still parse correctly (#000000 luminance ≈ 0)", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("colorMixSrgb returns a parseable color string", () => {
    const mixed = colorMixSrgb("oklch(1 0 0)", "oklch(0 0 0)", 50);
    // 50% mix of white and black in sRGB → near-mid-grey; luminance ≈ 0.212
    expect(relativeLuminance(mixed)).toBeCloseTo(0.212, 2);
  });
});

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("WCAG 2.x contrast guard", () => {
  describe("foreground vs background (AA normal text ≥ 4.5:1)", () => {
    for (const { name, scheme } of getAllPresets()) {
      it(`"${name}" fg-vs-bg`, () => {
        const key = `${name}:fg-vs-bg`;
        if (ALLOWLIST[key]) { _allowlistHits.add(key); return; }

        const bg = resolveBg(scheme);
        const fg = resolveFg(scheme);
        const ratio = contrastRatio(fg, bg);
        expect(
          ratio,
          `"${name}" fg ${fg} vs bg ${bg}: ${ratio.toFixed(2)}:1 (need ≥ 4.5)`,
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  });

  describe("accent vs background (AA UI / large text ≥ 3.0:1)", () => {
    for (const { name, scheme } of getAllPresets()) {
      it(`"${name}" accent-vs-bg`, () => {
        const key = `${name}:accent-vs-bg`;
        if (ALLOWLIST[key]) { _allowlistHits.add(key); return; }

        const bg = resolveBg(scheme);
        const sem = resolveSemanticColors(scheme);
        const ratio = contrastRatio(sem.accent, bg);
        expect(
          ratio,
          `"${name}" accent ${sem.accent} vs bg ${bg}: ${ratio.toFixed(2)}:1 (need ≥ 3.0)`,
        ).toBeGreaterThanOrEqual(3.0);
      });
    }
  });

  describe("admonition title contrast (AA normal text ≥ 4.5:1)", () => {
    // title colour = semantic token; tinted bg = color-mix(12% token + 88% page-bg)
    const admonitionSlots = [
      { key: "admonition-accent", get: (s: ReturnType<typeof resolveSemanticColors>) => s.accent },
      { key: "admonition-success", get: (s: ReturnType<typeof resolveSemanticColors>) => s.success },
      { key: "admonition-warning", get: (s: ReturnType<typeof resolveSemanticColors>) => s.warning },
      { key: "admonition-info", get: (s: ReturnType<typeof resolveSemanticColors>) => s.info },
      { key: "admonition-danger", get: (s: ReturnType<typeof resolveSemanticColors>) => s.danger },
    ] as const;

    for (const { name, scheme } of getAllPresets()) {
      for (const slot of admonitionSlots) {
        it(`"${name}" ${slot.key}`, () => {
          const allowKey = `${name}:${slot.key}`;
          if (ADMONITION_ALLOWLIST[allowKey]) { _allowlistHits.add(allowKey); return; }

          const bg = resolveBg(scheme);
          const sem = resolveSemanticColors(scheme);
          const color = slot.get(sem);
          const ratio = admonitionTitleContrast(color, bg);
          expect(
            ratio,
            `"${name}" ${slot.key}: ${color} on tinted-bg (${ADMONITION_TINT_PCT}% mix with ${bg}): ${ratio.toFixed(2)}:1 (need ≥ 4.5)`,
          ).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  });

  describe("allowlist integrity — no stale entries", () => {
    it("every ALLOWLIST key matches at least one test", () => {
      for (const key of Object.keys(ALLOWLIST)) {
        expect(
          _allowlistHits.has(key),
          `ALLOWLIST key "${key}" was never consulted — remove it (stale allowlist entry)`,
        ).toBe(true);
      }
    });

    it("every ADMONITION_ALLOWLIST key matches at least one test", () => {
      for (const key of Object.keys(ADMONITION_ALLOWLIST)) {
        expect(
          _allowlistHits.has(key),
          `ADMONITION_ALLOWLIST key "${key}" was never consulted — remove it (stale allowlist entry)`,
        ).toBe(true);
      }
    });
  });
});
