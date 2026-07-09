import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultColorSchemes } from "../color-schemes-defaults/index.js";
import { resolveSemanticColors, SEMANTIC_KEYS } from "../color-scheme-utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const templatePath = resolve(
  repoRoot,
  "packages/create-zudo-doc/templates/base/src/config/color-schemes.ts",
);
const modulePath = resolve(__dirname, "../color-schemes-defaults/index.ts");

const OKLCH_RE = /oklch\([^)]*\)/g;

function extractOklchTokens(path: string): string[] {
  const src = readFileSync(path, "utf8");
  return [...src.matchAll(OKLCH_RE)].map((m) => m[0]);
}

describe("defaultColorSchemes", () => {
  it("ships exactly Default Light + Default Dark (matches the template)", () => {
    expect(Object.keys(defaultColorSchemes)).toEqual(["Default Light", "Default Dark"]);
  });

  it("carries the same ordered set of oklch(...) literals as the template source (no value drift)", () => {
    // Both files author the ramps + per-mode overrides in the same structural
    // order (ramps, dark map, light map), so a straight ordered diff of every
    // oklch(...) occurrence in each source file is a strong, low-maintenance
    // parity check against the template this default was ported from (#2654).
    const templateTokens = extractOklchTokens(templatePath);
    const moduleTokens = extractOklchTokens(modulePath);
    expect(moduleTokens).toEqual(templateTokens);
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
