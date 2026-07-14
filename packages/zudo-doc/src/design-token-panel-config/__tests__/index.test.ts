// Unit coverage for the PACKAGE-DEFAULT design-token-panel PanelConfig
// builder (#2658). Fast — no zfb build involved.

import { describe, expect, it } from "vitest";
import { buildDesignTokenPanelConfig } from "../index.js";

describe("buildDesignTokenPanelConfig — panel identity (HARD GATE: storagePrefix unchanged)", () => {
  it("keeps storagePrefix 'zudo-doc-tweak' — the user-save carry-over guarantee", () => {
    expect(buildDesignTokenPanelConfig("light").storagePrefix).toBe("zudo-doc-tweak");
    expect(buildDesignTokenPanelConfig("dark").storagePrefix).toBe("zudo-doc-tweak");
  });

  it("carries the other panel-identity constants verbatim from the showcase original", () => {
    const config = buildDesignTokenPanelConfig("light");
    expect(config.consoleNamespace).toBe("zudoDoc");
    expect(config.modalClassPrefix).toBe("zudo-doc-design-token-panel-modal");
    expect(config.schemaId).toBe("zudo-design-tokens/v3");
    expect(config.exportFilenameBase).toBe("zudo-doc-design-tokens");
  });
});

describe("buildDesignTokenPanelConfig — tab structure", () => {
  it("emits the five expected tabs in order: palette, color, font, spacing, size", () => {
    const config = buildDesignTokenPanelConfig("light");
    expect(config.tabs.map((t) => t.id)).toEqual(["palette", "color", "font", "spacing", "size"]);
  });

  it("the palette tab has base/accent/state ramp tiers with no colorExtras", () => {
    const palette = buildDesignTokenPanelConfig("light").tabs.find((t) => t.id === "palette")!;
    expect(palette.tiers.map((t) => t.id)).toEqual(["base", "accent", "state"]);
    expect(palette.colorExtras).toBeUndefined();
    // 5 base stops, 3 accent stops, 4 state roles — matches the minimized ramp (#2602).
    expect(palette.tiers.find((t) => t.id === "base")!.items).toHaveLength(5);
    expect(palette.tiers.find((t) => t.id === "accent")!.items).toHaveLength(3);
    expect(palette.tiers.find((t) => t.id === "state")!.items).toHaveLength(4);
  });

  it("the color tab has one semantic tier with base, UI semantic, and syntax rows", () => {
    const color = buildDesignTokenPanelConfig("light").tabs.find((t) => t.id === "color")!;
    expect(color.tiers).toHaveLength(1);
    expect(color.tiers[0]!.id).toBe("semantic");
    expect(color.tiers[0]!.items).toHaveLength(36);
    expect(color.tiers[0]!.items.slice(-9).map((item) => item.id)).toEqual([
      "syntaxComment",
      "syntaxString",
      "syntaxNumber",
      "syntaxKeyword",
      "syntaxCallable",
      "syntaxType",
      "syntaxName",
      "syntaxInserted",
      "syntaxDeleted",
    ]);
  });

  it("the font tab's role tier references the font-scale tier (three-tier font strategy)", () => {
    const font = buildDesignTokenPanelConfig("light").tabs.find((t) => t.id === "font")!;
    const roleTier = font.tiers.find((t) => t.id === "font-size")!;
    expect(roleTier.referencesTier).toBe("font-scale");
  });
});

describe("buildDesignTokenPanelConfig — mode-scoping (#2610 mode-scoped BUILDER contract)", () => {
  it("is a function taking mode, not a plain resolved config (HARD GATE #4)", () => {
    expect(typeof buildDesignTokenPanelConfig).toBe("function");
  });

  it("light and dark modes produce structurally-different Color tab semantic defaults", () => {
    const light = buildDesignTokenPanelConfig("light");
    const dark = buildDesignTokenPanelConfig("dark");
    const lightBg = light.tabs.find((t) => t.id === "color")!.tiers[0]!.items.find((i) => i.id === "bg")!.default;
    const darkBg = dark.tabs.find((t) => t.id === "color")!.tiers[0]!.items.find((i) => i.id === "bg")!.default;
    // Default Light: bg = base:base-0 (lightest). Default Dark: bg = base:base-4 (darkest).
    expect(lightBg).toBe("base:base-0");
    expect(darkBg).toBe("base:base-4");
  });

  it("uses mode-specific diff overrides while inherited syntax rows stay ramp references", () => {
    const lightItems = buildDesignTokenPanelConfig("light").tabs.find((t) => t.id === "color")!.tiers[0]!.items;
    const darkItems = buildDesignTokenPanelConfig("dark").tabs.find((t) => t.id === "color")!.tiers[0]!.items;
    const light = new Map(lightItems.map((item) => [item.id, item.default]));
    const dark = new Map(darkItems.map((item) => [item.id, item.default]));

    expect(light.get("syntaxComment")).toBe("base:base-2");
    expect(dark.get("syntaxComment")).toBe("base:base-1");
    expect(light.get("syntaxInserted")).toBe("oklch(.460 .140 145)");
    expect(dark.get("syntaxInserted")).toBe("oklch(.750 .145 145)");
  });

  it("light and dark modes share identical Palette-tab ramp values (ramps are mode-independent)", () => {
    const light = buildDesignTokenPanelConfig("light");
    const dark = buildDesignTokenPanelConfig("dark");
    expect(light.tabs.find((t) => t.id === "palette")).toEqual(dark.tabs.find((t) => t.id === "palette"));
  });

  it("panelSettings.colorMode.defaultMode follows the requested mode", () => {
    const light = buildDesignTokenPanelConfig("light");
    const dark = buildDesignTokenPanelConfig("dark");
    const lightColorTab = light.tabs.find((t) => t.id === "color")!;
    const darkColorTab = dark.tabs.find((t) => t.id === "color")!;
    expect(lightColorTab.colorExtras?.panelSettings?.colorMode).toMatchObject({ defaultMode: "light" });
    expect(darkColorTab.colorExtras?.panelSettings?.colorMode).toMatchObject({ defaultMode: "dark" });
  });
});
