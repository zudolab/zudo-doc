import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateThemePack } from "../validator.js";

const PACKS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../theme-packs",
);

const SOFT_PACKS = ["graphite", "warm-mineral", "quiet-slate"] as const;

// The accepted soft-tone palette contract: syntax roles stay at or above
// 4.6:1 on every surface code can sit on, body text roles at or above 4.5:1.
const SYNTAX_MIN = 4.6;
const TEXT_MIN = 4.5;

type Pair = { light: string; dark: string };

function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const LIGHT_DARK = /light-dark\((#[0-9A-Fa-f]{6}),\s*(#[0-9A-Fa-f]{6})\)/;

function readPack(slug: string): string {
  return fs.readFileSync(path.join(PACKS_DIR, slug, "pack.css"), "utf8");
}

function tokens(css: string): Map<string, Pair> {
  const out = new Map<string, Pair>();
  for (const m of css.matchAll(/(--[a-z0-9-]+):\s*light-dark\((#[0-9A-Fa-f]{6}),\s*(#[0-9A-Fa-f]{6})\);/g)) {
    out.set(m[1]!, { light: m[2]!, dark: m[3]! });
  }
  return out;
}

/** Background of the first rule whose selector list contains `needle`. */
function ruleBackground(css: string, needle: string): Pair {
  const idx = css.indexOf(needle);
  expect(idx, `selector ${needle}`).toBeGreaterThan(-1);
  const body = css.slice(css.indexOf("{", idx), css.indexOf("}", idx));
  const decl = body.split("\n").find((l) => l.includes("background-color"));
  const m = decl?.match(LIGHT_DARK);
  expect(m, `background-color for ${needle}`).toBeTruthy();
  return { light: m![1]!, dark: m![2]! };
}

describe.each(SOFT_PACKS)("soft-tone pack %s", (slug) => {
  const css = readPack(slug);
  const t = tokens(css);
  const need = (name: string): Pair => {
    const v = t.get(name);
    expect(v, name).toBeDefined();
    return v!;
  };

  it("passes the theme-pack validator with no issues", () => {
    const result = validateThemePack({
      dirName: slug,
      metaRaw: JSON.parse(fs.readFileSync(path.join(PACKS_DIR, slug, "meta.json"), "utf8")),
      cssContent: css,
      fontFiles: [],
    });
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("never declares color-scheme or targets [data-theme]", () => {
    expect(css).not.toMatch(/(^|[;{\s])color-scheme\s*:/);
    expect(css).not.toMatch(/\[data-theme[=\]]/);
  });

  it("keeps every syntax role readable on code, line, word, insert and delete surfaces", () => {
    const surfaces: Record<string, Pair> = {
      code: need("--zd-code-bg"),
      inserted: need("--zfb-hi-ins-bg"),
      deleted: need("--zfb-hi-del-bg"),
      lineHighlight: ruleBackground(css, "pre.hi-root .line.highlighted"),
      wordHighlight: ruleBackground(css, "pre.hi-root .line .highlighted-word"),
    };
    const syntax = [...t.entries()].filter(([k]) => k.startsWith("--zd-syntax-"));
    expect(syntax.length).toBeGreaterThanOrEqual(9);
    for (const mode of ["light", "dark"] as const) {
      for (const [surface, bg] of Object.entries(surfaces)) {
        for (const [role, fg] of syntax) {
          const r = contrast(fg[mode], bg[mode]);
          expect(r, `${role} on ${surface} (${mode}) = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(SYNTAX_MIN);
        }
      }
    }
  });

  it("keeps body, muted and accent text readable on the page background", () => {
    const bg = need("--zd-bg");
    for (const mode of ["light", "dark"] as const) {
      for (const role of ["--zd-fg", "--zd-muted", "--zd-accent"]) {
        const r = contrast(need(role)[mode], bg[mode]);
        expect(r, `${role} (${mode}) = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(TEXT_MIN);
      }
    }
  });
});
