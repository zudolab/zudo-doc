import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SIZE_TOKENS,
  SIZE_GROUP_ORDER,
  parseNumericValue,
} from "../tokens/manifest";

/**
 * Size-tab coverage test.
 *
 * Mirrors the spacing coverage test: read `global.css` and assert every
 * size-category custom property (radius + transition/timing) declared there
 * has a matching entry in `SIZE_TOKENS`.
 *
 * Breakpoints (`--breakpoint-*`) are intentionally excluded by the Size sub-
 * issue (live-changing them causes layout thrash). The regex below omits
 * them so an ignored breakpoint declaration doesn't flag a false positive.
 */

const CSS_PATH = resolve(__dirname, "../../../styles/global.css");

/** Size-category custom props we expect SIZE_TOKENS to cover. */
const SIZE_PROP_PATTERNS = [
  /(--radius-[a-zA-Z0-9-]+)\s*:/g,
  /(--default-transition-duration)\s*:/g,
];

function extractSizeCustomProps(css: string): string[] {
  const props = new Set<string>();
  for (const re of SIZE_PROP_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(css)) !== null) {
      props.add(m[1]);
    }
  }
  return [...props];
}

describe("SIZE_TOKENS manifest coverage", () => {
  const css = readFileSync(CSS_PATH, "utf8");
  const found = extractSizeCustomProps(css);

  it("covers every size-category custom property declared in global.css", () => {
    const manifestVars = new Set(SIZE_TOKENS.map((t) => t.cssVar));
    const missing = found.filter((v) => !manifestVars.has(v));
    expect(missing, `missing from manifest: ${missing.join(", ")}`).toEqual([]);
  });

  it("has unique ids and unique cssVars", () => {
    const ids = SIZE_TOKENS.map((t) => t.id);
    const vars = SIZE_TOKENS.map((t) => t.cssVar);
    expect(new Set(ids).size, "duplicate ids").toBe(ids.length);
    expect(new Set(vars).size, "duplicate cssVars").toBe(vars.length);
  });

  it("has valid numeric defaults (pill tokens may exceed slider max)", () => {
    for (const t of SIZE_TOKENS) {
      if (t.readonly) continue;
      const n = parseNumericValue(t.default);
      expect(n, `default not parseable for ${t.id}`).not.toBeNull();
      expect(t.step).toBeGreaterThan(0);
      if (!t.pill) {
        // Non-pill tokens must sit inside the slider range.
        expect(n!).toBeGreaterThanOrEqual(t.min);
        expect(n!).toBeLessThanOrEqual(t.max);
      } else {
        // Pill tokens: customDefault must be slider-editable.
        const cd = parseNumericValue(t.pill.customDefault);
        expect(cd, `pill.customDefault not parseable for ${t.id}`).not.toBeNull();
        expect(cd!).toBeGreaterThanOrEqual(t.min);
        expect(cd!).toBeLessThanOrEqual(t.max);
        // Pill value must parse too (even if it exceeds slider max).
        const pv = parseNumericValue(t.pill.value);
        expect(pv, `pill.value not parseable for ${t.id}`).not.toBeNull();
      }
    }
  });

  it("every token belongs to a group declared in SIZE_GROUP_ORDER", () => {
    const known = new Set(SIZE_GROUP_ORDER);
    for (const t of SIZE_TOKENS) {
      expect(known.has(t.group), `group "${t.group}" on ${t.id} missing from SIZE_GROUP_ORDER`).toBe(true);
    }
  });
});
