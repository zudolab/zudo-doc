import { describe, it, expect } from "vitest";
import { designTokenPanelConfig } from "../design-token-panel-config";

describe("designTokenPanelConfig", () => {
  it("storagePrefix is exactly 'zudo-doc-tweak' — regression guard for storage-key continuity", () => {
    // This value is the only prefix that produces storage keys matching all
    // four existing persisted-state keys. Changing it would silently lose
    // every user's persisted tweaks on first load after migration.
    // See: src/__inbox/zdtp-migration-gaps.md §2 and §8.2.
    expect(designTokenPanelConfig.storagePrefix).toBe("zudo-doc-tweak");
  });

  it("color tab's palette tier writes --zd-0..--zd-15 (drives the derived paletteCssVarTemplate)", () => {
    // In the new tabs[] API the palette CSS-var template is no longer a
    // literal field — zdtp derives it from the first palette item's cssVar
    // (replacing the trailing digit run with `{n}`). We assert the items
    // directly to pin the bridge's input.
    const colorTab = designTokenPanelConfig.tabs.find((t) => t.id === "color");
    expect(colorTab).toBeDefined();
    const paletteTier = colorTab!.tiers.find((t) => t.id === "palette");
    expect(paletteTier).toBeDefined();
    expect(paletteTier!.items).toHaveLength(16);
    expect(paletteTier!.items[0].cssVar).toBe("--zd-0");
    expect(paletteTier!.items[15].cssVar).toBe("--zd-15");
  });

  it("color tab carries colorExtras with the cluster id 'zudo-doc'", () => {
    const colorTab = designTokenPanelConfig.tabs.find((t) => t.id === "color");
    expect(colorTab?.colorExtras?.id).toBe("zudo-doc");
  });

  it("ships exactly four tabs: color, font, spacing, size", () => {
    expect(designTokenPanelConfig.tabs.map((t) => t.id)).toEqual([
      "color",
      "font",
      "spacing",
      "size",
    ]);
  });
});
