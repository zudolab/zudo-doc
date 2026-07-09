import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultDirectiveVocabulary } from "../directive-vocabulary-defaults/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

/** Extract the `key: "Value",` pairs from a `const directiveVocabulary = { ... };`
 *  block, wherever it appears in the given source text. */
function extractDirectiveVocabulary(src: string): Record<string, string> {
  const blockStart = src.indexOf("directiveVocabulary = {");
  const blockEnd = src.indexOf("};", blockStart);
  const block = src.slice(blockStart, blockEnd);
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(\w+):\s*"([^"]+)",/g)) {
    const key = m[1];
    const value = m[2];
    if (key && value) out[key] = value;
  }
  return out;
}

describe("defaultDirectiveVocabulary", () => {
  it("is the canonical seven directives", () => {
    expect(defaultDirectiveVocabulary).toEqual({
      note: "Note",
      tip: "Tip",
      info: "Info",
      warning: "Warning",
      danger: "Danger",
      caution: "Caution",
      details: "Details",
    });
  });

  it("matches the showcase's hardcoded zfb.config.ts directiveVocabulary", () => {
    const src = readFileSync(resolve(repoRoot, "zfb.config.ts"), "utf8");
    expect(defaultDirectiveVocabulary).toEqual(extractDirectiveVocabulary(src));
  });

  it("matches the generator's hardcoded zfb-config-gen.ts directiveVocabulary", () => {
    const src = readFileSync(
      resolve(repoRoot, "packages/create-zudo-doc/src/zfb-config-gen.ts"),
      "utf8",
    );
    expect(defaultDirectiveVocabulary).toEqual(extractDirectiveVocabulary(src));
  });

  it("is a plain serializable Record<string, string>", () => {
    expect(() => JSON.parse(JSON.stringify(defaultDirectiveVocabulary))).not.toThrow();
  });
});
