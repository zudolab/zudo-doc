import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SPACING_TOKENS,
  FONT_TOKENS,
  SIZE_TOKENS,
} from "../design-tokens-manifest";

/**
 * Manifest coverage tests — ported from the deleted legacy tests in
 * src/components/design-token-tweak/__tests__/ (W3-2 zdtp-migration).
 *
 * These are zudo-doc-specific drift assertions: they read `global.css` and
 * assert every relevant custom property declared there has a matching entry
 * in the manifest arrays. This guards against CSS additions silently
 * falling out of the design-token panel tabs.
 */

const CSS_PATH = resolve(__dirname, "../../styles/global.css");

// ---------------------------------------------------------------------------
// SPACING_TOKENS coverage
// ---------------------------------------------------------------------------

function extractSpacingCustomProps(css: string): string[] {
  // Match `--spacing-<id>: <value>` (declarations only — not usages). Also
  // include `--zd-sidebar-w` since it's the one non-`--spacing-*` layout row.
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
});

// ---------------------------------------------------------------------------
// FONT_TOKENS coverage
// ---------------------------------------------------------------------------

function extractFontCustomProps(css: string): string[] {
  // Match declarations of tokens surfaced by the Font tab. Enumerate the
  // allowed prefixes explicitly so unrelated custom props (e.g. `--zd-*`,
  // `--color-*`) are ignored.
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
});

// ---------------------------------------------------------------------------
// SIZE_TOKENS coverage
// ---------------------------------------------------------------------------

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
});
