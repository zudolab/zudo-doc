import { describe, it, expect } from "vitest";
import { generateContentConfig } from "../content-config-gen.js";
import type { UserChoices } from "../prompts.js";

const baseChoices: UserChoices = {
  projectName: "test-doc",
  defaultLang: "en",
  colorSchemeMode: "single",
  singleScheme: "Dracula",
  features: [],
  packageManager: "pnpm",
};

describe("generateContentConfig", () => {
  it("generates base docs collection for barebone project", () => {
    const result = generateContentConfig(baseChoices);
    expect(result).toContain('import { defineCollection } from "astro:content"');
    expect(result).toContain("const docs = defineCollection(");
    expect(result).toContain("export const collections = { docs }");
    // No locale or version collections
    expect(result).not.toContain("localeCollections");
    expect(result).not.toContain("versionCollections");
  });

  it("includes locale collections when i18n is selected", () => {
    const choices = { ...baseChoices, features: ["i18n"] };
    const result = generateContentConfig(choices);
    expect(result).toContain("localeCollections");
    expect(result).toContain("settings.locales");
    expect(result).toContain("...localeCollections");
  });

  it("includes version collections when versioning is selected", () => {
    const choices = { ...baseChoices, features: ["versioning"] };
    const result = generateContentConfig(choices);
    expect(result).toContain("versionCollections");
    expect(result).toContain("settings.versions");
    expect(result).toContain("...versionCollections");
  });

  it("includes both locale and version collections when both selected", () => {
    const choices = {
      ...baseChoices,
      features: ["i18n", "versioning"],
    };
    const result = generateContentConfig(choices);
    expect(result).toContain("localeCollections");
    expect(result).toContain("versionCollections");
    expect(result).toContain(
      "export const collections = { docs, ...localeCollections, ...versionCollections }",
    );
  });

  it("always includes the docsSchema with all frontmatter fields", () => {
    const result = generateContentConfig(baseChoices);
    expect(result).toContain("title: z.string()");
    expect(result).toContain("description: z.string().optional()");
    expect(result).toContain("sidebar_position: z.number().optional()");
    expect(result).toContain("draft: z.boolean().optional()");
    expect(result).toContain("slug: z.string().optional()");
  });

  it("preserves unknown frontmatter keys via .passthrough()", () => {
    const result = generateContentConfig(baseChoices);
    expect(result).toContain(".passthrough()");
  });

  it("includes version locale variants in version collections", () => {
    const choices = { ...baseChoices, features: ["versioning"] };
    const result = generateContentConfig(choices);
    expect(result).toContain("version.locales");
    expect(result).toContain("docs-v-${version.slug}-${code}");
  });
});
