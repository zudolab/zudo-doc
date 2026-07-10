import { describe, it, expect } from "vitest";
import {
  designTokenPanelConfig,
  buildDesignTokenPanelConfig,
} from "../design-token-panel-config";
import {
  SEMANTIC_KEYS,
  SEMANTIC_CSS_NAMES,
  resolveRampRef,
  resolveSemanticColors,
  type Ramps,
  type StateRole,
} from "@takazudo/zudo-doc/color-scheme-utils";
import { defaultColorSchemes as colorSchemes } from "@takazudo/zudo-doc/color-schemes-defaults";
import { settings } from "../settings";

/**
 * Decode a panel-encoded ramp default (`'base:base-4'` / `'accent:accent-1'` /
 * `'state:state-success'`, or a literal `oklch(...)` passthrough) back to a
 * concrete color, given the ramps it was encoded against. Independent of
 * `rampRefToPanelDefault` (the encoder under test) so the parity guard below
 * actually exercises the encode/decode round-trip rather than tautologically
 * agreeing with itself.
 */
function decodeRampDefault(encoded: string, ramps: Ramps): string {
  if (encoded.startsWith("oklch(")) return encoded;
  const [tierId, itemId] = encoded.split(":");
  if (tierId === "base" && itemId) {
    const color = ramps.base[Number(itemId.slice("base-".length))];
    if (color === undefined) throw new Error(`base index out of range: ${encoded}`);
    return color;
  }
  if (tierId === "accent" && itemId) {
    const color = ramps.accent[Number(itemId.slice("accent-".length))];
    if (color === undefined) throw new Error(`accent index out of range: ${encoded}`);
    return color;
  }
  if (tierId === "state" && itemId) {
    const role = itemId.slice("state-".length) as StateRole;
    return ramps.state[role];
  }
  throw new Error(`unrecognized panel-default encoding: ${encoded}`);
}

// 4 base-role rows in the semantic tier, ahead of the 23 SEMANTIC_KEYS rows.
const BASE_ROLE_ROWS = [
  { id: "bg", cssVar: "--zd-bg", mapKey: "bg" },
  { id: "fg", cssVar: "--zd-fg", mapKey: "fg" },
  { id: "selection-bg", cssVar: "--zd-selection-bg", mapKey: "selectionBg" },
  { id: "selection-fg", cssVar: "--zd-selection-fg", mapKey: "selectionFg" },
] as const;

// Per-mode expected panel-encoded defaults for all 27 rows, derived from
// @takazudo/zudo-doc/color-schemes-defaults's darkMap/lightMap (NOT copied
// from the issue text — recomputed against the landed ramps/map so a future
// ramp edit that forgets to update this table fails loud).
const EXPECTED_DEFAULTS: Record<"light" | "dark", Record<string, string>> = {
  dark: {
    bg: "base:base-4",
    fg: "base:base-0",
    "selection-bg": "base:base-2",
    "selection-fg": "base:base-0",
    surface: "base:base-4",
    muted: "base:base-1",
    accent: "accent:accent-1",
    accentHover: "accent:accent-0",
    codeBg: "base:base-3",
    codeFg: "base:base-0",
    success: "state:state-success",
    danger: "oklch(.655 .170 25)",
    warning: "state:state-warning",
    info: "state:state-info",
    mermaidNodeBg: "base:base-3",
    mermaidText: "base:base-0",
    mermaidLine: "base:base-1",
    mermaidLabelBg: "base:base-3",
    mermaidNoteBg: "base:base-2",
    chatUserBg: "accent:accent-1",
    chatUserText: "base:base-4",
    chatAssistantBg: "base:base-4",
    chatAssistantText: "base:base-0",
    imageOverlayBg: "base:base-4",
    imageOverlayFg: "base:base-0",
    matchedKeywordBg: "oklch(.700 .158 62)",
    matchedKeywordFg: "oklch(.300 .003 65)",
  },
  light: {
    bg: "base:base-0",
    fg: "base:base-4",
    "selection-bg": "base:base-1",
    "selection-fg": "base:base-4",
    surface: "base:base-0",
    muted: "base:base-2",
    accent: "accent:accent-2",
    accentHover: "oklch(.400 .096 56)",
    codeBg: "base:base-0",
    codeFg: "base:base-4",
    success: "oklch(.470 .140 145)",
    danger: "oklch(.505 .170 25)",
    warning: "oklch(.490 .100 82)",
    info: "oklch(.485 .122 245)",
    mermaidNodeBg: "base:base-1",
    mermaidText: "base:base-4",
    mermaidLine: "base:base-2",
    mermaidLabelBg: "base:base-1",
    mermaidNoteBg: "base:base-1",
    chatUserBg: "accent:accent-1",
    chatUserText: "base:base-4",
    chatAssistantBg: "base:base-0",
    chatAssistantText: "base:base-4",
    imageOverlayBg: "base:base-4",
    imageOverlayFg: "base:base-0",
    matchedKeywordBg: "oklch(.700 .158 62)",
    matchedKeywordFg: "oklch(.300 .003 65)",
  },
};

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

  it("carries no cursor tier, shiki tier, or preset (colorPresets) wiring anywhere", () => {
    const allTierIds = designTokenPanelConfig.tabs.flatMap((t) =>
      t.tiers.map((tier) => tier.id),
    );
    expect(allTierIds).not.toContain("cursor");
    expect(allTierIds).not.toContain("shiki");
    // Preset wiring was dropped in the ramp restructure.
    expect(
      (designTokenPanelConfig as { colorPresets?: unknown }).colorPresets,
    ).toBeUndefined();
  });

  describe("palette tab — ramp curve editor (base / accent / state), untouched by the Color tab rewrite", () => {
    const paletteTab = designTokenPanelConfig.tabs.find((t) => t.id === "palette");

    it("exists with three ramp tiers: base, accent, state", () => {
      expect(paletteTab).toBeDefined();
      expect(paletteTab!.tiers.map((t) => t.id)).toEqual(["base", "accent", "state"]);
    });

    it("omits colorExtras (required for a multi-color-tier tab so zdtp renders the native curve editor)", () => {
      expect(paletteTab!.colorExtras).toBeUndefined();
    });

    it("base tier has 5 tokens --palette-base-0..4, all kind:'color' oklch", () => {
      const base = paletteTab!.tiers.find((t) => t.id === "base")!;
      expect(base.items).toHaveLength(5);
      expect(base.items[0]!.cssVar).toBe("--palette-base-0");
      expect(base.items[4]!.cssVar).toBe("--palette-base-4");
      for (const item of base.items) {
        expect(item.type).toEqual({ kind: "color", format: "oklch" });
      }
    });

    it("accent tier has 3 tokens --palette-accent-0..2, all kind:'color' oklch", () => {
      const accent = paletteTab!.tiers.find((t) => t.id === "accent")!;
      expect(accent.items).toHaveLength(3);
      expect(accent.items[0]!.cssVar).toBe("--palette-accent-0");
      expect(accent.items[2]!.cssVar).toBe("--palette-accent-2");
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

  describe("color tab — mode-scoped semantic tier referencing the Palette tab's ramps", () => {
    // Mode is inert for structure/shape assertions — either mode's build works.
    const colorTab = buildDesignTokenPanelConfig("dark").tabs.find((t) => t.id === "color")!;
    const semantic = colorTab.tiers.find((t) => t.id === "semantic")!;

    it("exists with a single semantic tier", () => {
      expect(colorTab).toBeDefined();
      expect(colorTab.tiers.map((t) => t.id)).toEqual(["semantic"]);
    });

    it("semantic tier is marked semantic:true and does NOT use referencesTier", () => {
      expect(semantic.semantic).toBe(true);
      expect(semantic.referencesTier).toBeUndefined();
    });

    it("semantic tier declares referencesRamps pointing at the Palette tab's base/accent/state tiers, in that exact order", () => {
      expect(semantic.referencesRamps).toEqual([
        { tab: "palette", tier: "base" },
        { tab: "palette", tier: "accent" },
        { tab: "palette", tier: "state" },
      ]);
    });

    it("carries colorExtras with cluster id 'zudo-doc' and a scheme-less registry (colorSchemes: {})", () => {
      expect(colorTab.colorExtras?.id).toBe("zudo-doc");
      expect(colorTab.colorExtras?.colorSchemes).toEqual({});
    });

    it("colorExtras has empty baseRoles/baseDefaults — the semantic tier owns all roles, not a base-role editor", () => {
      expect(colorTab.colorExtras?.baseRoles).toEqual({});
      expect(colorTab.colorExtras?.baseDefaults).toEqual({});
    });

    it("colorExtras.panelSettings carries a non-empty colorScheme and a colorMode object with defaultMode", () => {
      const panelSettings = colorTab.colorExtras!.panelSettings;
      expect(panelSettings.colorScheme).toBe(settings.colorScheme);
      expect(panelSettings.colorScheme.length).toBeGreaterThan(0);
      expect(panelSettings.colorMode).not.toBe(false);
      expect(panelSettings.colorMode).toMatchObject({ defaultMode: "dark" });
    });

    it("has exactly 27 rows: bg/fg/selection-bg/selection-fg first, then the 23 SEMANTIC_KEYS in order", () => {
      expect(semantic.items).toHaveLength(27);
      const expectedIds = [...BASE_ROLE_ROWS.map((r) => r.id), ...SEMANTIC_KEYS];
      expect(semantic.items.map((i) => i.id)).toEqual(expectedIds);
    });

    it("row cssVars match --zd-bg/--zd-fg/--zd-selection-{bg,fg} then SEMANTIC_CSS_NAMES", () => {
      const expectedCssVars = [
        ...BASE_ROLE_ROWS.map((r) => r.cssVar),
        ...SEMANTIC_KEYS.map((k) => SEMANTIC_CSS_NAMES[k]),
      ];
      expect(semantic.items.map((i) => i.cssVar)).toEqual(expectedCssVars);
    });

    it("every row is kind:'color' format:'oklch'", () => {
      for (const item of semantic.items) {
        expect(item.type).toEqual({ kind: "color", format: "oklch" });
      }
    });
  });

  describe.each(["dark", "light"] as const)(
    "per-mode default encodings — buildDesignTokenPanelConfig('%s')",
    (mode) => {
      const semantic = buildDesignTokenPanelConfig(mode)
        .tabs.find((t) => t.id === "color")!
        .tiers.find((t) => t.id === "semantic")!;
      const scheme = mode === "dark" ? colorSchemes["Default Dark"]! : colorSchemes["Default Light"]!;

      it("panelSettings.colorMode.defaultMode matches the build mode", () => {
        const colorTab = buildDesignTokenPanelConfig(mode).tabs.find((t) => t.id === "color")!;
        expect(colorTab.colorExtras!.panelSettings.colorMode).toMatchObject({ defaultMode: mode });
      });

      it.each(semantic.items.map((item) => [item.id, item] as const))(
        "row '%s' encodes the expected ramp-ref/literal default",
        (id, item) => {
          expect(item.default).toBe(EXPECTED_DEFAULTS[mode][id]);
        },
      );

      it("parity (no-snapping guard): every row's decoded default resolves to the exact scheme color", () => {
        for (const row of BASE_ROLE_ROWS) {
          const item = semantic.items.find((i) => i.id === row.id)!;
          const decoded = decodeRampDefault(item.default, scheme.ramps);
          const expected = resolveRampRef(scheme.map[row.mapKey], scheme.ramps);
          expect(decoded).toBe(expected);
        }
        const resolved = resolveSemanticColors(scheme);
        for (const key of SEMANTIC_KEYS) {
          const item = semantic.items.find((i) => i.id === key)!;
          const decoded = decodeRampDefault(item.default, scheme.ramps);
          expect(decoded).toBe(resolved[key]);
        }
      });
    },
  );
});
