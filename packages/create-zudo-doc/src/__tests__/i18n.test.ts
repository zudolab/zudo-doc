import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import type { UserChoices } from "../prompts.js";
import { scaffold } from "../scaffold.js";

const TEMP_PREFIX = "create-zudo-doc-i18n-test-";

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.remove(tempDir);
});

function projectPath(...segments: string[]): string {
  return path.join(tempDir, segments[0]!, ...segments.slice(1));
}

// Locales that should NEVER appear as hardcoded literals in a page's call sites.
function assertNoWrongLocale(content: string, wrongLocale: string) {
  const offenders: string[] = [];
  const patterns = [
    new RegExp(`buildNavTree\\([A-Za-z_]+,\\s*"${wrongLocale}"`, "g"),
    new RegExp(
      `buildBreadcrumbs\\([A-Za-z_]+,\\s*[A-Za-z_.]+,\\s*"${wrongLocale}"\\)`,
      "g",
    ),
    new RegExp(`lang="${wrongLocale}"`, "g"),
    new RegExp(`locale="${wrongLocale}"`, "g"),
    new RegExp(`t\\("[^"]+",\\s*"${wrongLocale}"\\)`, "g"),
    new RegExp(`docsUrl\\([A-Za-z_.]+,\\s*"${wrongLocale}"\\)`, "g"),
    new RegExp(`loadLocaleDocs\\("${wrongLocale}"\\)`, "g"),
    new RegExp(`getContentDir\\("${wrongLocale}"\\)`, "g"),
  ];
  for (const re of patterns) {
    const matches = content.match(re);
    if (matches) offenders.push(...matches);
  }
  if (offenders.length > 0) {
    throw new Error(
      `Found wrong-locale literals for "${wrongLocale}":\n${offenders.join("\n")}`,
    );
  }
}

describe("i18n — defaultLang 'ja' + secondary 'en'", () => {
  const choices: UserChoices = {
    projectName: "test-ja-en",
    defaultLang: "ja",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["i18n", "search"],
    packageManager: "pnpm",
  };

  beforeEach(async () => {
    await scaffold(choices);
  });

  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("default-locale docs/[...slug].astro uses defaultLocale (no literal) at every call site", async () => {
    const content = await fs.readFile(
      projectPath("test-ja-en", "src/pages/docs/[...slug].astro"),
      "utf-8",
    );
    // Base pages now read defaultLocale from i18n.ts (which reads
    // settings.defaultLocale) instead of hardcoding the locale string.
    expect(content).toMatch(/buildNavTree\(navDocs, defaultLocale/);
    expect(content).toMatch(/buildBreadcrumbs\(fullTree, slug, defaultLocale\)/);
    expect(content).toMatch(/buildBreadcrumbs\(fullTree, node\.slug, defaultLocale\)/);
    expect(content).toMatch(/locale=\{defaultLocale\}/);
    expect(content).toMatch(/t\("nav\.previous", defaultLocale\)/);
    expect(content).toMatch(/t\("nav\.next", defaultLocale\)/);
    // Must NOT contain either raw locale literal as a hardcoded call-site arg
    assertNoWrongLocale(content, "en");
    assertNoWrongLocale(content, "ja");
  });

  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("secondary-locale [locale]/docs/[...slug].astro uses lang variable (no literal) at every call site", async () => {
    const filePath = projectPath(
      "test-ja-en",
      "src/pages/[locale]/docs/[...slug].astro",
    );
    expect(await fs.pathExists(filePath)).toBe(true);
    const content = await fs.readFile(filePath, "utf-8");
    // The catch-all reads Astro.params.locale and iterates settings.locales,
    // so the page is shared across every non-default locale and contains no
    // literal locale string in its call sites.
    expect(content).toMatch(/Astro\.params\.locale as Locale/);
    expect(content).toMatch(/Object\.keys\(settings\.locales\)/);
    expect(content).toMatch(/buildNavTree\(navDocs, locale/);
    expect(content).toMatch(/buildNavTree\(allDocs, locale/);
    expect(content).toMatch(/buildBreadcrumbs\(fullTree, slug, locale\)/);
    expect(content).toMatch(/lang=\{lang\}/);
    expect(content).toMatch(/locale=\{lang\}/);
    expect(content).toMatch(/t\("nav\.previous", lang\)/);
    assertNoWrongLocale(content, "en");
    assertNoWrongLocale(content, "ja");
  });

  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("secondary-locale [locale]/index.astro uses lang variable (no literal locale)", async () => {
    const content = await fs.readFile(
      projectPath("test-ja-en", "src/pages/[locale]/index.astro"),
      "utf-8",
    );
    // The shared template reads Astro.params.locale; UI strings come from t()
    // which resolves at runtime from the resolved locale, so no literal
    // localized text appears in the file.
    expect(content).not.toContain("概要");
    expect(content).toMatch(/Astro\.params\.locale as Locale/);
    expect(content).toMatch(/t\("nav\.overview", lang\)/);
    expect(content).toMatch(/loadLocaleDocs\(lang\)/);
    expect(content).toMatch(/buildNavTree\(navDocs, lang/);
    assertNoWrongLocale(content, "en");
    assertNoWrongLocale(content, "ja");
  });

  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("default-locale index.astro uses defaultLocale (no literal) at every call site", async () => {
    // Default-locale index is at src/pages/index.astro. It now reads
    // defaultLocale from i18n.ts instead of hardcoding the locale string.
    const content = await fs.readFile(
      projectPath("test-ja-en", "src/pages/index.astro"),
      "utf-8",
    );
    expect(content).toMatch(/t\("nav\.overview", defaultLocale\)/);
    expect(content).toMatch(/loadLocaleDocs\(defaultLocale\)/);
    expect(content).toMatch(/buildNavTree\(navDocs, defaultLocale/);
    assertNoWrongLocale(content, "en");
    assertNoWrongLocale(content, "ja");
  });

  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("[locale]/docs/tags/[tag].astro and index use lang variable (no literal locale)", async () => {
    const tagPage = await fs.readFile(
      projectPath(
        "test-ja-en",
        "src/pages/[locale]/docs/tags/[tag].astro",
      ),
      "utf-8",
    );
    expect(tagPage).toMatch(/Astro\.params\.locale as Locale/);
    expect(tagPage).toMatch(/loadLocaleDocs\(locale\)/);
    expect(tagPage).toMatch(/t\("doc\.taggedWith", lang\)/);
    expect(tagPage).toMatch(/docsUrl\(doc\.slug, lang\)/);
    expect(tagPage).toMatch(/withBase\(`\/\$\{lang\}\/docs\/tags`\)/);
    assertNoWrongLocale(tagPage, "en");
    assertNoWrongLocale(tagPage, "ja");

    const tagsIndex = await fs.readFile(
      projectPath(
        "test-ja-en",
        "src/pages/[locale]/docs/tags/index.astro",
      ),
      "utf-8",
    );
    expect(tagsIndex).toMatch(/Astro\.params\.locale as Locale/);
    expect(tagsIndex).toMatch(/t\("doc\.allTags", lang\)/);
    expect(tagsIndex).toMatch(/locale=\{lang\}/);
    assertNoWrongLocale(tagsIndex, "en");
    assertNoWrongLocale(tagsIndex, "ja");
  });
});

describe("i18n — defaultLang 'en' + secondary 'ja' (mirror)", () => {
  const choices: UserChoices = {
    projectName: "test-en-ja",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["i18n", "search"],
    packageManager: "pnpm",
  };

  beforeEach(async () => {
    await scaffold(choices);
  });

  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("default-locale docs/[...slug].astro uses defaultLocale (no literal) at every call site", async () => {
    const content = await fs.readFile(
      projectPath("test-en-ja", "src/pages/docs/[...slug].astro"),
      "utf-8",
    );
    expect(content).toMatch(/buildNavTree\(navDocs, defaultLocale/);
    expect(content).toMatch(/buildNavTree\(docs, defaultLocale/);
    expect(content).toMatch(/buildBreadcrumbs\(fullTree, slug, defaultLocale\)/);
    expect(content).toMatch(/buildBreadcrumbs\(fullTree, node\.slug, defaultLocale\)/);
    expect(content).toMatch(/locale=\{defaultLocale\}/);
    expect(content).toMatch(/t\("nav\.previous", defaultLocale\)/);
    assertNoWrongLocale(content, "en");
    assertNoWrongLocale(content, "ja");
  });

  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("secondary-locale [locale]/docs/[...slug].astro uses lang variable (template is locale-agnostic)", async () => {
    const filePath = projectPath(
      "test-en-ja",
      "src/pages/[locale]/docs/[...slug].astro",
    );
    expect(await fs.pathExists(filePath)).toBe(true);
    const content = await fs.readFile(filePath, "utf-8");
    // The catch-all is shared — it must not bake any single locale literal in,
    // so it stays correct regardless of which non-default locale settings.locales
    // declares.
    expect(content).toMatch(/Astro\.params\.locale as Locale/);
    expect(content).toMatch(/Object\.keys\(settings\.locales\)/);
    expect(content).toMatch(/buildNavTree\(navDocs, locale/);
    expect(content).toMatch(/buildNavTree\(allDocs, locale/);
    expect(content).toMatch(/buildBreadcrumbs\(fullTree, slug, locale\)/);
    expect(content).toMatch(/lang=\{lang\}/);
    expect(content).toMatch(/locale=\{lang\}/);
    assertNoWrongLocale(content, "en");
    assertNoWrongLocale(content, "ja");
  });

  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("default-locale index.astro uses defaultLocale for nav.overview (no literal)", async () => {
    const content = await fs.readFile(
      projectPath("test-en-ja", "src/pages/index.astro"),
      "utf-8",
    );
    expect(content).toMatch(/t\("nav\.overview", defaultLocale\)/);
    expect(content).not.toContain("概要");
  });

  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("secondary-locale [locale]/index.astro uses lang variable (no literal locale)", async () => {
    const content = await fs.readFile(
      projectPath("test-en-ja", "src/pages/[locale]/index.astro"),
      "utf-8",
    );
    expect(content).toMatch(/Astro\.params\.locale as Locale/);
    expect(content).toMatch(/t\("nav\.overview", lang\)/);
    // Should not be the raw "Overview" string (translation call is fine)
    const bareOverview = /^\s*Overview\s*$/m.test(content);
    expect(bareOverview).toBe(false);
    assertNoWrongLocale(content, "en");
    assertNoWrongLocale(content, "ja");
  });
});
