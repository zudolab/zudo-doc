import { describe, expect, it } from "vitest";
import {
  DEFAULT_RAIL_MODE,
  DEFAULT_SPLIT_PERCENT,
  MAX_SPLIT_PERCENT,
  MIN_SPLIT_PERCENT,
  clampSplitPercent,
  readRailMode,
  readSplitPercent,
  splitPercentForKey,
  splitPercentFromPointer,
  toggleRailMode,
  writeRailMode,
  writeSplitPercent,
} from "../rail-state";
import { createFakeStorage, createHostileStorage } from "./support";

describe("rail mode", () => {
  it("toggles between the two persisted states", () => {
    expect(toggleRailMode("expanded")).toBe("collapsed");
    expect(toggleRailMode("collapsed")).toBe("expanded");
  });

  it("survives a reload", () => {
    const storage = createFakeStorage();
    writeRailMode("collapsed", storage);
    expect(readRailMode(storage)).toBe("collapsed");
  });

  it("falls back to the default for missing, unknown, or throwing storage", () => {
    expect(readRailMode(createFakeStorage())).toBe(DEFAULT_RAIL_MODE);
    expect(readRailMode(createFakeStorage({ "zdo-editor-rail": "sideways" }))).toBe(
      DEFAULT_RAIL_MODE,
    );
    expect(readRailMode(createHostileStorage())).toBe(DEFAULT_RAIL_MODE);
  });
});

describe("clampSplitPercent", () => {
  it("keeps the split inside the usable range", () => {
    expect(clampSplitPercent(0)).toBe(MIN_SPLIT_PERCENT);
    expect(clampSplitPercent(100)).toBe(MAX_SPLIT_PERCENT);
    expect(clampSplitPercent(63.42)).toBe(63.4);
  });

  it("falls back to the default for a non-finite value", () => {
    expect(clampSplitPercent(Number.NaN)).toBe(DEFAULT_SPLIT_PERCENT);
  });
});

describe("split persistence", () => {
  it("round-trips a dragged ratio", () => {
    const storage = createFakeStorage();
    writeSplitPercent(37.5, storage);
    expect(readSplitPercent(storage)).toBe(37.5);
  });

  it("clamps a persisted value that is out of range", () => {
    expect(readSplitPercent(createFakeStorage({ "zdo-editor-split": "5" }))).toBe(
      MIN_SPLIT_PERCENT,
    );
  });

  it("falls back to the default for junk or throwing storage", () => {
    expect(readSplitPercent(createFakeStorage({ "zdo-editor-split": "wide" }))).toBe(
      DEFAULT_SPLIT_PERCENT,
    );
    expect(readSplitPercent(createHostileStorage())).toBe(DEFAULT_SPLIT_PERCENT);
  });
});

describe("splitPercentFromPointer", () => {
  it("maps a pointer position to a percentage of the track", () => {
    expect(splitPercentFromPointer(400, { left: 0, width: 1000 })).toBe(40);
    expect(splitPercentFromPointer(500, { left: 200, width: 1000 })).toBe(30);
  });

  it("clamps a pointer dragged past either end", () => {
    expect(splitPercentFromPointer(-500, { left: 0, width: 1000 })).toBe(MIN_SPLIT_PERCENT);
    expect(splitPercentFromPointer(5000, { left: 0, width: 1000 })).toBe(MAX_SPLIT_PERCENT);
  });

  it("returns the default for a zero-width track (never measured)", () => {
    expect(splitPercentFromPointer(100, { left: 0, width: 0 })).toBe(DEFAULT_SPLIT_PERCENT);
  });
});

describe("splitPercentForKey", () => {
  it("nudges, pages, and jumps to the ends", () => {
    expect(splitPercentForKey(50, "ArrowLeft")).toBe(48);
    expect(splitPercentForKey(50, "ArrowRight")).toBe(52);
    expect(splitPercentForKey(50, "PageUp")).toBe(60);
    expect(splitPercentForKey(50, "PageDown")).toBe(40);
    expect(splitPercentForKey(50, "Home")).toBe(MIN_SPLIT_PERCENT);
    expect(splitPercentForKey(50, "End")).toBe(MAX_SPLIT_PERCENT);
  });

  it("clamps at the ends instead of running past them", () => {
    expect(splitPercentForKey(MIN_SPLIT_PERCENT, "ArrowLeft")).toBe(MIN_SPLIT_PERCENT);
    expect(splitPercentForKey(MAX_SPLIT_PERCENT, "ArrowRight")).toBe(MAX_SPLIT_PERCENT);
  });

  it("returns null for a key the handle does not own", () => {
    expect(splitPercentForKey(50, "Enter")).toBeNull();
  });
});
