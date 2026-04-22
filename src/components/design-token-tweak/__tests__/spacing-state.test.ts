import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  STORAGE_KEY_V1,
  STORAGE_KEY_V2,
  type ColorTweakState,
  type StorageLike,
  loadPersistedState,
} from "../state/tweak-state";

/**
 * Spacing/Font/Size sections:
 *   - v1 migration initialises them to empty maps (v1 only knew about color).
 *   - v2 payloads missing the sections hydrate to `{}` without warnings.
 *   - v2 payloads containing overrides pass them through unchanged.
 *   - Non-string values inside `spacing` are silently dropped (defensive
 *     hydration — we don't want a broken entry to crash the panel).
 */

function makeStorage(initial: Record<string, string> = {}): StorageLike & {
  entries: Record<string, string>;
} {
  const entries: Record<string, string> = { ...initial };
  return {
    entries,
    getItem: (k) => (k in entries ? entries[k] : null),
    setItem: (k, v) => { entries[k] = v; },
    removeItem: (k) => { delete entries[k]; },
  };
}

const palette16 = Array.from({ length: 16 }, (_, i) =>
  `#${i.toString(16).padStart(2, "0").repeat(3)}`,
);

const defaults: ColorTweakState = {
  palette: palette16,
  background: 0,
  foreground: 15,
  cursor: 6,
  selectionBg: 0,
  selectionFg: 15,
  semanticMappings: { accent: 6, muted: 8 },
  shikiTheme: "dracula",
};

function makeColor(): ColorTweakState {
  return {
    palette: palette16.map((c) => c),
    background: 1,
    foreground: 14,
    cursor: 5,
    selectionBg: 2,
    selectionFg: 13,
    semanticMappings: { accent: 6, muted: 8 },
    shikiTheme: "tokyo-night",
  };
}

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe("loadPersistedState — spacing/font/size sections", () => {
  it("fills spacing/font/size with empty maps when migrating from v1", () => {
    const v1 = makeColor();
    const storage = makeStorage({ [STORAGE_KEY_V1]: JSON.stringify(v1) });

    const result = loadPersistedState(storage, defaults);

    expect(result).not.toBeNull();
    expect(result!.spacing).toEqual({});
    expect(result!.font).toEqual({});
    expect(result!.size).toEqual({});

    // Persisted v2 carries the empty sections so future loads stay stable.
    const persisted = JSON.parse(storage.entries[STORAGE_KEY_V2]);
    expect(persisted.spacing).toEqual({});
    expect(persisted.font).toEqual({});
    expect(persisted.size).toEqual({});
  });

  it("hydrates v2 missing the new sections to empty maps (no warn)", () => {
    const v2 = { color: makeColor() }; // no spacing/font/size keys
    const storage = makeStorage({ [STORAGE_KEY_V2]: JSON.stringify(v2) });

    const result = loadPersistedState(storage, defaults);

    expect(result).not.toBeNull();
    expect(result!.spacing).toEqual({});
    expect(result!.font).toEqual({});
    expect(result!.size).toEqual({});
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("round-trips spacing overrides from v2", () => {
    const v2 = {
      color: makeColor(),
      spacing: { "hsp-sm": "0.75rem", "vsp-md": "2rem" },
      font: {},
      size: {},
    };
    const storage = makeStorage({ [STORAGE_KEY_V2]: JSON.stringify(v2) });

    const result = loadPersistedState(storage, defaults);

    expect(result!.spacing).toEqual({ "hsp-sm": "0.75rem", "vsp-md": "2rem" });
  });

  it("drops non-string entries inside spacing (defensive hydration)", () => {
    const v2 = {
      color: makeColor(),
      spacing: { "hsp-sm": "0.75rem", "hsp-md": 42, bogus: null },
    };
    const storage = makeStorage({ [STORAGE_KEY_V2]: JSON.stringify(v2) });

    const result = loadPersistedState(storage, defaults);

    expect(result!.spacing).toEqual({ "hsp-sm": "0.75rem" });
  });
});
