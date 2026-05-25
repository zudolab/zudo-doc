import { describe, it, expect } from "vitest";
import { generateZfbConfig } from "../zfb-config-gen.js";
import type { UserChoices } from "../prompts.js";

const baseChoices: UserChoices = {
  projectName: "test-doc",
  defaultLang: "en",
  colorSchemeMode: "single",
  singleScheme: "Dracula",
  features: [],
  packageManager: "pnpm",
};

describe("generateZfbConfig", () => {
  it("generates valid zfb config for barebone project", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).toContain('import { z } from "zod"');
    expect(result).toContain('import { defineConfig } from "zfb/config"');
    expect(result).toContain('import { settings } from "./src/config/settings"');
    expect(result).toContain("export default defineConfig({");
    expect(result).toContain('framework: "preact"');
    expect(result).toContain("tailwind: { enabled: true }");
    expect(result).toContain("collections,");
    expect(result).toContain("plugins: [");
    // Should NOT have optional feature imports
    expect(result).not.toContain("searchIndexPlugin");
    expect(result).not.toContain("docHistoryPlugin");
    expect(result).not.toContain("llmsTxtPlugin");
    expect(result).not.toContain("claudeResourcesPlugin");
    // Should NOT have Astro-specific symbols
    expect(result).not.toContain("astro/config");
    expect(result).not.toContain("@astrojs/mdx");
    expect(result).not.toContain("@astrojs/preact");
    expect(result).not.toContain("output: ");
    expect(result).not.toContain("i18n:");
  });

  it("includes searchIndexPlugin import and plugin entry when search is selected", () => {
    const choices = { ...baseChoices, features: ["search"] };
    const result = generateZfbConfig(choices);
    expect(result).toContain('import { searchIndexPlugin } from "./src/integrations/search-index"');
    expect(result).toContain("searchIndexPlugin()");
  });

  it("includes docHistoryPlugin import and conditional plugin entry when selected", () => {
    const choices = { ...baseChoices, features: ["docHistory"] };
    const result = generateZfbConfig(choices);
    expect(result).toContain('import { docHistoryPlugin } from "./src/integrations/doc-history"');
    expect(result).toContain("docHistoryPlugin");
    expect(result).toContain("settings.docHistory");
  });

  it("includes llmsTxtPlugin import and conditional plugin entry when selected", () => {
    const choices = { ...baseChoices, features: ["llmsTxt"] };
    const result = generateZfbConfig(choices);
    expect(result).toContain('import { llmsTxtPlugin } from "./src/integrations/llms-txt"');
    expect(result).toContain("llmsTxtPlugin");
    expect(result).toContain("settings.llmsTxt");
  });

  it("includes claudeResourcesPlugin import and conditional plugin entry when selected", () => {
    const choices = { ...baseChoices, features: ["claudeResources"] };
    const result = generateZfbConfig(choices);
    expect(result).toContain('import { claudeResourcesPlugin } from "./src/integrations/claude-resources"');
    expect(result).toContain("claudeResourcesPlugin");
    expect(result).toContain("settings.claudeResources");
  });

  it("always emits locale loop (no-op when locales is empty)", () => {
    const result = generateZfbConfig(baseChoices);
    // Loop is always present — it produces nothing when locales is {}.
    expect(result).toContain("Object.entries(settings.locales)");
    expect(result).toContain('name: `docs-${code}`');
  });

  it("always emits version block (short-circuits when versions is false)", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).toContain("if (settings.versions)");
    expect(result).toContain('name: `docs-v-${version.slug}`');
  });

  it("emits docsSchema with all frontmatter fields", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).toContain("title: z.string()");
    expect(result).toContain("description: z.string().optional()");
    expect(result).toContain("sidebar_position: z.number().optional()");
    expect(result).toContain("draft: z.boolean().optional()");
    expect(result).toContain("slug: z.string().optional()");
  });

  it("emits .passthrough() to preserve unknown frontmatter keys", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).toContain(".passthrough()");
  });

  it("emits z.toJSONSchema conversion for zfb collection schema format", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).toContain("z.toJSONSchema(docsSchema)");
  });

  it("emits CollectionEntryShape interface", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).toContain("interface CollectionEntryShape");
    expect(result).toContain("name: string;");
    expect(result).toContain("path: string;");
    expect(result).toContain("schema: Record<string, unknown>;");
  });

  it("uses plain z.array(z.string()) for tags when tagGovernance is off", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).toContain("z.array(z.string()).optional()");
    expect(result).not.toContain("buildTagsSchema");
    expect(result).not.toContain("tagVocabulary");
  });

  it("emits buildTagsSchema and tagVocabulary import when tagGovernance is selected", () => {
    const choices = { ...baseChoices, features: ["tagGovernance"] };
    const result = generateZfbConfig(choices);
    expect(result).toContain('import { tagVocabulary } from "./src/config/tag-vocabulary"');
    expect(result).toContain("function buildTagsSchema()");
    expect(result).toContain('settings.tagGovernance === "strict"');
    expect(result).toContain("tags: buildTagsSchema()");
  });

  it("includes all plugins when all relevant features selected", () => {
    const choices: UserChoices = {
      ...baseChoices,
      features: ["search", "docHistory", "llmsTxt", "claudeResources"],
    };
    const result = generateZfbConfig(choices);
    expect(result).toContain("searchIndexPlugin");
    expect(result).toContain("docHistoryPlugin");
    expect(result).toContain("llmsTxtPlugin");
    expect(result).toContain("claudeResourcesPlugin");
  });

  it("does not include Astro-specific markdown config (shiki, remark, rehype at config level)", () => {
    const choices: UserChoices = {
      ...baseChoices,
      features: ["search", "docHistory", "llmsTxt"],
    };
    const result = generateZfbConfig(choices);
    expect(result).not.toContain("shikiConfig");
    expect(result).not.toContain("remarkPlugins");
    expect(result).not.toContain("rehypePlugins");
    expect(result).not.toContain("vite:");
    expect(result).not.toContain("tailwindcss()");
  });
});
