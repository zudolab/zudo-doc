import { describe, it, expect } from "vitest";
import { designTokenPanelConfig } from "../design-token-panel-config";

describe("designTokenPanelConfig", () => {
  it("storagePrefix is exactly 'zudo-doc-tweak' — regression guard for storage-key continuity", () => {
    // This value is the only prefix that produces storage keys matching all
    // existing persisted-state keys. Changing it would silently lose every
    // user's persisted tweaks on first load.
    expect(designTokenPanelConfig.storagePrefix).toBe("zudo-doc-tweak");
  });

  it("ships exactly five tabs in order: palette, color, font, spacing, size", () => {
    expect(designTokenPanelConfig.tabs.map((t) => t.id)).toEqual([
      "palette",
      "color",
      "font",
      "spacing",
      "size",
    ]);
  });

  describe("palette tab — ramp curve editor (base / accent / state)", () => {
    const paletteTab = designTokenPanelConfig.tabs.find((t) => t.id === "palette");

    it("exists with three ramp tiers: base, accent, state", () => {
      expect(paletteTab).toBeDefined();
      expect(paletteTab!.tiers.map((t) => t.id)).toEqual([
        "base",
        "accent",
        "state",
      ]);
    });

    it("omits colorExtras (required for a multi-color-tier tab so zdtp renders the native curve editor)", () => {
      expect(paletteTab!.colorExtras).toBeUndefined();
    });

    it("base tier has 5 tokens --palette-base-0..4, all kind:'color' oklch", () => {
      const base = paletteTab!.tiers.find((t) => t.id === "base")!;
      expect(base.items).toHaveLength(5);
      expect(base.items[0].cssVar).toBe("--palette-base-0");
      expect(base.items[4].cssVar).toBe("--palette-base-4");
      for (const item of base.items) {
        expect(item.type).toEqual({ kind: "color", format: "oklch" });
      }
    });

    it("accent tier has 3 tokens --palette-accent-0..2, all kind:'color' oklch", () => {
      const accent = paletteTab!.tiers.find((t) => t.id === "accent")!;
      expect(accent.items).toHaveLength(3);
      expect(accent.items[0].cssVar).toBe("--palette-accent-0");
      expect(accent.items[2].cssVar).toBe("--palette-accent-2");
      for (const item of accent.items) {
        expect(item.type).toEqual({ kind: "color", format: "oklch" });
      }
    });

    it("state tier has 4 tokens (danger/success/warning/info), all kind:'color' oklch", () => {
      const state = paletteTab!.tiers.find((t) => t.id === "state")!;
      expect(state.items).toHaveLength(4);
      expect(state.items.map((i) => i.cssVar)).toEqual([
        "--palette-state-danger",
        "--palette-state-success",
        "--palette-state-warning",
        "--palette-state-info",
      ]);
      for (const item of state.items) {
        expect(item.type).toEqual({ kind: "color", format: "oklch" });
      }
    });
  });

  describe("color tab — semantic tokens as direct OKLCH swatches (Option b)", () => {
    const colorTab = designTokenPanelConfig.tabs.find((t) => t.id === "color");

    it("exists with a single semantic tier and carries colorExtras (cluster id 'zudo-doc')", () => {
      expect(colorTab).toBeDefined();
      expect(colorTab!.tiers.map((t) => t.id)).toEqual(["semantic"]);
      expect(colorTab!.colorExtras?.id).toBe("zudo-doc");
    });

    it("semantic tier has 23 --zd-* roles, all direct kind:'color' oklch (concrete defaults)", () => {
      const semantic = colorTab!.tiers.find((t) => t.id === "semantic")!;
      expect(semantic.items).toHaveLength(23);
      expect(semantic.items[0].cssVar).toBe("--zd-surface");
      for (const item of semantic.items) {
        expect(item.cssVar.startsWith("--zd-")).toBe(true);
        expect(item.type).toEqual({ kind: "color", format: "oklch" });
        // Option (b): concrete OKLCH default, not a palette-index reference id.
        expect(item.default.startsWith("oklch(")).toBe(true);
      }
    });

    it("semantic tier does NOT use referencesTier (Option b: intra-tab only, no cross-ramp refs)", () => {
      const semantic = colorTab!.tiers.find((t) => t.id === "semantic")!;
      expect(semantic.referencesTier).toBeUndefined();
    });

    it("cluster is scheme-less: colorExtras.colorSchemes is empty (ramps are the source of truth)", () => {
      expect(colorTab!.colorExtras?.colorSchemes).toEqual({});
    });
  });

  it("carries no cursor tier, shiki tier, or preset (colorPresets) wiring anywhere", () => {
    const allTierIds = designTokenPanelConfig.tabs.flatMap((t) =>
      t.tiers.map((tier) => tier.id),
    );
    expect(allTierIds).not.toContain("cursor");
    expect(allTierIds).not.toContain("shiki");
    // Preset wiring was dropped in the ramp restructure.
    expect(designTokenPanelConfig.colorPresets).toBeUndefined();
  });
});
