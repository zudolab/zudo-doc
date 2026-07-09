import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultZIndexTiers } from "../z-index-defaults/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const templatePath = resolve(
  repoRoot,
  "packages/create-zudo-doc/templates/base/src/config/z-index-tokens.ts",
);

/** Extract ordered `{ name, value }` pairs from the template's `Z_INDEX_TIERS`
 *  literal array via static text parsing (name/value always appear together,
 *  name first, in each tier object). */
function extractTemplateTiers(): Array<{ name: string; value: number }> {
  const src = readFileSync(templatePath, "utf8");
  const re = /name:\s*"([\w-]+)",\s*\n\s*value:\s*(-?\d+),/g;
  return [...src.matchAll(re)].map((m) => ({
    name: m[1] as string,
    value: Number(m[2]),
  }));
}

describe("defaultZIndexTiers", () => {
  const templateTiers = extractTemplateTiers();

  it("has 13 tiers (content=0 … drag=90)", () => {
    expect(defaultZIndexTiers).toHaveLength(13);
    expect(defaultZIndexTiers[0]).toEqual({ name: "content", value: 0 });
    expect(defaultZIndexTiers[defaultZIndexTiers.length - 1]).toEqual({
      name: "drag",
      value: 90,
    });
  });

  it("matches the template's tier name+value list exactly, in order", () => {
    expect(templateTiers.length).toBeGreaterThan(0);
    expect([...defaultZIndexTiers]).toEqual(templateTiers);
  });

  it("every tier name is unique", () => {
    const names = defaultZIndexTiers.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("values are non-decreasing in declared order (ascending stacking scale)", () => {
    for (let i = 1; i < defaultZIndexTiers.length; i++) {
      const prev = defaultZIndexTiers[i - 1];
      const cur = defaultZIndexTiers[i];
      if (!prev || !cur) continue;
      expect(cur.value).toBeGreaterThanOrEqual(prev.value);
    }
  });

  it("is plain serializable JSON", () => {
    expect(() => JSON.parse(JSON.stringify(defaultZIndexTiers))).not.toThrow();
  });
});
