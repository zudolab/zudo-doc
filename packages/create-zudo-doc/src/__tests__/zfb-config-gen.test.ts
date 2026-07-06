import { describe, it, expect } from "vitest";
import { generateZfbConfig } from "../zfb-config-gen.js";
import type { UserChoices } from "../prompts.js";

const baseChoices: UserChoices = {
  projectName: "test-doc",
  defaultLang: "en",
  colorSchemeMode: "single",
  singleScheme: "Default Dark",
  features: [],
  packageManager: "pnpm",
};

describe("generateZfbConfig", () => {
  // S5b (#2329): collapsed to the thin preset-based shape — all collection
  // wiring, plugin descriptors, markdown features, codeHighlight,
  // resolveMarkdownLinks, and trailingSlash are now delegated to
  // `zudoDocPreset()` from `@takazudo/zudo-doc/preset`. The generated config
  // spreads the preset result into `defineConfig` and keeps only the
  // project-owned shell fields (framework, port, tailwind, base).

  it("generates thin preset-based zfb config for barebone project", () => {
    const result = generateZfbConfig(baseChoices);

    // Must import defineConfig and zudoDocPreset
    expect(result).toContain('import { defineConfig } from "zfb/config"');
    expect(result).toContain(
      'import { zudoDocPreset } from "@takazudo/zudo-doc/preset"',
    );
    expect(result).toContain(
      'import { settings } from "./src/config/settings"',
    );
    expect(result).toContain(
      'import { buildDocsSchema } from "./src/config/docs-schema"',
    );
    expect(result).toContain(
      'import { translations } from "./src/config/i18n"',
    );
    expect(result).toContain(
      'import { colorSchemes } from "./src/config/color-schemes"',
    );
    expect(result).toContain("export default defineConfig({");

    // Must spread the preset result with translations + colorSchemes forwarded
    expect(result).toContain(
      "...zudoDocPreset({ settings, buildDocsSchema, directiveVocabulary, translations, colorSchemes })",
    );

    // Host-owned shell fields must be present
    expect(result).toContain('framework: "preact"');
    expect(result).toContain("tailwind: { enabled: true }");
    expect(result).toContain("base: settings.base,");

    // Preset-owned fields must NOT be inlined (delegate to preset)
    expect(result).not.toContain("  collections,");
    expect(result).not.toContain("plugins: integrationPlugins,");
    expect(result).not.toContain('name: "./plugins/search-index-plugin.mjs"');
    expect(result).not.toContain('name: "./plugins/copy-public-plugin.mjs"');
    expect(result).not.toContain("markdown: {");
    expect(result).not.toContain("codeHighlight: {");
    expect(result).not.toContain("resolveMarkdownLinks: {");
    expect(result).not.toContain("stripMdExt:");
    expect(result).not.toContain("trailingSlash: settings.trailingSlash,");

    // migration guards: generated package.json must never include Astro deps
    expect(result).not.toContain("astro/config");
    expect(result).not.toContain("@astrojs/mdx");
    expect(result).not.toContain("@astrojs/preact");
    expect(result).not.toContain("output: ");
    // i18n: is a settings key pattern but the thin config has no i18n block
    expect(result).not.toContain("i18n: {");
  });

  it("directiveVocabulary block is always emitted (passed into preset)", () => {
    const result = generateZfbConfig(baseChoices);
    // The seven canonical directives are always emitted as a const and passed
    // to zudoDocPreset — the preset wires them into markdown.features.directives.
    expect(result).toContain("const directiveVocabulary = {");
    expect(result).toContain('note: "Note"');
    expect(result).toContain('details: "Details"');
  });

  it("generated config is feature-agnostic (same output for barebone and full-features)", () => {
    // S5b: features are now driven entirely by settings.* (read at zfb-load
    // time by the preset). The generated zfb.config.ts is identical regardless
    // of which features were selected — feature data lives in settings.ts.
    const barebone = generateZfbConfig(baseChoices);
    const full = generateZfbConfig({
      ...baseChoices,
      features: ["search", "docHistory", "llmsTxt", "claudeResources", "i18n"],
    });
    expect(barebone).toBe(full);
  });

  it("does not inline zod or schema boilerplate (delegated to preset)", () => {
    const result = generateZfbConfig(baseChoices);
    // zod is a @takazudo/zudo-doc/preset internal; not needed in the generated
    // config file itself. The preset calls z.toJSONSchema internally.
    expect(result).not.toContain('from "zod"');
    expect(result).not.toContain("z.toJSONSchema");
    expect(result).not.toContain("const docsSchema");
    expect(result).not.toContain("interface CollectionEntryShape");
  });

  it("does NOT emit inline plugin .mjs references (delegated to preset via package specifiers)", () => {
    // S5b: preset now references plugins via @takazudo/zudo-doc/plugins/*
    // package specifiers. No project-local .mjs file references appear in
    // the thin generated config (except copy-public which the preset handles).
    const result = generateZfbConfig({
      ...baseChoices,
      features: ["docHistory", "llmsTxt", "claudeResources"],
    });
    expect(result).not.toContain("doc-history-plugin.mjs");
    expect(result).not.toContain("llms-txt-plugin.mjs");
    expect(result).not.toContain("claude-resources-plugin.mjs");
    expect(result).not.toContain("search-index-plugin.mjs");
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

  it("does NOT emit ruby, tocExport, or transclude as enabled (not in thin config — preset concerns)", () => {
    // The thin generated config has no inline markdown.features block.
    // This guard ensures no accidental inline features slip back in.
    const result = generateZfbConfig(baseChoices);
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

  it("imageEnlarge must NOT appear in the generated config", () => {
    // imageEnlarge was hard-removed from zfb's Rust config schema in next.18.
    // It is re-implemented as a userland MDX p-override, not a config flag.
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain("imageEnlarge:");
    expect(result).not.toContain("rehypeImageEnlarge");
  });
});
