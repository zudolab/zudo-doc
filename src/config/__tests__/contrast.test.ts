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
import { colorSchemes } from "../color-schemes";
import { colorTweakPresets } from "../color-tweak-presets";
import { resolveSemanticColors } from "../color-scheme-utils";
import type { ColorScheme, ColorRef } from "../color-schemes";

// ---------------------------------------------------------------------------
// WCAG 2.x luminance / contrast math (no dependencies)
// ---------------------------------------------------------------------------

function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const r = toLinear(parseInt(h.slice(0, 2), 16) / 255);
  const g = toLinear(parseInt(h.slice(2, 4), 16) / 255);
  const b = toLinear(parseInt(h.slice(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Simulate CSS color-mix(in srgb, colorHex N%, bgHex (100-N)%).
 * Returns a hex string for the mixed colour.
 */
function colorMixSrgb(colorHex: string, bgHex: string, pct: number): string {
  const toBytes = (h: string) => {
    const s = h.replace("#", "");
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)] as const;
  };
  const f = toBytes(colorHex);
  const b = toBytes(bgHex);
  const ratio = pct / 100;
  const mixed = f.map((c, i) => Math.round(c * ratio + (b[i] as number) * (1 - ratio)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
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
  // Solarized Light fg p11 (#657b83) on bg p15 (#fdf6e3): ~4.1:1.
  // Upstream Solarized Light uses muted steel fg on parchment bg by design.
  "Solarized Light:fg-vs-bg": "upstream Solarized Light muted-steel fg on parchment bg is ~4.1:1 by design",
};

const ADMONITION_ALLOWLIST: Record<string, string> = {
  // All entries below are third-party terminal-emulator palettes.
  // The admonition title colour IS the upstream semantic colour — adjusting it
  // would diverge from the original theme.  The guard is enforced strictly only
  // on the two built-in schemes (Default Light / Default Dark), which are
  // project-owned and must pass without allowlisting.

  // Atom One Dark: accent p5 (#c678dd) and danger p1 (#e06c75) on near-black bg
  "Atom One Dark:admonition-accent": "upstream Atom One Dark purple accent on near-black bg — palette intrinsic",
  "Atom One Dark:admonition-danger": "upstream Atom One Dark salmon danger on near-black bg — palette intrinsic",

  // Catppuccin Frappe: info p4 (#8caaee) and danger p1 (#e78284) on dark bg (#303446)
  "Catppuccin Frappe:admonition-info": "upstream Catppuccin Frappe pastel blue on dark bg — palette intrinsic",
  "Catppuccin Frappe:admonition-danger": "upstream Catppuccin Frappe pastel red on dark bg — palette intrinsic",

  // Challenger Deep: accent p5 (#906cff) on dark bg (#1e1c31)
  "Challenger Deep:admonition-accent": "upstream Challenger Deep purple accent on dark indigo bg — palette intrinsic",

  // Doom One: accent p5 (#c678dd) on near-black (#282c34) and danger p1 (#ff6c6b)
  "Doom One:admonition-accent": "upstream Doom One purple accent on near-black bg — palette intrinsic",
  "Doom One:admonition-danger": "upstream Doom One coral danger on near-black bg — palette intrinsic",

  // Dracula: danger p1 (#ff5555) on dark bg (#282a36)
  "Dracula:admonition-danger": "upstream Dracula red danger on dark bg — palette intrinsic",

  // Duskfox: info p4 (#569fba) on dark bg (#232136)
  "Duskfox:admonition-info": "upstream Duskfox muted teal info on dark bg — palette intrinsic",

  // GitHub Dark Dimmed: all five admonition colours on mid-dark bg (#22272e)
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

  // Gruvbox Material Dark: danger p1 (#ea6962)
  "Gruvbox Material Dark:admonition-danger": "upstream Gruvbox Material Dark muted red on dark bg — palette intrinsic",

  // Kanagawa Dragon: danger p1 (#c4746e)
  "Kanagawa Dragon:admonition-danger": "upstream Kanagawa Dragon muted terracotta on near-black bg — palette intrinsic",

  // Kanagawa Wave: accent p5 (#957fb8), success p2 (#76946a), danger p1 (#c34043)
  "Kanagawa Wave:admonition-accent": "upstream Kanagawa Wave muted purple accent on dark bg — palette intrinsic",
  "Kanagawa Wave:admonition-success": "upstream Kanagawa Wave muted olive success on dark bg — palette intrinsic",
  "Kanagawa Wave:admonition-danger": "upstream Kanagawa Wave muted red danger on dark bg — palette intrinsic",

  // Material Dark: success p2 (#457b24), info p4 (#134eb2), danger p1 (#b7141f)
  "Material Dark:admonition-success": "upstream Material Dark dark-green success on near-black bg — palette intrinsic",
  "Material Dark:admonition-info": "upstream Material Dark dark-blue info on near-black bg — palette intrinsic",
  "Material Dark:admonition-danger": "upstream Material Dark dark-red danger on near-black bg — palette intrinsic",

  // Material Darker: danger p1 (#ff5370) on near-black bg (#212121)
  "Material Darker:admonition-danger": "upstream Material Darker pink-red danger on near-black bg — palette intrinsic",

  // Monokai Pro: danger p1 (#ff6188)
  "Monokai Pro:admonition-danger": "upstream Monokai Pro salmon danger on dark bg — palette intrinsic",

  // Monokai Remastered: accent p5 (#f4005f), danger p1 (#f4005f) [same color]
  "Monokai Remastered:admonition-accent": "upstream Monokai Remastered hot-pink accent on near-black bg — palette intrinsic",
  "Monokai Remastered:admonition-danger": "upstream Monokai Remastered hot-pink danger on near-black bg — palette intrinsic",

  // Monokai Soda: accent p5 (#f4005f), info p4 (#9d65ff), danger p1 (#f4005f)
  "Monokai Soda:admonition-accent": "upstream Monokai Soda hot-pink accent on near-black bg — palette intrinsic",
  "Monokai Soda:admonition-info": "upstream Monokai Soda purple info on near-black bg — palette intrinsic",
  "Monokai Soda:admonition-danger": "upstream Monokai Soda hot-pink danger on near-black bg — palette intrinsic",

  // Monokai Vivid: info p4 (#0443ff), danger p1 (#fa2934)
  "Monokai Vivid:admonition-info": "upstream Monokai Vivid deep-blue info on near-black bg — palette intrinsic",
  "Monokai Vivid:admonition-danger": "upstream Monokai Vivid bright-red danger on near-black bg — palette intrinsic",

  // Nightfox: accent p5 (#9d79d6), danger p1 (#c94f6d)
  "Nightfox:admonition-accent": "upstream Nightfox muted purple accent on dark navy bg — palette intrinsic",
  "Nightfox:admonition-danger": "upstream Nightfox muted rose danger on dark navy bg — palette intrinsic",

  // Nord: accent p5 (#b48ead), info p4 (#81a1c1), danger p1 (#bf616a)
  "Nord:admonition-accent": "upstream Nord muted mauve accent on polar-night bg — palette intrinsic",
  "Nord:admonition-info": "upstream Nord muted blue info on polar-night bg — palette intrinsic",
  "Nord:admonition-danger": "upstream Nord muted red danger on polar-night bg — palette intrinsic",

  // Poimandres: danger p1 (#d0679d)
  "Poimandres:admonition-danger": "upstream Poimandres pink danger on dark bg — palette intrinsic",

  // Rose Pine: success p2 (#31748f) on dark bg (#191724)
  "Rose Pine:admonition-success": "upstream Rose Pine teal success on dark purple bg — palette intrinsic",

  // Rose Pine Moon: success p2 (#3e8fb0) on dark bg (#232136)
  "Rose Pine Moon:admonition-success": "upstream Rose Pine Moon teal success on dark purple bg — palette intrinsic",

  // Snazzy: danger p1 (#fc4346)
  "Snazzy:admonition-danger": "upstream Snazzy bright-red danger on near-black bg — palette intrinsic",

  // Solarized Dark: all five fail on near-black bg (#002b36)
  "Solarized Dark:admonition-accent": "upstream Solarized Dark p5 (magenta) on deep-teal bg — palette intrinsic",
  "Solarized Dark:admonition-success": "upstream Solarized Dark muted-olive success on deep-teal bg — palette intrinsic",
  "Solarized Dark:admonition-warning": "upstream Solarized Dark amber warning on deep-teal bg — palette intrinsic",
  "Solarized Dark:admonition-info": "upstream Solarized Dark blue info on deep-teal bg — palette intrinsic",
  "Solarized Dark:admonition-danger": "upstream Solarized Dark red danger on deep-teal bg — palette intrinsic",

  // Solarized Light: success p2 (#859900), warning p3 (#b58900) on very-light bg (#fdf6e3)
  "Solarized Light:admonition-success": "upstream Solarized Light olive-green success on parchment bg — palette intrinsic",
  "Solarized Light:admonition-warning": "upstream Solarized Light amber warning on parchment bg — palette intrinsic",

  // VS Code Dark+: accent p5 (#bc3fbc), info p4 (#2472c8), danger p1 (#cd3131)
  "VS Code Dark+:admonition-accent": "upstream VS Code Dark+ purple accent on near-black bg — palette intrinsic",
  "VS Code Dark+:admonition-info": "upstream VS Code Dark+ dark-blue info on near-black bg — palette intrinsic",
  "VS Code Dark+:admonition-danger": "upstream VS Code Dark+ dark-red danger on near-black bg — palette intrinsic",

  // Atom One Light: near-white bg (#f9f9f9); upstream pastel palette on light bg
  "Atom One Light:admonition-success": "upstream Atom One Light olive-green success on near-white bg — palette intrinsic",
  "Atom One Light:admonition-warning": "upstream Atom One Light amber warning on near-white bg — palette intrinsic",
  "Atom One Light:admonition-info": "upstream Atom One Light dark-blue info on near-white bg — palette intrinsic",
  "Atom One Light:admonition-danger": "upstream Atom One Light red danger on near-white bg — palette intrinsic",

  // Ayu Light: very light bg (#f8f9fa); upstream Ayu Light pastel palette
  "Ayu Light:admonition-accent": "upstream Ayu Light neutral-grey accent on near-white bg — palette intrinsic",
  "Ayu Light:admonition-success": "upstream Ayu Light green success on near-white bg — palette intrinsic",
  "Ayu Light:admonition-warning": "upstream Ayu Light amber warning on near-white bg — palette intrinsic",
  "Ayu Light:admonition-info": "upstream Ayu Light blue info on near-white bg — palette intrinsic",
  "Ayu Light:admonition-danger": "upstream Ayu Light salmon danger on near-white bg — palette intrinsic",

  // Catppuccin Latte: off-white bg (#eff1f5); upstream Catppuccin Latte pastel palette
  "Catppuccin Latte:admonition-accent": "upstream Catppuccin Latte pastel blue accent on off-white bg — palette intrinsic",
  "Catppuccin Latte:admonition-success": "upstream Catppuccin Latte green success on off-white bg — palette intrinsic",
  "Catppuccin Latte:admonition-warning": "upstream Catppuccin Latte yellow warning on off-white bg — palette intrinsic",
  "Catppuccin Latte:admonition-info": "upstream Catppuccin Latte blue info on off-white bg — palette intrinsic",
  "Catppuccin Latte:admonition-danger": "upstream Catppuccin Latte red danger on off-white bg — palette intrinsic",

  // Dawnfox: warm parchment bg (#faf4ed)
  "Dawnfox:admonition-success": "upstream Dawnfox muted-teal success on parchment bg — palette intrinsic",
  "Dawnfox:admonition-warning": "upstream Dawnfox amber warning on parchment bg — palette intrinsic",
  "Dawnfox:admonition-danger": "upstream Dawnfox muted-red danger on parchment bg — palette intrinsic",

  // Dayfox: warm light bg (#f6f2ee)
  "Dayfox:admonition-warning": "upstream Dayfox amber-orange warning on warm bg — palette intrinsic",

  // Everforest Light: warm bg (#efebd4); all five admonition colours
  "Everforest Light:admonition-accent": "upstream Everforest Light muted-grey accent on warm bg — palette intrinsic",
  "Everforest Light:admonition-success": "upstream Everforest Light muted-green success on warm bg — palette intrinsic",
  "Everforest Light:admonition-warning": "upstream Everforest Light amber warning on warm bg — palette intrinsic",
  "Everforest Light:admonition-info": "upstream Everforest Light teal info on warm bg — palette intrinsic",
  "Everforest Light:admonition-danger": "upstream Everforest Light muted-red danger on warm bg — palette intrinsic",

  // GitHub Light: white bg (#ffffff)
  "GitHub Light:admonition-accent": "upstream GitHub Light purple accent on white bg — palette intrinsic",
  "GitHub Light:admonition-info": "upstream GitHub Light blue info on white bg — palette intrinsic",
  "GitHub Light:admonition-danger": "upstream GitHub Light red danger on white bg — palette intrinsic",

  // Gruvbox Dark / Dark Hard: dark bg; accent p5 (#b16286) purple/mauve
  "Gruvbox Dark:admonition-accent": "upstream Gruvbox Dark mauve accent on dark bg — palette intrinsic",
  "Gruvbox Dark Hard:admonition-accent": "upstream Gruvbox Dark Hard mauve accent on darker bg — palette intrinsic",

  // Gruvbox Light: cream bg (#fbf1c7); all five admonition colours are low-saturation
  "Gruvbox Light:admonition-accent": "upstream Gruvbox Light p5 purple on cream bg — palette intrinsic",
  "Gruvbox Light:admonition-success": "upstream Gruvbox Light olive success on cream bg — palette intrinsic",
  "Gruvbox Light:admonition-warning": "upstream Gruvbox Light amber warning on cream bg — palette intrinsic",
  "Gruvbox Light:admonition-info": "upstream Gruvbox Light teal info on cream bg — palette intrinsic",
  "Gruvbox Light:admonition-danger": "upstream Gruvbox Light red danger on cream bg — palette intrinsic",

  // Gruvbox Material Dark: accent p5 (#d3869b) mauve on dark bg (#282828)
  "Gruvbox Material Dark:admonition-accent": "upstream Gruvbox Material Dark mauve accent on dark bg — palette intrinsic",

  // Material (light): bg (#eaeaea)
  "Material:admonition-success": "upstream Material dark-green success on grey bg — palette intrinsic",
  "Material:admonition-warning": "upstream Material amber-orange warning on grey bg — palette intrinsic",

  // Rose Pine Dawn: soft parchment bg (#faf4ed)
  "Rose Pine Dawn:admonition-warning": "upstream Rose Pine Dawn amber warning on parchment bg — palette intrinsic",
  "Rose Pine Dawn:admonition-info": "upstream Rose Pine Dawn teal info on parchment bg — palette intrinsic",
  "Rose Pine Dawn:admonition-danger": "upstream Rose Pine Dawn muted-red danger on parchment bg — palette intrinsic",

  // Solarized Dark Higher Contrast: deep bg (#001e27)
  "Solarized Dark Higher Contrast:admonition-accent": "upstream Solarized D-HC magenta accent on near-black bg — palette intrinsic",
  "Solarized Dark Higher Contrast:admonition-warning": "upstream Solarized D-HC amber warning on near-black bg — palette intrinsic",
  "Solarized Dark Higher Contrast:admonition-info": "upstream Solarized D-HC blue info on near-black bg — palette intrinsic",
  "Solarized Dark Higher Contrast:admonition-danger": "upstream Solarized D-HC red danger on near-black bg — palette intrinsic",

  // Solarized Light: parchment bg (#fdf6e3)
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
