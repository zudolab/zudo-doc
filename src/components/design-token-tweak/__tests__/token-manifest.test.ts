import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FONT_TOKENS,
  SPACING_TOKENS,
  parseNumericValue,
  formatValue,
} from "../tokens/manifest";

/**
 * Manifest coverage test.
 *
 * Reads `src/styles/global.css` and asserts that every `--spacing-*` custom
 * property and `--zd-sidebar-w` declared there has a matching entry in
 * `SPACING_TOKENS`. This guards against future CSS additions silently
 * dropping out of the Spacing tab.
 */

const CSS_PATH = resolve(__dirname, "../../../styles/global.css");

function extractSpacingCustomProps(css: string): string[] {
  // Match `--spacing-<id>: <value>` (declarations only — not usages). Also
  // include `--zd-sidebar-w` since it's our one non-`--spacing-*` layout row.
  const props = new Set<string>();
  const re = /(--(?:spacing-[a-z0-9-]+|zd-sidebar-w))\s*:/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    props.add(m[1]);
  }
  return [...props];
}

describe("SPACING_TOKENS manifest coverage", () => {
  const css = readFileSync(CSS_PATH, "utf8");
  const found = extractSpacingCustomProps(css);

  it("covers every --spacing-* / --zd-sidebar-w declared in global.css", () => {
    const manifestVars = new Set(SPACING_TOKENS.map((t) => t.cssVar));
    const missing = found.filter((v) => !manifestVars.has(v));
    expect(missing, `missing from manifest: ${missing.join(", ")}`).toEqual([]);
  });

  it("has unique ids and unique cssVars", () => {
    const ids = SPACING_TOKENS.map((t) => t.id);
    const vars = SPACING_TOKENS.map((t) => t.cssVar);
    expect(new Set(ids).size, "duplicate ids").toBe(ids.length);
    expect(new Set(vars).size, "duplicate cssVars").toBe(vars.length);
  });

  it("gives every editable token a valid numeric default in range", () => {
    for (const t of SPACING_TOKENS) {
      if (t.readonly) continue;
      const n = parseNumericValue(t.default);
      expect(n, `default not parseable for ${t.id}`).not.toBeNull();
      expect(n!).toBeGreaterThanOrEqual(t.min);
      expect(n!).toBeLessThanOrEqual(t.max);
      expect(t.step).toBeGreaterThan(0);
    }
  });
});

function extractFontCustomProps(css: string): string[] {
  // Match declarations of tokens surfaced by the Font tab. We explicitly
  // enumerate the allowed prefixes so unrelated custom props in global.css
  // (e.g. `--zd-*`, `--color-*`) are ignored.
  //   - `--text-<name>` (Tier 2 sizes) and `--text-scale-<name>` (Tier 1)
  //   - `--leading-<name>`
  //   - `--font-weight-<name>`
  //   - `--font-sans`, `--font-mono`
  const props = new Set<string>();
  const re =
    /(--(?:text-scale-[a-z0-9-]+|text-[a-z0-9-]+|leading-[a-z0-9-]+|font-weight-[a-z0-9-]+|font-(?:sans|mono)))\s*:/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    props.add(m[1]);
  }
  return [...props];
}

describe("FONT_TOKENS manifest coverage", () => {
  const css = readFileSync(CSS_PATH, "utf8");
  const found = extractFontCustomProps(css);

  it("covers every font-related custom property declared in global.css", () => {
    const manifestVars = new Set(FONT_TOKENS.map((t) => t.cssVar));
    const missing = found.filter((v) => !manifestVars.has(v));
    expect(missing, `missing from manifest: ${missing.join(", ")}`).toEqual([]);
  });

  it("has unique ids and unique cssVars", () => {
    const ids = FONT_TOKENS.map((t) => t.id);
    const vars = FONT_TOKENS.map((t) => t.cssVar);
    expect(new Set(ids).size, "duplicate ids").toBe(ids.length);
    expect(new Set(vars).size, "duplicate cssVars").toBe(vars.length);
  });

  it("gives every slider token a valid numeric default in range", () => {
    for (const t of FONT_TOKENS) {
      if (t.readonly) continue;
      if (t.control === "select" || t.control === "text") continue;
      const n = parseNumericValue(t.default);
      expect(n, `default not parseable for ${t.id}`).not.toBeNull();
      expect(n!).toBeGreaterThanOrEqual(t.min);
      expect(n!).toBeLessThanOrEqual(t.max);
      expect(t.step).toBeGreaterThan(0);
    }
  });

  it("limits select controls to the values listed in their `options`", () => {
    for (const t of FONT_TOKENS) {
      if (t.control !== "select") continue;
      expect(t.options, `${t.id} is a select but has no options`).toBeDefined();
      expect(t.options!).toContain(t.default);
    }
  });
});

describe("parseNumericValue / formatValue", () => {
  it("parses common length strings", () => {
    expect(parseNumericValue("1.5rem")).toBe(1.5);
    expect(parseNumericValue("0.125rem")).toBe(0.125);
    expect(parseNumericValue("12px")).toBe(12);
    expect(parseNumericValue("0")).toBe(0);
    expect(parseNumericValue("-0.5rem")).toBe(-0.5);
  });

  it("returns null for unparseable values", () => {
    expect(parseNumericValue("clamp(14rem, 20vw, 22rem)")).toBeNull();
    expect(parseNumericValue("auto")).toBeNull();
    expect(parseNumericValue("")).toBeNull();
  });

  it("formatValue round-trips numeric + unit", () => {
    expect(formatValue(1.5, "rem")).toBe("1.5rem");
    expect(formatValue(0, "px")).toBe("0px");
  });
});
