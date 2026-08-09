/**
 * Guards on the editor's configuration that a screenshot cannot prove and a
 * reviewer would have to take on trust.
 *
 * The colour-literal scan is the important one: a single hardcoded hex in the
 * theme or the highlight style is invisible in whichever mode it happens to
 * suit, and only shows up as unreadable text for users of the other one.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIM_ENABLED,
  editorHighlightSpec,
  editorThemeSpec,
  readVimEnabled,
  vimModeLabel,
  writeVimEnabled,
} from "../editor-extensions";
import { VIM_MODE_STORAGE_KEY } from "../persistence";
import { createFakeStorage, createHostileStorage } from "./support";

/** Anything that names a colour without going through a custom property. */
const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/i;

function declaredValues(spec: Record<string, unknown>): string[] {
  const values: string[] = [];
  for (const declarations of Object.values(spec)) {
    if (typeof declarations !== "object" || declarations === null) continue;
    for (const value of Object.values(declarations as Record<string, unknown>)) {
      if (typeof value === "string") values.push(value);
    }
  }
  return values;
}

describe("the CodeMirror theme", () => {
  it("names every colour through a --zdo-* token, never a literal", () => {
    const offenders = declaredValues(editorThemeSpec).filter((value) => {
      // color-mix() is the sanctioned wash form; its arguments are still
      // tokens, so only a literal OUTSIDE a var() reference is a violation.
      const withoutTokens = value.replace(/var\(--[^)]*\)/g, "");
      return COLOR_LITERAL.test(withoutTokens);
    });

    expect(offenders).toEqual([]);
  });

  it("uses only --zdo-* role tokens for colour, never a --palette-* ramp stop", () => {
    const paletteRefs = declaredValues(editorThemeSpec).filter((value) =>
      value.includes("var(--palette-"),
    );
    expect(paletteRefs).toEqual([]);
  });

  it("paints no background of its own over the pane's token background", () => {
    expect(editorThemeSpec["&"].backgroundColor).toBe("transparent");
    expect(editorThemeSpec[".cm-gutters"].backgroundColor).toBe("transparent");
  });

  it("colours every syntax tag through a token as well", () => {
    const colours = editorHighlightSpec.flatMap((style) =>
      [style["color"], style["backgroundColor"]].filter(
        (value): value is string => typeof value === "string",
      ),
    );

    expect(colours.length).toBeGreaterThan(0);
    expect(colours.filter((value) => !value.startsWith("var(--zdo-"))).toEqual([]);
  });
});

describe("vimModeLabel", () => {
  it("renders vim's own echo-line wording", () => {
    expect(vimModeLabel({ mode: "normal" })).toBe("-- NORMAL --");
    expect(vimModeLabel({ mode: "insert" })).toBe("-- INSERT --");
    expect(vimModeLabel({ mode: "replace" })).toBe("-- REPLACE --");
  });

  it("folds a visual sub-mode into the label", () => {
    expect(vimModeLabel({ mode: "visual" })).toBe("-- VISUAL --");
    expect(vimModeLabel({ mode: "visual", subMode: "linewise" })).toBe("-- VISUAL LINE --");
    expect(vimModeLabel({ mode: "visual", subMode: "blockwise" })).toBe(
      "-- VISUAL BLOCK --",
    );
  });

  it("falls back to normal, which is where vim always starts", () => {
    expect(vimModeLabel(null)).toBe("-- NORMAL --");
    expect(vimModeLabel(undefined)).toBe("-- NORMAL --");
  });
});

describe("the vim preference", () => {
  it("defaults to off for a reader who has never asked for it", () => {
    expect(DEFAULT_VIM_ENABLED).toBe(false);
    expect(readVimEnabled(createFakeStorage())).toBe(false);
  });

  it("round-trips through storage", () => {
    const storage = createFakeStorage();

    writeVimEnabled(true, storage);
    expect(storage.entries.get(VIM_MODE_STORAGE_KEY)).toBe("on");
    expect(readVimEnabled(storage)).toBe(true);

    writeVimEnabled(false, storage);
    expect(readVimEnabled(storage)).toBe(false);
  });

  it("falls back to the default rather than throwing on unusable storage", () => {
    expect(readVimEnabled(createFakeStorage({ [VIM_MODE_STORAGE_KEY]: "maybe" }))).toBe(
      false,
    );
    expect(readVimEnabled(createHostileStorage())).toBe(false);
    expect(readVimEnabled(null)).toBe(false);
  });
});
