import { describe, expect, it } from "vitest";
import { LEGACY_FALLBACK_SLUG } from "../../../app/project.js";
import {
  DEFAULT_OUTLINE_VIEW,
  isOutlineViewMode,
  OUTLINE_VIEW_STORAGE_KEY,
  readOutlineView,
  writeOutlineView,
  type ViewPreferenceStorage,
} from "../view-preference.js";

const PROJECT_SLUG = "aurora-docs2";

function storageWith(
  values: Record<string, string>,
): ViewPreferenceStorage & { values: Record<string, string> } {
  return {
    values,
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => {
      values[key] = value;
    },
  };
}

describe("readOutlineView", () => {
  it("returns the persisted mode from the project-scoped key", () => {
    expect(
      readOutlineView(
        PROJECT_SLUG,
        storageWith({ [`${OUTLINE_VIEW_STORAGE_KEY}:${PROJECT_SLUG}`]: "board" }),
      ),
    ).toBe("board");
    expect(
      readOutlineView(
        PROJECT_SLUG,
        storageWith({ [`${OUTLINE_VIEW_STORAGE_KEY}:${PROJECT_SLUG}`]: "outline" }),
      ),
    ).toBe("outline");
  });

  it("falls back to the default for a missing or unrecognized value", () => {
    expect(readOutlineView(PROJECT_SLUG, storageWith({}))).toBe(DEFAULT_OUTLINE_VIEW);
    expect(
      readOutlineView(
        PROJECT_SLUG,
        storageWith({ [`${OUTLINE_VIEW_STORAGE_KEY}:${PROJECT_SLUG}`]: "kanban" }),
      ),
    ).toBe(DEFAULT_OUTLINE_VIEW);
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
    expect(readOutlineView(PROJECT_SLUG, hostile)).toBe(DEFAULT_OUTLINE_VIEW);
  });

  describe("legacy, un-scoped value", () => {
    it("is read once, but ONLY for the legacy fallback slug", () => {
      const storage = storageWith({ [OUTLINE_VIEW_STORAGE_KEY]: "board" });
      expect(readOutlineView(LEGACY_FALLBACK_SLUG, storage)).toBe("board");
    });

    it("never leaks into any other project's preference", () => {
      const storage = storageWith({ [OUTLINE_VIEW_STORAGE_KEY]: "board" });
      expect(readOutlineView(PROJECT_SLUG, storage)).toBe(DEFAULT_OUTLINE_VIEW);
    });

    it("a scoped value always wins over the legacy one, even for the fallback slug", () => {
      const storage = storageWith({
        [OUTLINE_VIEW_STORAGE_KEY]: "board",
        [`${OUTLINE_VIEW_STORAGE_KEY}:${LEGACY_FALLBACK_SLUG}`]: "outline",
      });
      expect(readOutlineView(LEGACY_FALLBACK_SLUG, storage)).toBe("outline");
    });
  });
});

describe("writeOutlineView", () => {
  it("persists under this app's own key, scoped to the project", () => {
    const written: Record<string, string> = {};
    writeOutlineView("board", PROJECT_SLUG, {
      getItem: () => null,
      setItem: (key, value) => {
        written[key] = value;
      },
    });
    expect(written).toEqual({ [`${OUTLINE_VIEW_STORAGE_KEY}:${PROJECT_SLUG}`]: "board" });
    expect(OUTLINE_VIEW_STORAGE_KEY).toBe("zudo-doc-online-outline-view");
  });

  it("never writes to the legacy unscoped key, even for the fallback slug", () => {
    const written: Record<string, string> = {};
    writeOutlineView("board", LEGACY_FALLBACK_SLUG, {
      getItem: () => null,
      setItem: (key, value) => {
        written[key] = value;
      },
    });
    expect(written[OUTLINE_VIEW_STORAGE_KEY]).toBeUndefined();
    expect(written[`${OUTLINE_VIEW_STORAGE_KEY}:${LEGACY_FALLBACK_SLUG}`]).toBe("board");
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
