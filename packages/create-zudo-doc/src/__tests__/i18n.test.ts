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

  it("default-locale docs/[...slug].astro uses 'ja' at every call site", async () => {
    const content = await fs.readFile(
      projectPath("test-ja-en", "src/pages/docs/[...slug].astro"),
      "utf-8",
    );
    // Must contain the locale-correct calls
    expect(content).toMatch(/buildNavTree\(navDocs, "ja"/);
    expect(content).toMatch(/buildBreadcrumbs\(fullTree, slug, "ja"\)/);
    expect(content).toMatch(/buildBreadcrumbs\(fullTree, node\.slug, "ja"\)/);
    expect(content).toMatch(/locale="ja"/);
    expect(content).toMatch(/t\("nav\.previous", "ja"\)/);
    expect(content).toMatch(/t\("nav\.next", "ja"\)/);
    // Must NOT contain the other locale literal
    assertNoWrongLocale(content, "en");
  });

  it("secondary-locale en/docs/[...slug].astro uses 'en' at every call site", async () => {
    const filePath = projectPath(
      "test-ja-en",
      "src/pages/en/docs/[...slug].astro",
    );
    expect(await fs.pathExists(filePath)).toBe(true);
    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toMatch(/getDocsCollection\("docs-en"\)/);
    expect(content).toMatch(/getContentDir\("en"\)/);
    expect(content).toMatch(/buildNavTree\(navDocs, "en"/);
    expect(content).toMatch(/buildNavTree\(allDocs, "en"/);
    expect(content).toMatch(/buildBreadcrumbs\(fullTree, slug, "en"\)/);
    expect(content).toMatch(/buildBreadcrumbs\(fullTree, node\.slug, "en"\)/);
    expect(content).toMatch(/lang="en"/);
    expect(content).toMatch(/locale="en"/);
    expect(content).toMatch(/t\("nav\.previous", "en"\)/);
    assertNoWrongLocale(content, "ja");
  });

  it("secondary-locale en/index.astro uses 'en' CTA label (not 概要)", async () => {
    const content = await fs.readFile(
      projectPath("test-ja-en", "src/pages/en/index.astro"),
      "utf-8",
    );
    expect(content).not.toContain("概要");
    expect(content).toMatch(/t\("nav\.overview", "en"\)/);
    expect(content).toMatch(/loadLocaleDocs\("en"\)/);
    expect(content).toMatch(/buildNavTree\(navDocs, "en"/);
    assertNoWrongLocale(content, "ja");
  });

  it("default-locale ja/index-ish (root) uses 'ja' CTA", async () => {
    // Default-locale index is at src/pages/index.astro after patchDefaultLang
    const content = await fs.readFile(
      projectPath("test-ja-en", "src/pages/index.astro"),
      "utf-8",
    );
    expect(content).toMatch(/t\("nav\.overview", "ja"\)/);
    expect(content).toMatch(/loadLocaleDocs\("ja"\)/);
    expect(content).toMatch(/buildNavTree\(navDocs, "ja"/);
    assertNoWrongLocale(content, "en");
  });

  it("en/docs/tags/[tag].astro and index use 'en' at every call site", async () => {
    const tagPage = await fs.readFile(
      projectPath("test-ja-en", "src/pages/en/docs/tags/[tag].astro"),
      "utf-8",
    );
    expect(tagPage).toMatch(/getDocsCollection\("docs-en"\)/);
    expect(tagPage).toMatch(/t\("doc\.taggedWith", "en"\)/);
    expect(tagPage).toMatch(/docsUrl\(doc\.slug, "en"\)/);
    expect(tagPage).toMatch(/withBase\("\/en\/docs/);
    assertNoWrongLocale(tagPage, "ja");

    const tagsIndex = await fs.readFile(
      projectPath("test-ja-en", "src/pages/en/docs/tags/index.astro"),
      "utf-8",
    );
    expect(tagsIndex).toMatch(/t\("doc\.allTags", "en"\)/);
    expect(tagsIndex).toMatch(/locale="en"/);
    expect(tagsIndex).toMatch(/withBase\("\/en\/docs/);
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

  it("default-locale docs/[...slug].astro uses 'en' at every call site", async () => {
    const content = await fs.readFile(
      projectPath("test-en-ja", "src/pages/docs/[...slug].astro"),
      "utf-8",
    );
    expect(content).toMatch(/buildNavTree\(navDocs, "en"/);
    expect(content).toMatch(/buildNavTree\(docs, "en"/);
    expect(content).toMatch(/buildBreadcrumbs\(fullTree, slug, "en"\)/);
    expect(content).toMatch(/buildBreadcrumbs\(fullTree, node\.slug, "en"\)/);
    expect(content).toMatch(/locale="en"/);
    expect(content).toMatch(/t\("nav\.previous", "en"\)/);
    assertNoWrongLocale(content, "ja");
  });

  it("secondary-locale ja/docs/[...slug].astro uses 'ja' at every call site (unchanged)", async () => {
    const filePath = projectPath(
      "test-en-ja",
      "src/pages/ja/docs/[...slug].astro",
    );
    expect(await fs.pathExists(filePath)).toBe(true);
    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toMatch(/buildNavTree\(navDocs, "ja"/);
    expect(content).toMatch(/buildNavTree\(allDocs, "ja"/);
    expect(content).toMatch(/buildBreadcrumbs\(fullTree, slug, "ja"\)/);
    expect(content).toMatch(/lang="ja"/);
    expect(content).toMatch(/locale="ja"/);
  });

  it("default-locale index.astro uses 'Overview' label (via nav.overview 'en')", async () => {
    const content = await fs.readFile(
      projectPath("test-en-ja", "src/pages/index.astro"),
      "utf-8",
    );
    expect(content).toMatch(/t\("nav\.overview", "en"\)/);
    expect(content).not.toContain("概要");
  });

  it("secondary-locale ja/index.astro uses '概要' label (via nav.overview 'ja')", async () => {
    const content = await fs.readFile(
      projectPath("test-en-ja", "src/pages/ja/index.astro"),
      "utf-8",
    );
    expect(content).toMatch(/t\("nav\.overview", "ja"\)/);
    // Should not be the raw "Overview" string (translation call is fine)
    const bareOverview = /^\s*Overview\s*$/m.test(content);
    expect(bareOverview).toBe(false);
  });
});
