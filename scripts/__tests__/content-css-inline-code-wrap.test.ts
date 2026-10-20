import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Lives outside packages/zudo-doc: any file edit inside the linked package
// shifts the native data-zfb-build identity pinned by the A2 parity references.
const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(__dirname, "../../packages/zudo-doc/src/content.css"), "utf8");

function ruleBody(selectorFragment: string): string | undefined {
  const uncommented = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of uncommented.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1]?.includes(selectorFragment)) return match[2];
  }
  return undefined;
}

describe("packages/zudo-doc/src/content.css inline-code wrapping contract (#4596)", () => {
  it("keeps an explicit overflow-wrap: anywhere on inline code", () => {
    expect(ruleBody("code:not(pre code)")).toMatch(/overflow-wrap:\s*anywhere;/);
  });

  it("keeps the break-word override for inline code in table cells", () => {
    expect(ruleBody("th code, td code")).toMatch(/overflow-wrap:\s*break-word;/);
  });
});
