import { describe, it, expect } from "vitest";
import { defaultZIndexTiers } from "../z-index-defaults/index.js";

// Formerly also parity-checked against the `create-zudo-doc` base template's
// `z-index-tokens.ts` (#2654's port source). That template file was deleted
// by the minimal-scaffold cutover (epic #2651, Wave 6 #2660) — z-index
// tokens now ship unconditionally from `@takazudo/zudo-doc/theme.css`, so a
// project only needs its own copy when it overrides a tier (an eject-time
// decision, not a scaffold-time one). This module is now the sole source of
// truth; the exact-13-tiers boundary check below plus the ordering check
// give equivalent regression coverage without a deleted-file dependency
// (found stale during the #2667 final-confirm gate — see the same note in
// i18n-defaults.test.ts for why no earlier wave caught this).
describe("defaultZIndexTiers", () => {
  it("has 13 tiers (content=0 … drag=90)", () => {
    expect(defaultZIndexTiers).toHaveLength(13);
    expect(defaultZIndexTiers[0]).toEqual({ name: "content", value: 0 });
    expect(defaultZIndexTiers[defaultZIndexTiers.length - 1]).toEqual({
      name: "drag",
      value: 90,
    });
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
