import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DESIGN_TOKEN_SCHEMA,
  DesignTokenSchemaError,
  deserialize,
  serialize,
  type DesignTokenJson,
} from "../design-token-serde";
import type {
  ColorTweakState,
  TweakState,
} from "@/components/design-token-tweak/state/tweak-state";

/** Fully-populated 16-color palette whose entries look obviously synthetic so
 *  tests can spot a palette leak at a glance. */
const PALETTE_BASELINE = Array.from({ length: 16 }, (_, i) =>
  `#${i.toString(16).padStart(2, "0").repeat(3)}`,
);

const COLOR_BASELINE: ColorTweakState = {
  palette: PALETTE_BASELINE,
  background: 0,
  foreground: 15,
  cursor: 6,
  selectionBg: 0,
  selectionFg: 15,
  semanticMappings: {
    surface: 0,
    muted: 8,
    accent: 5,
    accentHover: 14,
    codeBg: 10,
    codeFg: 11,
  },
  shikiTheme: "dracula",
};

function cloneBaseline(): ColorTweakState {
  return {
    ...COLOR_BASELINE,
    palette: [...COLOR_BASELINE.palette],
    semanticMappings: { ...COLOR_BASELINE.semanticMappings },
  };
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
    const json = serialize(state, { colorDefaults: COLOR_BASELINE });
    expect(json.$schema).toBe(DESIGN_TOKEN_SCHEMA);
    expect(typeof json.exportedAt).toBe("string");
    expect(() => new Date(json.exportedAt).toISOString()).not.toThrow();
  });

  it("emits nothing in color/spacing/font/size when state matches baseline", () => {
    const json = serialize(makeState(), { colorDefaults: COLOR_BASELINE });
    expect(json.color).toBeUndefined();
    expect(json.spacing).toBeUndefined();
    expect(json.font).toBeUndefined();
    expect(json.size).toBeUndefined();
  });

  it("emits only changed spacing tokens by default (diff-only)", () => {
    const state = makeState({ spacing: { "hsp-md": "1.125rem" } });
    const json = serialize(state, { colorDefaults: COLOR_BASELINE });
    expect(json.spacing).toEqual({ "--spacing-hsp-md": "1.125rem" });
  });

  it("drops spacing overrides that match the manifest default", () => {
    // 0.75rem is the declared default for --spacing-hsp-md, so it should NOT
    // appear in diff-only output.
    const state = makeState({ spacing: { "hsp-md": "0.75rem" } });
    const json = serialize(state, { colorDefaults: COLOR_BASELINE });
    expect(json.spacing).toBeUndefined();
  });

  it("emits full token blocks when includeDefaults=true", () => {
    const json = serialize(makeState(), {
      colorDefaults: COLOR_BASELINE,
      includeDefaults: true,
    });
    expect(json.color).toBeDefined();
    expect(json.color?.palette).toHaveLength(16);
    expect(json.spacing?.["--spacing-hsp-md"]).toBe("0.75rem");
    expect(json.font?.["--text-body"]).toBe("1.2rem");
    expect(json.size?.["--radius-DEFAULT"]).toBe("4px");
  });

  it("emits the palette when any hex differs", () => {
    const color = cloneBaseline();
    color.palette[5] = "#ff00ff";
    const json = serialize(makeState({ color }), {
      colorDefaults: COLOR_BASELINE,
    });
    expect(json.color?.palette).toHaveLength(16);
    expect(json.color?.palette?.[5]).toBe("#ff00ff");
  });

  it("emits only differing base-color fields", () => {
    const color = cloneBaseline();
    color.cursor = 9;
    const json = serialize(makeState({ color }), {
      colorDefaults: COLOR_BASELINE,
    });
    expect(json.color?.base).toEqual({ cursor: 9 });
    expect(json.color?.palette).toBeUndefined();
  });

  it("emits only differing semantic mappings", () => {
    const color = cloneBaseline();
    color.semanticMappings.accent = 7;
    const json = serialize(makeState({ color }), {
      colorDefaults: COLOR_BASELINE,
    });
    expect(json.color?.semantic).toEqual({ accent: 7 });
  });

  it("emits shikiTheme only when it differs", () => {
    const color = cloneBaseline();
    color.shikiTheme = "vitesse-dark";
    const json = serialize(makeState({ color }), {
      colorDefaults: COLOR_BASELINE,
    });
    expect(json.color?.shikiTheme).toBe("vitesse-dark");
  });
});

describe("deserialize", () => {
  it("round-trips a diff-only export cleanly", () => {
    const original = makeState({
      spacing: { "hsp-md": "1.125rem", "vsp-sm": "1rem" },
      font: { "text-body": "1.3rem" },
      size: { "radius-DEFAULT": "8px" },
    });
    original.color.cursor = 9;

    const json = serialize(original, { colorDefaults: COLOR_BASELINE });
    const text = JSON.stringify(json);
    const parsed = JSON.parse(text);
    const { state, unknownTokens } = deserialize(parsed, {
      colorDefaults: COLOR_BASELINE,
    });

    expect(unknownTokens).toEqual([]);
    expect(state.spacing).toEqual(original.spacing);
    expect(state.font).toEqual(original.font);
    expect(state.size).toEqual(original.size);
    expect(state.color.cursor).toBe(9);
    expect(state.color.palette).toEqual(COLOR_BASELINE.palette);
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
      colorDefaults: COLOR_BASELINE,
    });
    expect(state.spacing).toEqual({ "hsp-md": "1.25rem" });
    expect(state.size).toEqual({});
    expect(unknownTokens.sort()).toEqual(
      ["--radius-imaginary", "--spacing-nope"].sort(),
    );
  });

  it("throws schema-mismatch when $schema is wrong", () => {
    expect(() =>
      deserialize(
        { $schema: "zudo-doc-design-tokens/v2", exportedAt: "x" },
        { colorDefaults: COLOR_BASELINE },
      ),
    ).toThrowError(DesignTokenSchemaError);
  });

  it("throws schema-missing when $schema is absent", () => {
    try {
      deserialize({ exportedAt: "x" }, { colorDefaults: COLOR_BASELINE });
      throw new Error("expected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(DesignTokenSchemaError);
      expect((err as DesignTokenSchemaError).reason).toBe("schema-missing");
    }
  });

  it("throws not-object for non-object input", () => {
    expect(() => deserialize("hello")).toThrowError(DesignTokenSchemaError);
    expect(() => deserialize(null)).toThrowError(DesignTokenSchemaError);
    expect(() => deserialize(42)).toThrowError(DesignTokenSchemaError);
  });

  it("falls back to baseline for absent color fields", () => {
    const payload: DesignTokenJson = {
      $schema: DESIGN_TOKEN_SCHEMA,
      exportedAt: new Date().toISOString(),
      color: { base: { cursor: 3 } },
    };
    const { state } = deserialize(payload, { colorDefaults: COLOR_BASELINE });
    expect(state.color.cursor).toBe(3);
    expect(state.color.background).toBe(COLOR_BASELINE.background);
    expect(state.color.palette).toEqual(COLOR_BASELINE.palette);
    expect(state.color.shikiTheme).toBe(COLOR_BASELINE.shikiTheme);
  });

  it("warns-then-ignores palette arrays that aren't exactly 16 long", () => {
    const payload: DesignTokenJson = {
      $schema: DESIGN_TOKEN_SCHEMA,
      exportedAt: new Date().toISOString(),
      color: { palette: ["#111", "#222"] },
    };
    const { state, warnings } = deserialize(payload, {
      colorDefaults: COLOR_BASELINE,
    });
    expect(state.color.palette).toEqual(COLOR_BASELINE.palette);
    expect(warnings.some((w) => w.includes("palette"))).toBe(true);
  });
});
