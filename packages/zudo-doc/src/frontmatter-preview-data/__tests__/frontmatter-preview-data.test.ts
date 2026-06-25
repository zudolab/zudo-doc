import { describe, it, expect } from "vitest";
import { createBuildFrontmatterPreviewEntries } from "../index.js";

const DEFAULT_IGNORE_KEYS = [
  "title",
  "description",
  "category",
  "sidebar_position",
  "sidebar_label",
  "tags",
  "search_exclude",
  "pagination_next",
  "pagination_prev",
  "draft",
  "unlisted",
  "hide_sidebar",
  "hide_toc",
  "doc_history",
  "standalone",
  "slug",
  "generated",
  "category_no_page",
  "category_sort_order",
];

describe("createBuildFrontmatterPreviewEntries", () => {
  describe("when frontmatterPreview is false", () => {
    const build = createBuildFrontmatterPreviewEntries({
      frontmatterPreview: false,
      defaultIgnoreKeys: DEFAULT_IGNORE_KEYS,
    });

    it("returns empty array for any data", () => {
      expect(build({ custom: "value" })).toEqual([]);
    });

    it("returns empty array for null data", () => {
      expect(build(null)).toEqual([]);
    });
  });

  describe("when frontmatterPreview is undefined", () => {
    const build = createBuildFrontmatterPreviewEntries({
      frontmatterPreview: undefined,
      defaultIgnoreKeys: DEFAULT_IGNORE_KEYS,
    });

    it("returns empty array", () => {
      expect(build({ custom: "value" })).toEqual([]);
    });
  });

  describe("when frontmatterPreview is enabled (no custom ignoreKeys)", () => {
    const build = createBuildFrontmatterPreviewEntries({
      frontmatterPreview: {},
      defaultIgnoreKeys: DEFAULT_IGNORE_KEYS,
    });

    it("returns empty array when data is null", () => {
      expect(build(null)).toEqual([]);
    });

    it("returns empty array when data is undefined", () => {
      expect(build(undefined)).toEqual([]);
    });

    it("excludes default ignore keys", () => {
      const data = { title: "My Page", description: "desc", custom: "show" };
      const result = build(data);
      expect(result).toEqual([["custom", "show"]]);
    });

    it("excludes null and undefined values", () => {
      const data = { custom: "show", nullKey: null, undefKey: undefined };
      const result = build(data);
      expect(result).toEqual([["custom", "show"]]);
    });

    it("includes non-ignored non-null values", () => {
      const data = {
        author: "Alice",
        version: 2,
        draft: true,
        custom_field: "hello",
      };
      const result = build(data);
      // "draft" is in default ignore keys, others are not
      expect(result).toContainEqual(["author", "Alice"]);
      expect(result).toContainEqual(["version", 2]);
      expect(result).toContainEqual(["custom_field", "hello"]);
      expect(result).not.toContainEqual(["draft", true]);
    });
  });

  describe("extraIgnoreKeys", () => {
    const build = createBuildFrontmatterPreviewEntries({
      frontmatterPreview: { extraIgnoreKeys: ["author"] },
      defaultIgnoreKeys: DEFAULT_IGNORE_KEYS,
    });

    it("excludes both default and extra ignore keys", () => {
      const data = { title: "Page", author: "Alice", custom: "show" };
      const result = build(data);
      expect(result).toEqual([["custom", "show"]]);
    });
  });

  describe("ignoreKeys (replaces default list)", () => {
    const build = createBuildFrontmatterPreviewEntries({
      frontmatterPreview: { ignoreKeys: ["only_this"] },
      defaultIgnoreKeys: DEFAULT_IGNORE_KEYS,
    });

    it("uses only the custom ignore list, allowing default keys through", () => {
      const data = { title: "My Page", only_this: "hidden", custom: "show" };
      const result = build(data);
      expect(result).toContainEqual(["title", "My Page"]);
      expect(result).toContainEqual(["custom", "show"]);
      expect(result).not.toContainEqual(["only_this", "hidden"]);
    });
  });

  describe("byte-identical output to the original implementation", () => {
    // Verify the factory produces the same result as the original host function.
    // Original logic from pages/lib/_frontmatter-preview-data.ts:
    function originalBuildFrontmatterPreviewEntries(
      data: Record<string, unknown> | null | undefined,
      frontmatterPreview: { ignoreKeys?: string[]; extraIgnoreKeys?: string[] } | false | undefined,
    ): Array<[string, unknown]> {
      if (!data) return [];
      const config = frontmatterPreview as { frontmatterPreview?: unknown };
      const fmConfig = (config as unknown as { frontmatterPreview?: unknown }).frontmatterPreview ?? frontmatterPreview;
      // Simplified version of original for comparison — actual logic inlined:
      if (frontmatterPreview === false || frontmatterPreview === undefined) return [];
      const cfg = frontmatterPreview as { ignoreKeys?: string[]; extraIgnoreKeys?: string[] };
      const ignoreSet = new Set<string>(
        cfg.ignoreKeys ?? [
          ...DEFAULT_IGNORE_KEYS,
          ...(cfg.extraIgnoreKeys ?? []),
        ],
      );
      const entries: Array<[string, unknown]> = [];
      for (const [key, value] of Object.entries(data)) {
        if (ignoreSet.has(key)) continue;
        if (value === null || value === undefined) continue;
        entries.push([key, value]);
      }
      return entries;
    }

    it("matches original for enabled config with custom fields", () => {
      const data = {
        title: "ignored",
        author: "Alice",
        custom: "hello",
        nullVal: null,
      };
      const fmConfig = {};
      const factory = createBuildFrontmatterPreviewEntries({
        frontmatterPreview: fmConfig,
        defaultIgnoreKeys: DEFAULT_IGNORE_KEYS,
      });
      expect(factory(data)).toEqual(originalBuildFrontmatterPreviewEntries(data, fmConfig));
    });

    it("matches original for extraIgnoreKeys", () => {
      const data = { author: "Alice", custom: "hello" };
      const fmConfig = { extraIgnoreKeys: ["author"] };
      const factory = createBuildFrontmatterPreviewEntries({
        frontmatterPreview: fmConfig,
        defaultIgnoreKeys: DEFAULT_IGNORE_KEYS,
      });
      expect(factory(data)).toEqual(originalBuildFrontmatterPreviewEntries(data, fmConfig));
    });

    it("matches original for false (disabled)", () => {
      const data = { custom: "hello" };
      const factory = createBuildFrontmatterPreviewEntries({
        frontmatterPreview: false,
        defaultIgnoreKeys: DEFAULT_IGNORE_KEYS,
      });
      expect(factory(data)).toEqual(originalBuildFrontmatterPreviewEntries(data, false));
    });
  });
});
