import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
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
