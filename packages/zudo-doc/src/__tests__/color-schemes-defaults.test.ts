import { describe, it, expect } from "vitest";
import { rgb as culoriRgb } from "culori";
import { defaultColorSchemes } from "../color-schemes-defaults/index.js";
import {
  resolveSemanticColors,
  resolveSyntaxColors,
  SEMANTIC_KEYS,
  SYNTAX_DIFF_BACKGROUND_MIX_PERCENT,
  SYNTAX_SEMANTIC_KEYS,
} from "../color-scheme-utils.js";

interface Srgb {
  r: number;
  g: number;
  b: number;
}

function parseSrgb(value: string): Srgb {
  const parsed = culoriRgb(value);
  if (!parsed) throw new Error(`Cannot parse color: ${value}`);
  return {
    r: Math.max(0, Math.min(1, parsed.r)),
    g: Math.max(0, Math.min(1, parsed.g)),
    b: Math.max(0, Math.min(1, parsed.b)),
  };
}

function luminance({ r, g, b }: Srgb): number {
  const linear = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(foreground: Srgb, background: Srgb): number {
  const fg = luminance(foreground);
  const bg = luminance(background);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}

function mixSrgb(foreground: Srgb, background: Srgb, foregroundPercent: number): Srgb {
  const ratio = foregroundPercent / 100;
  return {
    r: foreground.r * ratio + background.r * (1 - ratio),
    g: foreground.g * ratio + background.g * (1 - ratio),
    b: foreground.b * ratio + background.b * (1 - ratio),
  };
}

// Formerly also parity-checked its oklch(...) literals against the
// `create-zudo-doc` base template's `color-schemes.ts` (#2654's port
// source). That template file was deleted by the minimal-scaffold cutover
// (epic #2651, Wave 6 #2660) — this module is now the sole source of truth
// for the default color schemes, so a template-comparison test no longer
// has anything meaningful to compare against (found stale during the #2667
// final-confirm gate — see the same note in i18n-defaults.test.ts for why
// no earlier wave caught this).
describe("defaultColorSchemes", () => {
  it("ships exactly Default Light + Default Dark", () => {
    expect(Object.keys(defaultColorSchemes)).toEqual(["Default Light", "Default Dark"]);
  });

  it("Default Light and Default Dark share identical ramp values (Tier-1 source of truth)", () => {
    const light = defaultColorSchemes["Default Light"];
    const dark = defaultColorSchemes["Default Dark"];
    expect(light).toBeDefined();
    expect(dark).toBeDefined();
    expect(light?.ramps).toEqual(dark?.ramps);
  });

  it("base ramp has 5 stops, accent ramp has 3 stops (minimized palette, #2602)", () => {
    const scheme = defaultColorSchemes["Default Dark"];
    expect(scheme?.ramps.base).toHaveLength(5);
    expect(scheme?.ramps.accent).toHaveLength(3);
  });

  it("every semantic role resolves to a concrete color for both schemes", () => {
    for (const name of ["Default Light", "Default Dark"] as const) {
      const scheme = defaultColorSchemes[name];
      expect(scheme).toBeDefined();
      if (!scheme) continue;
      const resolved = resolveSemanticColors(scheme);
      for (const key of SEMANTIC_KEYS) {
        expect(typeof resolved[key]).toBe("string");
        expect(resolved[key].length).toBeGreaterThan(0);
      }
    }
  });

  it("every syntax foreground clears 4.6:1, including diff roles on their tinted backgrounds", () => {
    for (const name of ["Default Light", "Default Dark"] as const) {
      const scheme = defaultColorSchemes[name]!;
      const semantic = resolveSemanticColors(scheme);
      const syntax = resolveSyntaxColors(scheme);
      const codeBg = parseSrgb(semantic.codeBg);

      for (const key of SYNTAX_SEMANTIC_KEYS) {
        const foreground = parseSrgb(syntax[key]);
        expect(
          contrast(foreground, codeBg),
          `${name} ${key} must reach 4.6:1 against codeBg`,
        ).toBeGreaterThanOrEqual(4.6);

        if (key === "syntaxInserted" || key === "syntaxDeleted") {
          const tintedBackground = mixSrgb(
            foreground,
            codeBg,
            SYNTAX_DIFF_BACKGROUND_MIX_PERCENT,
          );
          expect(
            contrast(foreground, tintedBackground),
            `${name} ${key} must reach 4.6:1 against its rendered tint`,
          ).toBeGreaterThanOrEqual(4.6);
        }
      }
    }
  });

  it("keeps shipped syntax maps partial: only contrast-tuned diff roles are explicit", () => {
    for (const scheme of Object.values(defaultColorSchemes)) {
      expect(Object.keys(scheme.map.syntax ?? {})).toEqual([
        "syntaxInserted",
        "syntaxDeleted",
      ]);
    }
  });

  it("is plain serializable JSON (route-context virtual-module rule)", () => {
    expect(() => JSON.parse(JSON.stringify(defaultColorSchemes))).not.toThrow();
  });
});
