import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultTranslations } from "../i18n-defaults/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const templatePath = resolve(
  repoRoot,
  "packages/create-zudo-doc/templates/base/src/config/i18n.ts",
);

/**
 * Parity check against the `create-zudo-doc` base template's `i18n.ts` — the
 * source-of-truth file this default was ported from (#2654). Parsed via
 * static text extraction (not a live import) because the template file's
 * `t()`/locale helpers depend on a sibling `./settings` module that only
 * exists in a scaffolded project, not in the raw template directory.
 */
function extractLocaleKeys(): Record<string, string[]> {
  const src = readFileSync(templatePath, "utf8");
  const blockStart = src.indexOf("export const translations");
  const blockEnd = src.indexOf("\n};\n", blockStart);
  const block = src.slice(blockStart, blockEnd);

  const localeStarts = [...block.matchAll(/^ {2}(\w+): \{$/gm)];
  const result: Record<string, string[]> = {};
  for (let i = 0; i < localeStarts.length; i++) {
    const match = localeStarts[i];
    const next = localeStarts[i + 1];
    if (!match) continue;
    const locale = match[1];
    if (!locale) continue;
    const start = match.index ?? 0;
    const end = next?.index ?? block.length;
    const localeBlock = block.slice(start, end);
    const keys = [...localeBlock.matchAll(/"([a-zA-Z0-9_.]+)":/g)].map((m) => m[1] as string);
    result[locale] = keys;
  }
  return result;
}

describe("defaultTranslations", () => {
  const templateLocales = extractLocaleKeys();

  it("ships the same locale set as the template (en, ja, de)", () => {
    expect(Object.keys(defaultTranslations).sort()).toEqual(
      Object.keys(templateLocales).sort(),
    );
  });

  it("every template locale's key set is superset-equal in the default", () => {
    for (const [locale, keys] of Object.entries(templateLocales)) {
      const defaultKeys = Object.keys(defaultTranslations[locale] ?? {});
      for (const key of keys) {
        expect(defaultKeys, `${locale}.${key} missing from defaultTranslations`).toContain(key);
      }
    }
  });

  it("carries no fewer keys per locale than the template (exact port)", () => {
    for (const [locale, keys] of Object.entries(templateLocales)) {
      const defaultKeys = Object.keys(defaultTranslations[locale] ?? {});
      expect(defaultKeys.sort()).toEqual([...keys].sort());
    }
  });

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
