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

  it("imports buildDocsSchema from docs-schema (single source of truth) and calls it", () => {
    // S7 (#2016): the schema definition is now the single source of truth in
    // src/config/docs-schema.ts — generated zfb.config.ts imports the builder
    // rather than inlining the field list. This keeps pages/_data.ts and
    // src/types/docs-entry.ts in sync via z.infer without duplication.
    const result = generateZfbConfig(baseChoices);
    expect(result).toContain(
      'import { buildDocsSchema } from "./src/config/docs-schema"',
    );
    expect(result).toContain("const docsSchema = buildDocsSchema();");
    // The inline field list must NOT appear — it lives in docs-schema.ts.
    expect(result).not.toContain("title: z.string()");
    expect(result).not.toContain("z.object({");
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

  it("does NOT emit inline buildTagsSchema or tagVocabulary import (encapsulated in docs-schema.ts)", () => {
    // S7 (#2016): tag governance is now encapsulated inside buildDocsSchema()
    // in src/config/docs-schema.ts — the generated zfb.config.ts needs no
    // inline schema builder or extra tagVocabulary import for any feature set.
    const baseResult = generateZfbConfig(baseChoices);
    expect(baseResult).not.toContain("buildTagsSchema");
    expect(baseResult).not.toContain("tagVocabulary");

    const tagGovernanceChoices = { ...baseChoices, features: ["tagGovernance"] };
    const tagResult = generateZfbConfig(tagGovernanceChoices);
    expect(tagResult).not.toContain("function buildTagsSchema");
    expect(tagResult).not.toContain(
      'import { tagVocabulary } from "./src/config/tag-vocabulary"',
    );
    // The schema builder import is always present regardless of features.
    expect(tagResult).toContain(
      'import { buildDocsSchema } from "./src/config/docs-schema"',
    );
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

  it("emits a markdown.features block with the former-Core features and safe opt-ins (#1808 updated by #1824 updated by #1841)", () => {
    // S6 (#1808): zfb next.12+ moved admonitionsPreset/mermaid/imageEnlarge/
    // headingMarkerToc from always-on (Core) to opt-in. The generator re-enabled
    // them plus the safe opt-ins so scaffolded projects work out of the box.
    // S2 (#1825): imageEnlarge was hard-removed from the Rust config schema in
    // zfb next.18 — it must NOT appear in the generated markdown.features block
    // (it causes the Rust config loader to reject the config with "unknown key").
    // Image-enlarge is now re-implemented via an MDX p-override.
    // S3 (#1841): admonitionsPreset was removed in zfb next.25 — replaced by
    // the directives recipe map. The generator now emits directives: { ... }.
    const result = generateZfbConfig(baseChoices);
    expect(result).toContain("markdown: {");
    expect(result).toContain("features: {");
    // Directives map replaces admonitionsPreset (removed in zfb next.25)
    expect(result).toContain("directives: {");
    expect(result).toContain('note: "Note"');
    expect(result).toContain('details: "Details"');
    // admonitionsPreset must NOT appear — it was removed from the zfb schema.
    expect(result).not.toContain("admonitionsPreset");
    expect(result).toContain("mermaid: true");
    expect(result).toContain("headingMarkerToc: true");
    // imageEnlarge must NOT be in the generated markdown.features block.
    expect(result).not.toContain("imageEnlarge:");
    // Safe opt-ins (boolean-OR-object)
    expect(result).toContain("githubAlerts: true");
    expect(result).toContain("readingTime: true");
    expect(result).toContain("codeTabs: true");
    // Object-typed features — must use {} or options, NOT `true`
    expect(result).toContain("codeEnrichment: {}");
    expect(result).toContain("imageDimensions: {}");
    expect(result).toContain("linkValidation: { failOnBroken: false }");
    // Heading-ID strategy reads from the single-source-of-truth setting.
    expect(result).toContain("headingIds: { strategy: settings.headingIdStrategy }");
  });

  it("does NOT emit ruby, tocExport, or transclude as enabled (known-blocked at next.13) (#1808)", () => {
    // ruby (#1815) and tocExport (#1814) break SSR at next.13; transclude
    // 500s without a registered renderer. None of these should appear as
    // enabled (un-commented) in the generated config.
    const result = generateZfbConfig(baseChoices);
    // These must not appear as enabled keys — commented-out or absent is fine.
    // We check they don't appear on their own uncommented line.
    expect(result).not.toMatch(/^\s+ruby:\s+true/m);
    expect(result).not.toMatch(/^\s+tocExport:/m);
    expect(result).not.toMatch(/^\s+transclude:/m);
  });

  it("does NOT emit githubAutolinks (repo is project-specific — user configures manually) (#1808)", () => {
    // The showcase hardcodes repo: "zudolab/zudo-doc" but generated projects
    // belong to a different repo. Omit and let users add it themselves.
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain("githubAutolinks");
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
