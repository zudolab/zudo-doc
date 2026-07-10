import { describe, it, expect } from "vitest";
import { DEFAULT_MIRROR } from "../zfb-config-gen.js";
// Test-only import of the built package. This does NOT make the generator
// itself depend on @takazudo/zudo-doc (its SOURCE still has no such import —
// see the DEFAULT_MIRROR header comment in zfb-config-gen.ts); it only lets
// this drift-guard read the real DEFAULT_SETTINGS values to compare against.
// The package's dist is built before workspace package tests run (root
// `pnpm test` = build @takazudo/zudo-doc → test:unit → test:packages).
import { DEFAULT_SETTINGS } from "@takazudo/zudo-doc/config";

// DEFAULT_MIRROR is a hand-kept LOCAL copy of the package's DEFAULT_SETTINGS,
// deliberately restricted to only the fields this generator can ever set
// ("Only fields this generator can ever set need an entry" — the file header).
// So the contract is a SUBSET check: every key present in the mirror must
// exist in DEFAULT_SETTINGS and carry a byte-identical default value. A drift
// (someone changes a package default but forgets the mirror) fails here.
describe("DEFAULT_MIRROR is a faithful subset of @takazudo/zudo-doc's DEFAULT_SETTINGS", () => {
  const settings = DEFAULT_SETTINGS as unknown as Record<string, unknown>;

  it("has at least the fields the generator sets (sanity)", () => {
    expect(Object.keys(DEFAULT_MIRROR).length).toBeGreaterThan(20);
  });

  it.each(Object.keys(DEFAULT_MIRROR))(
    "mirror.%s exists in DEFAULT_SETTINGS",
    (key) => {
      expect(
        key in settings,
        `DEFAULT_MIRROR has "${key}" but DEFAULT_SETTINGS does not — the ` +
          `package field was renamed/removed; update the mirror.`,
      ).toBe(true);
    },
  );

  it.each(Object.keys(DEFAULT_MIRROR))(
    "mirror.%s deep-equals the package default",
    (key) => {
      expect(
        settings[key],
        `DEFAULT_MIRROR["${key}"] drifted from @takazudo/zudo-doc's ` +
          `DEFAULT_SETTINGS["${key}"] — the diff-from-defaults generator will ` +
          `emit (or omit) this field incorrectly. Re-sync the mirror.`,
      ).toEqual(DEFAULT_MIRROR[key]);
    },
  );
});
