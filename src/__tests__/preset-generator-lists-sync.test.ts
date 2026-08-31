import { describe, it, expect } from "vitest";
import {
  SINGLE_SCHEMES,
  LIGHT_SCHEMES,
  SUPPORTED_LANGS,
  HEADER_RIGHT_LABELS,
  THEME_PACKS,
} from "../../packages/create-zudo-doc/src/constants";
import {
  LIGHT_DARK_PAIRINGS,
} from "../../packages/create-zudo-doc/src/constants";
import {
  DEFAULT_HEADER_RIGHT_ITEMS,
  SINGLE_SCHEMES as HOST_SINGLE_SCHEMES,
  LIGHT_SCHEMES as HOST_LIGHT_SCHEMES,
  SUPPORTED_LANGS as HOST_SUPPORTED_LANGS,
  HEADER_RIGHT_LABELS as HOST_HEADER_RIGHT_LABELS,
  THEME_PACKS as HOST_THEME_PACKS,
  resolvePresetLocalePlan,
  validateAdditionalLangs,
} from "../lib/preset-generator-logic";
import { validateArgs } from "../../packages/create-zudo-doc/src/cli";
import { resolveLocalePlan } from "../../packages/create-zudo-doc/src/locale-plan";

// ── Host mirror ↔ canonical constants.ts parity ─────────────────────────────
// preset-generator-logic.ts mirrors these five lists (it is bundled into a
// client island and cannot reach the generator package's source at build time).
// This block fails if either side drifts — the single-source-of-truth guard.

describe("host preset-generator lists mirror constants.ts exactly", () => {
  it("SINGLE_SCHEMES matches", () => {
    expect(HOST_SINGLE_SCHEMES).toEqual(SINGLE_SCHEMES);
  });
  it("LIGHT_SCHEMES matches", () => {
    expect(HOST_LIGHT_SCHEMES).toEqual(LIGHT_SCHEMES);
  });
  it("SUPPORTED_LANGS matches", () => {
    expect(HOST_SUPPORTED_LANGS).toEqual(SUPPORTED_LANGS);
  });
  it("HEADER_RIGHT_LABELS matches", () => {
    expect(HOST_HEADER_RIGHT_LABELS).toEqual(HEADER_RIGHT_LABELS);
  });
  it("THEME_PACKS matches", () => {
    expect(HOST_THEME_PACKS).toEqual(THEME_PACKS);
  });
});

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

// ── Locale parser / validation parity ───────────────────────────────────────

describe("host locale input mirrors the canonical locale contract", () => {
  const cases = [
    { defaultLang: " EN ", input: " JA ,de-DE " },
    { defaultLang: "en", input: "" },
    { defaultLang: "en", input: "   " },
    { defaultLang: "en", input: "JA, ja" },
    { defaultLang: "en", input: "en" },
    { defaultLang: "en", input: "../ja" },
    { defaultLang: "en", input: "." },
    { defaultLang: "en", input: "ja/jp" },
    { defaultLang: "en", input: "ja\\jp" },
    { defaultLang: "en", input: "ja jp" },
    { defaultLang: "en", input: "ja_jp" },
    { defaultLang: "en", input: "ja;touch-x" },
    { defaultLang: "en", input: "-ja" },
    { defaultLang: "en", input: "ja-" },
    { defaultLang: "en", input: "é" },
    { defaultLang: "en", input: "ja," },
    { defaultLang: "en", input: "ja,,de" },
  ] as const;

  function canonicalResult(defaultLang: string, input: string) {
    try {
      const plan = resolveLocalePlan({
        defaultLang,
        additionalLangs: input.trim() ? input.split(",") : undefined,
        i18n: false,
      });
      return {
        error: null,
        plan: {
          defaultLang: plan.defaultLang,
          additionalLangs: plan.additionalLangs.length
            ? plan.additionalLangs
            : undefined,
          i18n: plan.i18n,
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        plan: undefined,
      };
    }
  }

  it.each(cases)("matches canonical normalization or rejection for %j", ({
    defaultLang,
    input,
  }) => {
    const expected = canonicalResult(defaultLang, input);
    expect(validateAdditionalLangs(input, defaultLang)).toBe(expected.error);

    if (expected.error) {
      expect(() => resolvePresetLocalePlan(defaultLang, input)).toThrow(
        expected.error,
      );
      return;
    }

    expect(resolvePresetLocalePlan(defaultLang, input)).toEqual(expected.plan);
  });
});

// ── THEME_PACKS ──────────────────────────────────────────────────────────────

describe("THEME_PACKS accepted by CLI validateArgs", () => {
  it.each(THEME_PACKS.map((t) => [t.slug, t.label]))(
    "--theme-pack %s is accepted by validateArgs",
    (slug) => {
      const error = validateArgs({ themePack: slug });
      expect(
        error,
        `validateArgs({themePack: "${slug}"}) should return null but got: "${error}"`,
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
