import { describe, it, expect } from "vitest";
import { defaultTranslations } from "../i18n-defaults/index.js";

// Formerly parity-checked against the `create-zudo-doc` base template's
// `i18n.ts` (#2654's port source). That template file was deleted by the
// minimal-scaffold cutover (epic #2651, Wave 6 #2660) — the package module
// is now the SOLE source of truth for these translations, so a
// template-comparison test no longer has anything meaningful to compare
// against (found stale during the #2667 final-confirm gate: Wave 3 #2654
// wrote this parity guard before Wave 6 deleted its target file, and no
// wave ran this package's full test suite together with the generator
// changes to catch the drift). Replaced with self-contained assertions that
// don't depend on the now-gone template.
describe("defaultTranslations", () => {
  it("ships exactly the locale set: en, ja, de", () => {
    expect(Object.keys(defaultTranslations).sort()).toEqual(["de", "en", "ja"]);
  });

  // NOT asserting all locales carry the exact same key set: `de` is a
  // documented partial locale (44/56 keys, unchanged since before this
  // epic — missing only the `version.page.*`/`version.switcher.*` strings,
  // pre-existing and independent of the minimal-scaffold epic). This is a
  // supported, functioning pattern by design — the `t()` helper falls back
  // `translations[locale]?.[key] ?? translations[defaultLocale]?.[key] ??
  // key` (see this module's header comment), not a bug to guard against.

  it("spot-checks representative translated values", () => {
    expect(defaultTranslations.en?.["doc.allTags"]).toBe("All Tags");
    expect(defaultTranslations.en?.["nav.gettingStarted"]).toBe("Getting Started");
    expect(defaultTranslations.ja?.["nav.gettingStarted"]).toBe("はじめに");
    expect(defaultTranslations.de?.["nav.gettingStarted"]).toBe("Erste Schritte");
  });

  it("is a plain serializable Record<string, Record<string, string>> (route-context virtual-module rule)", () => {
    for (const table of Object.values(defaultTranslations)) {
      for (const value of Object.values(table)) {
        expect(typeof value).toBe("string");
      }
    }
    expect(() => JSON.parse(JSON.stringify(defaultTranslations))).not.toThrow();
  });
});
