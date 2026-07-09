import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDocsSchema } from "../docs-schema/index.js";
import type { PresetTagVocabularyEntry } from "../preset.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const templatePath = resolve(
  repoRoot,
  "packages/create-zudo-doc/templates/base/src/config/docs-schema.ts",
);

const vocabulary: PresetTagVocabularyEntry[] = [
  { id: "type:guide", aliases: ["guide", "guides"] },
  { id: "topic:ai" },
];

describe("buildDocsSchema", () => {
  it("requires title and allows a bare minimal frontmatter", () => {
    const schema = buildDocsSchema();
    expect(schema.safeParse({ title: "Hello" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("passes through custom/unknown frontmatter keys", () => {
    const schema = buildDocsSchema();
    const result = schema.safeParse({ title: "Hello", author: "someone", status: "wip" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ author: "someone", status: "wip" });
    }
  });

  it("accepts every documented optional field with a representative value", () => {
    const schema = buildDocsSchema();
    const fixture = {
      title: "Hello",
      description: "A description.",
      category: "guides",
      sidebar_position: 1,
      sidebar_label: "Hello",
      tags: ["anything"],
      search_exclude: true,
      pagination_next: "/docs/next",
      pagination_prev: null,
      draft: false,
      unlisted: false,
      hide_sidebar: false,
      hide_toc: false,
      wide: false,
      doc_history: true,
      standalone: false,
      slug: "custom-slug",
      generated: false,
      category_no_page: true,
      category_sort_order: "asc" as const,
    };
    expect(schema.safeParse(fixture).success).toBe(true);
  });

  it("rejects an invalid category_sort_order value", () => {
    const schema = buildDocsSchema();
    const result = schema.safeParse({ title: "Hello", category_sort_order: "random" });
    expect(result.success).toBe(false);
  });

  describe("tags governance", () => {
    it("accepts any string tags when opts is omitted (governance off)", () => {
      const schema = buildDocsSchema();
      expect(
        schema.safeParse({ title: "Hello", tags: ["not-in-any-vocabulary"] }).success,
      ).toBe(true);
    });

    it("accepts any string tags when tagGovernance is 'warn' (vocabulary consulted, not enforced)", () => {
      const schema = buildDocsSchema({ tagGovernance: "warn", tagVocabulary: vocabulary });
      expect(
        schema.safeParse({ title: "Hello", tags: ["not-in-any-vocabulary"] }).success,
      ).toBe(true);
    });

    it("restricts to canonical ids + aliases when tagGovernance is 'strict'", () => {
      const schema = buildDocsSchema({ tagGovernance: "strict", tagVocabulary: vocabulary });
      expect(schema.safeParse({ title: "Hello", tags: ["type:guide"] }).success).toBe(true);
      expect(schema.safeParse({ title: "Hello", tags: ["guide"] }).success).toBe(true);
      expect(schema.safeParse({ title: "Hello", tags: ["topic:ai"] }).success).toBe(true);
      expect(schema.safeParse({ title: "Hello", tags: ["unknown-tag"] }).success).toBe(false);
    });

    it("falls back to permissive when tagGovernance is 'strict' but tagVocabulary is empty/absent", () => {
      const strictNoVocab = buildDocsSchema({ tagGovernance: "strict" });
      expect(
        strictNoVocab.safeParse({ title: "Hello", tags: ["anything-goes"] }).success,
      ).toBe(true);

      const strictEmptyVocab = buildDocsSchema({ tagGovernance: "strict", tagVocabulary: [] });
      expect(
        strictEmptyVocab.safeParse({ title: "Hello", tags: ["anything-goes"] }).success,
      ).toBe(true);
    });
  });

  it("matches the template's field list exactly (moved data parity, #2654)", () => {
    const src = readFileSync(templatePath, "utf8");
    const blockStart = src.indexOf(".object({");
    const blockEnd = src.indexOf("\n    })", blockStart);
    const block = src.slice(blockStart, blockEnd);
    const templateFields = [...block.matchAll(/^\s{6}(\w+):/gm)].map((m) => m[1] as string);

    const schemaKeys = Object.keys(buildDocsSchema().shape);
    expect(schemaKeys.sort()).toEqual(templateFields.sort());
  });
});
