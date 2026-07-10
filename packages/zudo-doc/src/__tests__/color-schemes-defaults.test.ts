import { describe, it, expect } from "vitest";
import { defaultColorSchemes } from "../color-schemes-defaults/index.js";
import { resolveSemanticColors, SEMANTIC_KEYS } from "../color-scheme-utils.js";

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

  it("is plain serializable JSON (route-context virtual-module rule)", () => {
    expect(() => JSON.parse(JSON.stringify(defaultColorSchemes))).not.toThrow();
  });
});
