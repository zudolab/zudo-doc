import { describe, expect, it } from "vitest";
import {
  DEFAULT_OUTLINE_VIEW,
  isOutlineViewMode,
  OUTLINE_VIEW_STORAGE_KEY,
  readOutlineView,
  writeOutlineView,
  type ViewPreferenceStorage,
} from "../view-preference.js";

function storageWith(value: string | null): ViewPreferenceStorage {
  return {
    getItem: () => value,
    setItem: () => undefined,
  };
}

describe("readOutlineView", () => {
  it("returns the persisted mode", () => {
    expect(readOutlineView(storageWith("board"))).toBe("board");
    expect(readOutlineView(storageWith("outline"))).toBe("outline");
  });

  it("falls back to the default for a missing or unrecognized value", () => {
    expect(readOutlineView(storageWith(null))).toBe(DEFAULT_OUTLINE_VIEW);
    expect(readOutlineView(storageWith("kanban"))).toBe(DEFAULT_OUTLINE_VIEW);
  });

  it("falls back to the default when storage access throws", () => {
    // Private browsing and disabled-storage modes throw on access rather
    // than returning null; losing the preference must not take the surface
    // down with it.
    const hostile: ViewPreferenceStorage = {
      getItem: () => {
        throw new Error("storage disabled");
      },
      setItem: () => undefined,
    };
    expect(readOutlineView(hostile)).toBe(DEFAULT_OUTLINE_VIEW);
  });
});

describe("writeOutlineView", () => {
  it("persists under this app's own key", () => {
    const written: Record<string, string> = {};
    writeOutlineView("board", {
      getItem: () => null,
      setItem: (key, value) => {
        written[key] = value;
      },
    });
    expect(written).toEqual({ [OUTLINE_VIEW_STORAGE_KEY]: "board" });
    expect(OUTLINE_VIEW_STORAGE_KEY).toBe("zudo-doc-online-outline-view");
  });
});

describe("isOutlineViewMode", () => {
  it("accepts only the two known modes", () => {
    expect(isOutlineViewMode("outline")).toBe(true);
    expect(isOutlineViewMode("board")).toBe(true);
    expect(isOutlineViewMode("tree")).toBe(false);
    expect(isOutlineViewMode(null)).toBe(false);
  });
});
