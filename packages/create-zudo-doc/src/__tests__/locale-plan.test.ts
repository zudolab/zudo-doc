import { describe, expect, it } from "vitest";
import { resolveLocalePlan } from "../locale-plan.js";
import { runPrompts } from "../prompts.js";
import { FEATURES } from "../constants.js";

describe("resolveLocalePlan compatibility contract", () => {
  it.each([
    {
      name: "i18n off and list omitted resolves primary only",
      input: { defaultLang: "en", i18n: false },
      expected: { defaultLang: "en", additionalLangs: [], i18n: false },
    },
    {
      name: "English i18n infers Japanese for legacy callers",
      input: { defaultLang: "en", i18n: true },
      expected: { defaultLang: "en", additionalLangs: ["ja"], i18n: true },
    },
    {
      name: "non-English i18n infers English for legacy callers",
      input: { defaultLang: "fr", i18n: true },
      expected: { defaultLang: "fr", additionalLangs: ["en"], i18n: true },
    },
    {
      name: "explicit list is exact, normalized, ordered, and implies i18n",
      input: {
        defaultLang: " EN ",
        additionalLangs: [" JA ", "de-DE"],
        i18n: false,
      },
      expected: {
        defaultLang: "en",
        additionalLangs: ["ja", "de-de"],
        i18n: true,
      },
    },
  ])("$name", ({ input, expected }) => {
    expect(resolveLocalePlan(input)).toEqual({
      ...expected,
      overridesExplicitDisable: false,
    });
  });

  it("marks a warning when a list overrides explicit --no-i18n", () => {
    expect(
      resolveLocalePlan({
        defaultLang: "en",
        additionalLangs: ["ja"],
        i18n: false,
        i18nExplicitlyDisabled: true,
      }),
    ).toMatchObject({
      additionalLangs: ["ja"],
      i18n: true,
      overridesExplicitDisable: true,
    });
    expect(
      resolveLocalePlan({
        defaultLang: "en",
        additionalLangs: ["ja"],
        i18n: true,
        i18nExplicitlyDisabled: true,
      }).overridesExplicitDisable,
    ).toBe(true);
  });

  it.each([[[]], [[""]], [["  "]]] as [string[]][])(
    "rejects an explicit empty list %#",
    (additionalLangs) => {
      expect(() =>
        resolveLocalePlan({ defaultLang: "en", additionalLangs, i18n: true }),
      ).toThrow(/additionalLangs/);
    },
  );

  it("rejects duplicates and the primary after normalization", () => {
    expect(() =>
      resolveLocalePlan({
        defaultLang: "en",
        additionalLangs: ["JA", " ja "],
        i18n: true,
      }),
    ).toThrow(/Duplicate locale "ja" in additionalLangs/);
    expect(() =>
      resolveLocalePlan({
        defaultLang: " EN ",
        additionalLangs: ["en"],
        i18n: true,
      }),
    ).toThrow(/must not include defaultLang "en"/);
  });

  it.each([
    "../ja",
    ".",
    "ja/jp",
    "ja\\jp",
    "ja jp",
    "ja_jp",
    "ja;touch-x",
    "-ja",
    "ja-",
    "é",
  ])("rejects unsafe locale %j", (locale) => {
    expect(() =>
      resolveLocalePlan({
        defaultLang: "en",
        additionalLangs: [locale],
        i18n: true,
      }),
    ).toThrow(/additionalLangs\[0\]/);
  });

  it("accepts a safe custom programmatic primary locale", () => {
    expect(
      resolveLocalePlan({ defaultLang: "pt-BR", i18n: true }),
    ).toMatchObject({
      defaultLang: "pt-br",
      additionalLangs: ["en"],
    });
  });

  it("normalizes a fully prefilled prompt path to the same plan without I/O", async () => {
    const features = Object.fromEntries(
      FEATURES.map((feature) => [feature.value, false]),
    );
    const choices = await runPrompts({
      projectName: "locale-prefill",
      defaultLang: " EN ",
      additionalLangs: [" JA ", "de-DE"],
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      themePack: "default",
      features,
      githubUrl: "",
      packageManager: "pnpm",
    });
    expect({
      defaultLang: choices.defaultLang,
      additionalLangs: choices.additionalLangs,
      i18n: choices.features.includes("i18n"),
    }).toEqual({
      defaultLang: "en",
      additionalLangs: ["ja", "de-de"],
      i18n: true,
    });
  });
});
