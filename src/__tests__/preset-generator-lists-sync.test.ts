import { describe, it, expect } from "vitest";
import {
  SINGLE_SCHEMES,
  LIGHT_SCHEMES,
  SUPPORTED_LANGS,
  HEADER_RIGHT_LABELS,
} from "../../packages/create-zudo-doc/src/constants";
import {
  LIGHT_DARK_PAIRINGS,
} from "../../packages/create-zudo-doc/src/constants";
import { DEFAULT_HEADER_RIGHT_ITEMS } from "../lib/preset-generator-logic";
import { validateArgs } from "../../packages/create-zudo-doc/src/cli";

// ── SINGLE_SCHEMES / LIGHT_SCHEMES ──────────────────────────────────────────

describe("LIGHT_SCHEMES subset of SINGLE_SCHEMES", () => {
  it("every light scheme appears in SINGLE_SCHEMES", () => {
    for (const scheme of LIGHT_SCHEMES) {
      expect(
        SINGLE_SCHEMES,
        `LIGHT_SCHEMES entry "${scheme}" is missing from SINGLE_SCHEMES`,
      ).toContain(scheme);
    }
  });

  it("light schemes appear at the end of SINGLE_SCHEMES (dark-first ordering)", () => {
    const lightSet = new Set<string>(LIGHT_SCHEMES);
    const firstLightIndex = SINGLE_SCHEMES.findIndex((s) => lightSet.has(s));
    const lastDarkIndex = [...SINGLE_SCHEMES]
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !lightSet.has(s))
      .map(({ i }) => i)
      .at(-1) ?? -1;
    expect(
      firstLightIndex > lastDarkIndex,
      `Light schemes must come after all dark schemes in SINGLE_SCHEMES (first light at ${firstLightIndex}, last dark at ${lastDarkIndex})`,
    ).toBe(true);
  });
});

describe("LIGHT_DARK_PAIRINGS consistency with SINGLE_SCHEMES / LIGHT_SCHEMES", () => {
  it("every pairing's light scheme is in LIGHT_SCHEMES", () => {
    for (const pair of LIGHT_DARK_PAIRINGS) {
      expect(
        LIGHT_SCHEMES,
        `LIGHT_DARK_PAIRINGS entry "${pair.label}" light="${pair.light}" is missing from LIGHT_SCHEMES`,
      ).toContain(pair.light);
    }
  });

  it("every pairing's dark scheme is in SINGLE_SCHEMES", () => {
    for (const pair of LIGHT_DARK_PAIRINGS) {
      expect(
        SINGLE_SCHEMES,
        `LIGHT_DARK_PAIRINGS entry "${pair.label}" dark="${pair.dark}" is missing from SINGLE_SCHEMES`,
      ).toContain(pair.dark);
    }
  });
});

// ── SUPPORTED_LANGS ──────────────────────────────────────────────────────────

describe("SUPPORTED_LANGS accepted by CLI validateArgs", () => {
  it.each(SUPPORTED_LANGS.map((l) => [l.value, l.label]))(
    "--lang %s is accepted by validateArgs",
    (value) => {
      const error = validateArgs({ lang: value });
      expect(
        error,
        `validateArgs({lang: "${value}"}) should return null but got: "${error}"`,
      ).toBeNull();
    },
  );
});

// ── HEADER_RIGHT_LABELS ──────────────────────────────────────────────────────

describe("HEADER_RIGHT_LABELS covers DEFAULT_HEADER_RIGHT_ITEMS", () => {
  it("every default header-right item has a label in HEADER_RIGHT_LABELS", () => {
    for (const item of DEFAULT_HEADER_RIGHT_ITEMS) {
      expect(
        Object.prototype.hasOwnProperty.call(HEADER_RIGHT_LABELS, item.name),
        `DEFAULT_HEADER_RIGHT_ITEMS entry "${item.name}" (kind="${item.kind}") is missing from HEADER_RIGHT_LABELS`,
      ).toBe(true);
    }
  });

  it("HEADER_RIGHT_LABELS has no empty labels", () => {
    for (const [key, label] of Object.entries(HEADER_RIGHT_LABELS)) {
      expect(
        label.trim().length > 0,
        `HEADER_RIGHT_LABELS["${key}"] has an empty label`,
      ).toBe(true);
    }
  });
});
