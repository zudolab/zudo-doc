import { describe, it, expect } from "vitest";
import {
  CONFIGURED_DEFAULT_THEME_PACK_SLUG,
  DEFAULT_THEME_PACK_ALIAS,
  resolveConfiguredThemePack,
  resolveThemePackAlias,
} from "../configured-theme-pack.js";
import { CLASSIC_THEME_PACK_SLUG } from "../meta-schema.js";

describe("resolveThemePackAlias", () => {
  it("maps the \"default\" alias to graphite and passes other slugs through", () => {
    expect(DEFAULT_THEME_PACK_ALIAS).toBe("default");
    expect(resolveThemePackAlias("default")).toBe(CONFIGURED_DEFAULT_THEME_PACK_SLUG);
    expect(resolveThemePackAlias("classic")).toBe("classic");
    expect(resolveThemePackAlias("foundry")).toBe("foundry");
  });
});

describe("resolveConfiguredThemePack", () => {
  it("resolves an explicit \"default\" to graphite, even with authored palettes", () => {
    expect(resolveConfiguredThemePack({ themePack: "default" })).toBe("graphite");
    expect(
      resolveConfiguredThemePack({ themePack: "default", customColorSchemes: true, colorMode: false }),
    ).toBe("graphite");
  });

  it("returns the reserved Classic slug for an omitted pack with authored palettes", () => {
    expect(resolveConfiguredThemePack({ customColorSchemes: true })).toBe(CLASSIC_THEME_PACK_SLUG);
    expect(resolveConfiguredThemePack({ colorMode: false })).toBe(CLASSIC_THEME_PACK_SLUG);
    expect(resolveConfiguredThemePack({})).toBe("graphite");
  });
});
