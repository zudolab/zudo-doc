import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertNoResetVariant,
  deriveNoResetCss,
} from "../../scripts/theme-css-variants.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, "../theme.css"), "utf8");

const activeResetLine = /^[ \t]*--color-\*:[ \t]*initial;[ \t]*$/gm;
const bareColorDeclaration =
  /^[ \t]*--color-(?!\*)[a-z][\w-]*[ \t]*:/gm;

describe("theme-no-reset.css derivation", () => {
  it("removes only the active reset and preserves the color aliases", () => {
    const variant = deriveNoResetCss(source);
    const sourceAliases = source.match(bareColorDeclaration) ?? [];
    const variantAliases = variant.match(bareColorDeclaration) ?? [];

    expect(variant).not.toMatch(activeResetLine);
    expect(variantAliases).toHaveLength(sourceAliases.length);
    for (const alias of sourceAliases) {
      expect(variant).toContain(alias);
    }

    const sourceLines = source.split(/\r?\n/);
    const variantLines = variant.split(/\r?\n/);
    expect(variantLines).toHaveLength(sourceLines.length);
    expect(
      sourceLines.filter((line, index) => line !== variantLines[index]),
    ).toHaveLength(1);
  });

  it("rejects a source with no active reset", () => {
    expect(() => deriveNoResetCss("@theme {\n  --color-bg: red;\n}\n")).toThrow(
      /exactly one active --color-\*: initial declaration/,
    );
  });

  it("rejects a source with duplicate active resets", () => {
    expect(() =>
      deriveNoResetCss(
        "@theme {\n  --color-*: initial;\n  --color-*: initial;\n}\n",
      ),
    ).toThrow(/found 2/);
  });
});

describe("theme-no-reset.css validation", () => {
  const fixtureTheme =
    "@theme {\n  --color-*: initial;\n  --color-bg: red;\n}\n";

  it("accepts the exact derived variant", () => {
    expect(() =>
      assertNoResetVariant(fixtureTheme, deriveNoResetCss(fixtureTheme)),
    ).not.toThrow();
  });

  it("rejects a variant that still carries an active reset", () => {
    expect(() => assertNoResetVariant(fixtureTheme, fixtureTheme)).toThrow(
      /contains 1 active --color-\*: initial declaration/,
    );
  });

  it("rejects a stale or mismatched variant", () => {
    const variant = deriveNoResetCss(fixtureTheme);
    expect(() => assertNoResetVariant(fixtureTheme, `${variant}\n`)).toThrow(
      /does not match/,
    );
  });
});
