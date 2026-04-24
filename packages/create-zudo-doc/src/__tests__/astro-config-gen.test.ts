import { describe, it, expect } from "vitest";
import { generateAstroConfig } from "../astro-config-gen.js";
import type { UserChoices } from "../prompts.js";

const baseChoices: UserChoices = {
  projectName: "test-doc",
  defaultLang: "en",
  colorSchemeMode: "single",
  singleScheme: "Dracula",
  features: [],
  packageManager: "pnpm",
};

describe("generateAstroConfig", () => {
  it("generates valid config for barebone project", () => {
    const result = generateAstroConfig(baseChoices);
    expect(result).toContain('import { defineConfig } from "astro/config"');
    expect(result).toContain('import mdx from "@astrojs/mdx"');
    expect(result).toContain('import preact from "@astrojs/preact"');
    expect(result).toContain("export default defineConfig({");
    expect(result).toContain('output: "static"');
    // Should NOT have optional feature imports
    expect(result).not.toContain("searchIndexIntegration");
    expect(result).not.toContain("docHistoryIntegration");
    expect(result).not.toContain("llmsTxtIntegration");
    expect(result).not.toContain("claudeResourcesIntegration");
    // Should NOT have i18n block
    expect(result).not.toContain("i18n:");
    // Should NOT have always-stripped features
    expect(result).not.toContain("@astrojs/node");
    expect(result).not.toContain("remarkMath");
    expect(result).not.toContain("rehypeKatex");
    expect(result).not.toContain("sitemapIntegration");
  });

  it("includes search integration when search is selected", () => {
    const choices = { ...baseChoices, features: ["search"] };
    const result = generateAstroConfig(choices);
    expect(result).toContain("searchIndexIntegration");
  });

  it("includes doc history integration when selected", () => {
    const choices = { ...baseChoices, features: ["docHistory"] };
    const result = generateAstroConfig(choices);
    expect(result).toContain("docHistoryIntegration");
  });

  it("includes llms.txt integration when selected", () => {
    const choices = { ...baseChoices, features: ["llmsTxt"] };
    const result = generateAstroConfig(choices);
    expect(result).toContain("llmsTxtIntegration");
  });

  it("includes claude resources integration when selected", () => {
    const choices = { ...baseChoices, features: ["claudeResources"] };
    const result = generateAstroConfig(choices);
    expect(result).toContain("claudeResourcesIntegration");
  });

  it("includes i18n block when i18n is selected", () => {
    const choices = { ...baseChoices, features: ["i18n"] };
    const result = generateAstroConfig(choices);
    expect(result).toContain("i18n:");
    expect(result).toContain("defaultLocale:");
    expect(result).toContain("prefixDefaultLocale: false");
  });

  it("derives default locale from settings in i18n block", () => {
    const choices = {
      ...baseChoices,
      defaultLang: "ja",
      features: ["i18n"],
    };
    const result = generateAstroConfig(choices);
    expect(result).toContain("defaultLocale: settings.defaultLocale");
    expect(result).toContain(
      "locales: [settings.defaultLocale, ...Object.keys(settings.locales)]",
    );
  });

  it("generates single shiki config for single color scheme mode", () => {
    const result = generateAstroConfig(baseChoices);
    expect(result).toContain("theme: shikiTheme");
    expect(result).not.toContain("themes:");
    expect(result).not.toContain("defaultColor: false");
  });

  it("generates dual shiki config for light-dark mode", () => {
    const choices: UserChoices = {
      ...baseChoices,
      colorSchemeMode: "light-dark",
      lightScheme: "GitHub Light",
      darkScheme: "GitHub Dark",
    };
    const result = generateAstroConfig(choices);
    expect(result).toContain("settings.colorMode");
    expect(result).toContain("themes:");
    expect(result).toContain("defaultColor: false");
  });

  it("always includes mermaid in rehype plugins (runtime-gated)", () => {
    const result = generateAstroConfig(baseChoices);
    expect(result).toContain("rehypeMermaid");
    expect(result).toContain("settings.mermaid");
  });

  it("always includes remark-resolve-markdown-links", () => {
    const result = generateAstroConfig(baseChoices);
    expect(result).toContain("remarkResolveMarkdownLinks");
  });

  it("includes all integrations when all features selected", () => {
    const choices: UserChoices = {
      ...baseChoices,
      features: [
        "search",
        "i18n",
        "docHistory",
        "llmsTxt",
        "claudeResources",
      ],
    };
    const result = generateAstroConfig(choices);
    expect(result).toContain("searchIndexIntegration");
    expect(result).toContain("docHistoryIntegration");
    expect(result).toContain("llmsTxtIntegration");
    expect(result).toContain("claudeResourcesIntegration");
    expect(result).toContain("i18n:");
  });
});
