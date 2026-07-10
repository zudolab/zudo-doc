import { describe, it, expect } from "vitest";
import { defaultFrontmatterPreviewIgnoreKeys } from "../frontmatter-preview-defaults/index.js";
import { buildDocsSchema } from "../docs-schema/index.js";

// Formerly also parity-checked against the `create-zudo-doc` base
// template's `frontmatter-preview-defaults.ts` (#2654's port source). That
// template file was deleted by the minimal-scaffold cutover (epic #2651,
// Wave 6 #2660) — this module is now the sole source of truth, so a
// template-comparison test no longer has anything meaningful to compare
// against (found stale during the #2667 final-confirm gate — see the same
// note in i18n-defaults.test.ts for why no earlier wave caught this). The
// two schema cross-checks below (subset + superset against
// buildDocsSchema()) already constrain this list to exactly the schema's
// field set, which is a stronger guarantee than a static template snapshot.
describe("defaultFrontmatterPreviewIgnoreKeys", () => {
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
