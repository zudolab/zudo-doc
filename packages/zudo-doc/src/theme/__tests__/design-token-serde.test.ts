// Moved from src/utils/__tests__/design-token-serde.test.ts as part of W3B
// (#1730 — Generator Pages Migration). The serde + types live in v2 now, so
// the tests live alongside them.
//
// W3B (#1730): the host `@/config/design-tokens-manifest` is intentionally not
// imported here — the serde now takes a `manifest` argument, so tests use a
// small inline fixture covering the exact ids the assertions rely on
// (`hsp-md`, `vsp-sm`, `text-body`, `radius-DEFAULT`). Adding new
// assertions? Extend the fixture rather than reaching back into host config.
//
// Color Ramp Restructure (#2591): the color slice is now the ramp-native
// `ColorScheme` ({ ramps, map }). The fixtures below build a synthetic-but-valid
// scheme (12 base stops, 7 accent, 4 state, full map) so a leak of the wrong
// scheme is spottable at a glance.
import { describe, it, expect, vi, afterEach } from "vitest";
// Local fixture type: a superset of the serde-module's narrower TokenDef that
// includes display-only fields (label, group, step, unit) used only by the
// test fixtures below. Keeps the test file free of the optional zdtp peer (#2138).
interface TokenDef {
  id: string;
  cssVar: string;
  default: string;
  readonly?: true;
  label?: string;
  group?: string;
  step?: number;
  unit?: string;
}
import {
  DESIGN_TOKEN_SCHEMA,
  DesignTokenSchemaError,
  deserialize,
  serialize,
  type DesignTokenJson,
  type DesignTokenManifest,
} from "../design-token-serde.js";
import type { TweakState } from "../design-token-types.js";
import {
  SEMANTIC_RAMP_DEFAULTS,
  type ColorScheme,
} from "../../color-scheme-utils.js";

const SPACING: readonly TokenDef[] = [
  { id: "hsp-md", cssVar: "--spacing-hsp-md", label: "hsp-md", group: "hsp", default: "0.75rem", step: 0.025, unit: "rem" },
  { id: "vsp-sm", cssVar: "--spacing-vsp-sm", label: "vsp-sm", group: "vsp", default: "1.25rem", step: 0.025, unit: "rem" },
];

const FONT: readonly TokenDef[] = [
  { id: "text-body", cssVar: "--text-body", label: "text-body", group: "font-size", default: "1.2rem", step: 0.05, unit: "rem" },
];

const SIZE: readonly TokenDef[] = [
  { id: "radius-DEFAULT", cssVar: "--radius-DEFAULT", label: "radius-DEFAULT", group: "radius", default: "4px", step: 1, unit: "px" },
  { id: "radius-lg", cssVar: "--radius-lg", label: "radius-lg", group: "radius", default: "8px", step: 1, unit: "px" },
];

const MANIFEST: DesignTokenManifest = { spacing: SPACING, font: FONT, size: SIZE };

/** Synthetic-but-valid 5-stop base ramp; distinct values so a leak is obvious. */
const BASE_RAMP = Array.from({ length: 5 }, (_, i) => `oklch(0.${900 - i * 60} 0.005 65)`);
/** Synthetic-but-valid 3-stop accent ramp. */
const ACCENT_RAMP = Array.from({ length: 3 }, (_, i) => `oklch(0.${800 - i * 70} 0.120 60)`);

const COLOR_BASELINE: ColorScheme = {
  ramps: {
    base: BASE_RAMP,
    accent: ACCENT_RAMP,
    state: {
      danger: "oklch(0.640 0.170 25)",
      success: "oklch(0.680 0.145 145)",
      warning: "oklch(0.760 0.135 82)",
      info: "oklch(0.680 0.130 245)",
    },
  },
  map: {
    bg: { base: 4 },
    fg: { base: 0 },
    selectionBg: { base: 2 },
    selectionFg: { base: 0 },
    semantic: { ...SEMANTIC_RAMP_DEFAULTS },
  },
};

function cloneBaseline(): ColorScheme {
  return structuredClone(COLOR_BASELINE);
}

function makeState(overrides: Partial<TweakState> = {}): TweakState {
  return {
    color: cloneBaseline(),
    spacing: {},
    font: {},
    size: {},
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("serialize", () => {
  it("always includes $schema and exportedAt", () => {
    const state = makeState();
    const json = serialize(state, { manifest: MANIFEST, colorDefaults: COLOR_BASELINE });
    expect(json.$schema).toBe(DESIGN_TOKEN_SCHEMA);
    expect(typeof json.exportedAt).toBe("string");
    expect(() => new Date(json.exportedAt).toISOString()).not.toThrow();
  });

  it("emits nothing in color/spacing/font/size when state matches baseline", () => {
    const json = serialize(makeState(), { manifest: MANIFEST, colorDefaults: COLOR_BASELINE });
    expect(json.color).toBeUndefined();
    expect(json.spacing).toBeUndefined();
    expect(json.font).toBeUndefined();
    expect(json.size).toBeUndefined();
  });

  it("emits only changed spacing tokens by default (diff-only)", () => {
    const state = makeState({ spacing: { "hsp-md": "1.125rem" } });
    const json = serialize(state, { manifest: MANIFEST, colorDefaults: COLOR_BASELINE });
    expect(json.spacing).toEqual({ "--spacing-hsp-md": "1.125rem" });
  });

  it("drops spacing overrides that match the manifest default", () => {
    // 0.75rem is the declared default for --spacing-hsp-md, so it should NOT
    // appear in diff-only output.
    const state = makeState({ spacing: { "hsp-md": "0.75rem" } });
    const json = serialize(state, { manifest: MANIFEST, colorDefaults: COLOR_BASELINE });
    expect(json.spacing).toBeUndefined();
  });

  it("emits full token blocks when includeDefaults=true", () => {
    const json = serialize(makeState(), {
      manifest: MANIFEST,
      colorDefaults: COLOR_BASELINE,
      includeDefaults: true,
    });
    expect(json.color).toBeDefined();
    expect(json.color?.ramps?.base).toHaveLength(5);
    expect(json.color?.ramps?.accent).toHaveLength(3);
    expect(json.color?.map?.bg).toEqual({ base: 4 });
    expect(json.spacing?.["--spacing-hsp-md"]).toBe("0.75rem");
    expect(json.font?.["--text-body"]).toBe("1.2rem");
    expect(json.size?.["--radius-DEFAULT"]).toBe("4px");
  });

  it("emits the whole ramps block when any stop differs (and omits an unchanged map)", () => {
    const color = cloneBaseline();
    color.ramps.base[2] = "oklch(0.500 0.300 300)";
    const json = serialize(makeState({ color }), {
      manifest: MANIFEST,
      colorDefaults: COLOR_BASELINE,
    });
    expect(json.color?.ramps?.base).toHaveLength(5);
    expect(json.color?.ramps?.base?.[2]).toBe("oklch(0.500 0.300 300)");
    // Map didn't change, so it stays out of the diff-only output.
    expect(json.color?.map).toBeUndefined();
  });

  it("emits the whole map block when a role ref differs (and omits unchanged ramps)", () => {
    const color = cloneBaseline();
    color.map.semantic.accent = { accent: 5 };
    const json = serialize(makeState({ color }), {
      manifest: MANIFEST,
      colorDefaults: COLOR_BASELINE,
    });
    expect(json.color?.map?.semantic.accent).toEqual({ accent: 5 });
    expect(json.color?.ramps).toBeUndefined();
  });

  it("emits a literal OKLCH role ref when the map uses one", () => {
    const color = cloneBaseline();
    color.map.selectionBg = "oklch(0.300 0.020 65)";
    const json = serialize(makeState({ color }), {
      manifest: MANIFEST,
      colorDefaults: COLOR_BASELINE,
    });
    expect(json.color?.map?.selectionBg).toBe("oklch(0.300 0.020 65)");
  });
});

describe("deserialize", () => {
  it("round-trips a diff-only export cleanly", () => {
    const color = cloneBaseline();
    color.ramps.accent[0] = "oklch(0.910 0.050 40)";
    color.map.fg = { base: 0 };
    const original = makeState({
      color,
      spacing: { "hsp-md": "1.125rem", "vsp-sm": "1rem" },
      font: { "text-body": "1.3rem" },
      size: { "radius-DEFAULT": "8px" },
    });

    const json = serialize(original, { manifest: MANIFEST, colorDefaults: COLOR_BASELINE });
    const parsed = JSON.parse(JSON.stringify(json));
    const { state, unknownTokens } = deserialize(parsed, {
      manifest: MANIFEST,
      colorDefaults: COLOR_BASELINE,
    });

    expect(unknownTokens).toEqual([]);
    expect(state.spacing).toEqual(original.spacing);
    expect(state.font).toEqual(original.font);
    expect(state.size).toEqual(original.size);
    expect(state.color).toEqual(original.color);
  });

  it("export → import (modal round-trip) reproduces the exact scheme", () => {
    // Mirrors the export-modal flow: serialize the panel state to a JSON string,
    // then re-import that string and expect an identical state.
    const color = cloneBaseline();
    color.ramps.base[0] = "oklch(0.995 0.010 20)";
    color.map.bg = { base: 3 };
    color.map.semantic.danger = "oklch(0.600 0.200 25)"; // literal OKLCH ref
    color.map.semantic.info = { state: "info" };
    const original = makeState({
      color,
      spacing: { "hsp-md": "1.5rem" },
      font: { "text-body": "1.4rem" },
    });

    const text = JSON.stringify(
      serialize(original, { manifest: MANIFEST, colorDefaults: COLOR_BASELINE }),
      null,
      2,
    );
    const { state, unknownTokens, warnings } = deserialize(JSON.parse(text), {
      manifest: MANIFEST,
      colorDefaults: COLOR_BASELINE,
    });

    expect(unknownTokens).toEqual([]);
    expect(warnings).toEqual([]);
    expect(state.color).toEqual(original.color);
    expect(state.spacing).toEqual(original.spacing);
    expect(state.font).toEqual(original.font);
  });

  it("full-dump round-trip (includeDefaults) reproduces the scheme", () => {
    const color = cloneBaseline();
    color.map.selectionFg = "oklch(0.980 0.003 65)";
    const original = makeState({ color });
    const text = JSON.stringify(
      serialize(original, {
        manifest: MANIFEST,
        colorDefaults: COLOR_BASELINE,
        includeDefaults: true,
      }),
    );
    const { state } = deserialize(JSON.parse(text), {
      manifest: MANIFEST,
      colorDefaults: COLOR_BASELINE,
    });
    expect(state.color).toEqual(original.color);
  });

  it("collects unknown CSS var names in unknownTokens", () => {
    const payload: DesignTokenJson = {
      $schema: DESIGN_TOKEN_SCHEMA,
      exportedAt: new Date().toISOString(),
      spacing: {
        "--spacing-hsp-md": "1.25rem",
        "--spacing-nope": "1rem",
      },
      size: {
        "--radius-imaginary": "20px",
      },
    };
    const { state, unknownTokens } = deserialize(payload, {
      manifest: MANIFEST,
      colorDefaults: COLOR_BASELINE,
    });
    expect(state.spacing).toEqual({ "hsp-md": "1.25rem" });
    expect(state.size).toEqual({});
    expect(unknownTokens.sort()).toEqual(
      ["--radius-imaginary", "--spacing-nope"].sort(),
    );
  });

  it("throws schema-mismatch when $schema is an unknown version", () => {
    expect(() =>
      deserialize(
        { $schema: "zudo-doc-design-tokens/v99", exportedAt: "x" },
        { manifest: MANIFEST, colorDefaults: COLOR_BASELINE },
      ),
    ).toThrowError(DesignTokenSchemaError);
  });

  it("throws schema-missing when $schema is absent", () => {
    try {
      deserialize({ exportedAt: "x" }, { manifest: MANIFEST, colorDefaults: COLOR_BASELINE });
      throw new Error("expected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(DesignTokenSchemaError);
      expect((err as DesignTokenSchemaError).reason).toBe("schema-missing");
    }
  });

  it("throws not-object for non-object input", () => {
    expect(() => deserialize("hello", { manifest: MANIFEST })).toThrowError(DesignTokenSchemaError);
    expect(() => deserialize(null, { manifest: MANIFEST })).toThrowError(DesignTokenSchemaError);
    expect(() => deserialize(42, { manifest: MANIFEST })).toThrowError(DesignTokenSchemaError);
  });

  it("falls back to baseline for absent color sub-blocks", () => {
    // A partial color block: only one semantic role is present. Everything else
    // (all ramps, all other map roles) fills from the baseline.
    const payload: DesignTokenJson = {
      $schema: DESIGN_TOKEN_SCHEMA,
      exportedAt: new Date().toISOString(),
      color: { map: { semantic: { accent: { accent: 5 } } } as never },
    };
    const { state } = deserialize(payload, { manifest: MANIFEST, colorDefaults: COLOR_BASELINE });
    expect(state.color.ramps).toEqual(COLOR_BASELINE.ramps);
    expect(state.color.map.semantic.accent).toEqual({ accent: 5 });
    expect(state.color.map.bg).toEqual(COLOR_BASELINE.map.bg);
    expect(state.color.map.semantic.muted).toEqual(COLOR_BASELINE.map.semantic.muted);
  });

  it("warns-then-falls-back when a ramp has the wrong length", () => {
    const payload: DesignTokenJson = {
      $schema: DESIGN_TOKEN_SCHEMA,
      exportedAt: new Date().toISOString(),
      color: { ramps: { base: ["oklch(0.9 0 0)", "oklch(0.8 0 0)"] } as never },
    };
    const { state, warnings } = deserialize(payload, {
      manifest: MANIFEST,
      colorDefaults: COLOR_BASELINE,
    });
    expect(state.color.ramps.base).toEqual(COLOR_BASELINE.ramps.base);
    expect(warnings.some((w) => w.includes("color.ramps.base"))).toBe(true);
  });

  it("warns-then-falls-back for an invalid RampRef", () => {
    const payload: DesignTokenJson = {
      $schema: DESIGN_TOKEN_SCHEMA,
      exportedAt: new Date().toISOString(),
      color: { map: { bg: { base: -3 } } as never },
    };
    const { state, warnings } = deserialize(payload, {
      manifest: MANIFEST,
      colorDefaults: COLOR_BASELINE,
    });
    expect(state.color.map.bg).toEqual(COLOR_BASELINE.map.bg);
    expect(warnings.some((w) => w.includes("color.map.bg"))).toBe(true);
  });
});

describe("v1 → v2 migration", () => {
  it("resets the color slice to baseline for a legacy v1 payload (palette array) without crashing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const v1Payload = {
      $schema: "zudo-doc-design-tokens/v1",
      exportedAt: new Date().toISOString(),
      color: {
        palette: Array.from({ length: 16 }, (_, i) =>
          `#${i.toString(16).padStart(2, "0").repeat(3)}`,
        ),
        base: { bg: 0, fg: 15, cursor: 6, "sel-bg": 0, "sel-fg": 15 },
        semantic: { accent: 5, surface: 0 },
      },
      // spacing/font/size are format-compatible across v1/v2 and are preserved.
      spacing: { "--spacing-hsp-md": "1.5rem" },
      font: { "--text-body": "1.4rem" },
    };

    const { state, warnings } = deserialize(v1Payload, {
      manifest: MANIFEST,
      colorDefaults: COLOR_BASELINE,
    });

    // Color reset to the default scheme; no crash, no partial garbage.
    expect(state.color).toEqual(COLOR_BASELINE);
    // Non-color slices survive the migration.
    expect(state.spacing).toEqual({ "hsp-md": "1.5rem" });
    expect(state.font).toEqual({ "text-body": "1.4rem" });
    // Reset is surfaced, not silent.
    expect(warnings.some((w) => w.toLowerCase().includes("legacy v1"))).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("detects the legacy shape structurally even without the v1 schema tag", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // A payload that claims the current schema but carries an old palette array
    // is still treated as legacy (defense-in-depth) and reset.
    const payload = {
      $schema: DESIGN_TOKEN_SCHEMA,
      exportedAt: new Date().toISOString(),
      color: { palette: ["#000", "#fff"] },
    };
    const { state, warnings } = deserialize(payload, {
      manifest: MANIFEST,
      colorDefaults: COLOR_BASELINE,
    });
    expect(state.color).toEqual(COLOR_BASELINE);
    expect(warnings.some((w) => w.toLowerCase().includes("legacy v1"))).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it("resets when the legacy numeric `base` block is present (no palette)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const payload = {
      $schema: "zudo-doc-design-tokens/v1",
      exportedAt: new Date().toISOString(),
      color: { base: { bg: 0, fg: 15 } },
    };
    const { state } = deserialize(payload, {
      manifest: MANIFEST,
      colorDefaults: COLOR_BASELINE,
    });
    expect(state.color).toEqual(COLOR_BASELINE);
    expect(warn).toHaveBeenCalled();
  });
});
