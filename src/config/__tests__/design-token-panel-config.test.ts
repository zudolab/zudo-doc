import { describe, it, expect } from "vitest";
import { designTokenPanelConfig } from "../design-token-panel-config";
import { colorTweakPresets } from "../color-tweak-presets";

describe("designTokenPanelConfig", () => {
  it("storagePrefix is exactly 'zudo-doc-tweak' — regression guard for storage-key continuity", () => {
    // This value is the only prefix that produces storage keys matching all
    // four existing persisted-state keys. Changing it would silently lose
    // every user's persisted tweaks on first load after migration.
    // See: src/__inbox/zdtp-migration-gaps.md §2 and §8.2.
    expect(designTokenPanelConfig.storagePrefix).toBe("zudo-doc-tweak");
  });

  it("paletteCssVarTemplate produces '--zd-0' when '{n}' is replaced with '0'", () => {
    const template = designTokenPanelConfig.colorCluster.paletteCssVarTemplate;
    expect(template.replace("{n}", "0")).toBe("--zd-0");
  });

  it("tokens.color is an empty array — color is cluster-driven, not per-token", () => {
    expect(designTokenPanelConfig.tokens.color).toEqual([]);
  });

  it("every key in colorTweakPresets round-trips through JSON.stringify", () => {
    // Verifies the JSON-serializable constraint: PanelConfig must be passable
    // through JSON.stringify/JSON.parse without data loss (Astro prop injection
    // and zdtp's configurePanel idempotency check both rely on this).
    for (const [key, preset] of Object.entries(colorTweakPresets)) {
      expect(
        () => JSON.parse(JSON.stringify(preset)),
        `preset "${key}" should be JSON-serializable`,
      ).not.toThrow();
      const roundTripped = JSON.parse(JSON.stringify(preset));
      expect(roundTripped, `preset "${key}" round-trip should match`).toEqual(preset);
    }
  });
});
