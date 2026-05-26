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
    expect(result).toContain("plugins: integrationPlugins,");

    // W7A (#1736): the pre-cutover factory-import pattern is retired —
    // plugins are inline objects pointing at `.mjs` modules shipped by
    // the templates, NOT factory imports from `./src/integrations/*`.
    expect(result).not.toContain('from "./src/integrations/');
    expect(result).not.toContain("searchIndexPlugin(");
    expect(result).not.toContain("docHistoryPlugin(");
    expect(result).not.toContain("llmsTxtPlugin(");
    expect(result).not.toContain("claudeResourcesPlugin(");

    // search-index and copy-public are always-on (matches host) — the
    // search widget mounts unconditionally and consumers may need
    // public/ copied. They appear even on a barebone project.
    expect(result).toContain('name: "./plugins/search-index-plugin.mjs"');
    expect(result).toContain('name: "./plugins/copy-public-plugin.mjs"');

    // Optional plugins should NOT be present on a barebone project.
    expect(result).not.toContain("doc-history-plugin.mjs");
    expect(result).not.toContain("llms-txt-plugin.mjs");
    expect(result).not.toContain("claude-resources-plugin.mjs");

    // migration guards: generated package.json must never include Astro deps
    expect(result).not.toContain("astro/config");
    expect(result).not.toContain("@astrojs/mdx");
    expect(result).not.toContain("@astrojs/preact");
    expect(result).not.toContain("output: ");
    expect(result).not.toContain("i18n:");
  });

  it("search-index plugin entry uses inline-object shape with docsDir/locales/base options", () => {
    const choices = { ...baseChoices, features: ["search"] };
    const result = generateZfbConfig(choices);
    expect(result).toContain('name: "./plugins/search-index-plugin.mjs"');
    expect(result).toContain("docsDir: settings.docsDir,");
    expect(result).toContain("locales: localeRecord,");
    expect(result).toContain("base: settings.base,");
  });

  it("doc-history plugin entry uses inline-object shape and gates on settings.docHistory", () => {
    const choices = { ...baseChoices, features: ["docHistory"] };
    const result = generateZfbConfig(choices);
    expect(result).toContain('name: "./plugins/doc-history-plugin.mjs"');
    expect(result).toContain("settings.docHistory");
    expect(result).toContain("locales: localeRecord,");
  });

  it("llms-txt plugin entry uses inline-object shape and gates on settings.llmsTxt", () => {
    const choices = { ...baseChoices, features: ["llmsTxt"] };
    const result = generateZfbConfig(choices);
    expect(result).toContain('name: "./plugins/llms-txt-plugin.mjs"');
    expect(result).toContain("settings.llmsTxt");
    expect(result).toContain("siteName: settings.siteName,");
    expect(result).toContain("siteUrl: settings.siteUrl,");
    expect(result).toContain("locales: localeArray,");
  });

  it("claude-resources plugin entry uses inline-object shape and gates on settings.claudeResources", () => {
    const choices = { ...baseChoices, features: ["claudeResources"] };
    const result = generateZfbConfig(choices);
    expect(result).toContain('name: "./plugins/claude-resources-plugin.mjs"');
    expect(result).toContain("settings.claudeResources");
    expect(result).toContain("claudeDir: settings.claudeResources.claudeDir,");
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

  it("includes every plugin entry when all integration features are selected", () => {
    const choices: UserChoices = {
      ...baseChoices,
      features: ["search", "docHistory", "llmsTxt", "claudeResources"],
    };
    const result = generateZfbConfig(choices);
    // All five plugin .mjs references should appear (search + copy-public
    // always-on; doc-history + llms-txt + claude-resources from feature flags).
    expect(result).toContain('name: "./plugins/search-index-plugin.mjs"');
    expect(result).toContain('name: "./plugins/doc-history-plugin.mjs"');
    expect(result).toContain('name: "./plugins/llms-txt-plugin.mjs"');
    expect(result).toContain('name: "./plugins/claude-resources-plugin.mjs"');
    expect(result).toContain('name: "./plugins/copy-public-plugin.mjs"');
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

  it("emits base/trailingSlash/stripMdExt/resolveMarkdownLinks fields matching host", () => {
    // W7A (#1736): host's zfb.config.ts threads these settings through —
    // the generator must do the same so scaffolds inherit the same routing
    // semantics (link rewriting, trailing-slash, base prefix).
    const result = generateZfbConfig(baseChoices);
    expect(result).toContain("base: settings.base,");
    expect(result).toContain("trailingSlash: settings.trailingSlash,");
    expect(result).toContain("stripMdExt: true,");
    expect(result).toContain("resolveMarkdownLinks: {");
    expect(result).toContain('onBrokenLinks: "warn"');
  });
});
