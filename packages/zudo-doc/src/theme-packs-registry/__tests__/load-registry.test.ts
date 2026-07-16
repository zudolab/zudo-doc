import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadThemePackRegistry } from "../load-registry.js";
import { resolveEnabledPacks } from "../resolve-enabled-packs.js";
import { SEMANTIC_CSS_NAMES, SYNTAX_CSS_NAMES } from "../../color-scheme-utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// `src/theme-packs-registry/__tests__/` -> `src/theme-packs/`
const THEME_PACKS_DIR = resolve(__dirname, "../../theme-packs");

describe("loadThemePackRegistry (real bundled packs)", () => {
  it("aggregates the 11 shipped packs, in canonical alphabetical order", () => {
    const registry = loadThemePackRegistry(THEME_PACKS_DIR);
    expect(registry.map((e) => e.slug)).toEqual([
      "broadsheet",
      "default",
      "foundry",
      "futura-editorial",
      "hearth",
      "ledger",
      "manuscript",
      "matcha",
      "sumi",
      "swissgrid",
      "washi",
    ]);
  });

  it("the default pack has no stylesheet; foundry does", () => {
    const registry = loadThemePackRegistry(THEME_PACKS_DIR);
    const byslug = Object.fromEntries(registry.map((e) => [e.slug, e]));
    expect(byslug["default"]?.hasStylesheet).toBe(false);
    expect(byslug["foundry"]?.hasStylesheet).toBe(true);
  });

  it("every pack passes its own validator (throws otherwise, proven by not throwing)", () => {
    expect(() => loadThemePackRegistry(THEME_PACKS_DIR)).not.toThrow();
  });

  it("resolveEnabledPacks accepts the real registry with default settings", () => {
    const registry = loadThemePackRegistry(THEME_PACKS_DIR);
    const enabled = resolveEnabledPacks(registry, {});
    // `resolveEnabledPacks` pins the reserved `default` pack first, then the
    // rest alphabetically (distinct from `loadThemePackRegistry`'s pure
    // alphabetical order above).
    expect(enabled.map((e) => e.slug)).toEqual([
      "default",
      "broadsheet",
      "foundry",
      "futura-editorial",
      "hearth",
      "ledger",
      "manuscript",
      "matcha",
      "sumi",
      "swissgrid",
      "washi",
    ]);
  });

  it("resolveEnabledPacks throws loudly for an unknown themePack against the real registry", () => {
    const registry = loadThemePackRegistry(THEME_PACKS_DIR);
    expect(() => resolveEnabledPacks(registry, { themePack: "does-not-exist" })).toThrow(
      /does-not-exist/,
    );
  });

  it("foundry restyles ALL 9 --zd-syntax-* roles in BOTH modes (the syntax-theming proof)", () => {
    const css = readFileSync(resolve(THEME_PACKS_DIR, "foundry/pack.css"), "utf8");
    for (const cssVar of Object.values(SYNTAX_CSS_NAMES)) {
      const re = new RegExp(
        `${cssVar}\\s*:\\s*light-dark\\(\\s*[^,]+,\\s*[^)]+\\)\\s*;`,
      );
      expect(css, `expected ${cssVar} to be set via light-dark(light, dark)`).toMatch(re);
    }
    // Sanity: 9 syntax roles named — no fewer, no accidental extras missed.
    expect(Object.values(SYNTAX_CSS_NAMES)).toHaveLength(9);
  });

  it("foundry also restyles the base + semantic --zd-* roles via light-dark(), both modes", () => {
    const css = readFileSync(resolve(THEME_PACKS_DIR, "foundry/pack.css"), "utf8");
    const baseRoles = ["--zd-bg", "--zd-fg", "--zd-accent"];
    for (const cssVar of [...baseRoles, ...Object.values(SEMANTIC_CSS_NAMES).filter((v) => v === "--zd-accent")]) {
      expect(css).toMatch(new RegExp(`${cssVar}\\s*:\\s*light-dark\\(`));
    }
  });

  it("throws a clear error when pointed at a non-existent directory", () => {
    expect(() => loadThemePackRegistry(resolve(__dirname, "does-not-exist"))).toThrow(
      /theme-packs directory not found/,
    );
  });
});
