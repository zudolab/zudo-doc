import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultFrontmatterPreviewIgnoreKeys } from "../frontmatter-preview-defaults/index.js";
import { buildDocsSchema } from "../docs-schema/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const templatePath = resolve(
  repoRoot,
  "packages/create-zudo-doc/templates/base/src/config/frontmatter-preview-defaults.ts",
);

function extractTemplateKeys(): string[] {
  const src = readFileSync(templatePath, "utf8");
  const blockStart = src.indexOf("DEFAULT_FRONTMATTER_IGNORE_KEYS");
  const block = src.slice(blockStart);
  return [...block.matchAll(/"([a-zA-Z0-9_]+)",/g)].map((m) => m[1] as string);
}

describe("defaultFrontmatterPreviewIgnoreKeys", () => {
  it("matches the template's DEFAULT_FRONTMATTER_IGNORE_KEYS exactly, in order", () => {
    expect([...defaultFrontmatterPreviewIgnoreKeys]).toEqual(extractTemplateKeys());
  });

  it("has no duplicate keys", () => {
    expect(new Set(defaultFrontmatterPreviewIgnoreKeys).size).toBe(
      defaultFrontmatterPreviewIgnoreKeys.length,
    );
  });

  // Cross-module check: every ignore key corresponds to a field the default
  // docs schema actually declares (the doc comment's claim, made mechanical).
  it("every entry corresponds to a field declared in the default docs schema", () => {
    const schemaKeys = Object.keys(buildDocsSchema().shape);
    for (const key of defaultFrontmatterPreviewIgnoreKeys) {
      expect(schemaKeys, `"${key}" is not a field of buildDocsSchema()`).toContain(key);
    }
  });

  it("covers every field declared in the default docs schema (no missing entries)", () => {
    const schemaKeys = Object.keys(buildDocsSchema().shape);
    expect([...defaultFrontmatterPreviewIgnoreKeys].sort()).toEqual([...schemaKeys].sort());
  });
});
