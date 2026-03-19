import fs from "fs-extra";
import path from "path";
import type { UserChoices } from "./prompts.js";
import { getSecondaryLang } from "./scaffold.js";
import { getLangLabel } from "./utils.js";

export async function stripFeatures(
  targetDir: string,
  choices: UserChoices,
): Promise<void> {
  const defaultLang = choices.defaultLang;
  const hasI18n = choices.features.includes("i18n");

  // --- Default language patching ---
  // The template ships with "en" as the default locale. When the user picks a
  // different default language we need to patch several files.
  if (defaultLang !== "en") {
    await patchDefaultLang(targetDir, defaultLang);
  }

  // --- i18n handling ---
  if (hasI18n) {
    // The template has src/pages/ja/ as the secondary-language pages.
    // We need to ensure the secondary pages directory matches the actual
    // secondary language for this project.
    const secondaryLang = getSecondaryLang(defaultLang);

    if (secondaryLang !== "ja") {
      // Template has ja/ pages — we need to recreate them for the actual secondary lang.
      // Copy ja/ pages, patch locale refs, then remove the ja/ originals.
      await createSecondaryPages(targetDir, secondaryLang);
      await removeIfExists(targetDir, "src/pages/ja");
      // Also handle versioned locale pages
      await renameVersionedLocalePages(targetDir, secondaryLang);
    }
    // else secondaryLang === "ja" — template pages are already correct

    // Remove template's docs-ja content dir only if secondary lang is not ja
    // (scaffold already created the correct secondary content dir)
    if (secondaryLang !== "ja") {
      await removeIfExists(targetDir, "src/content/docs-ja");
    }

    // Patch content.config.ts for the secondary language
    if (secondaryLang !== "ja") {
      await patchFile(
        path.join(targetDir, "src/content.config.ts"),
        [
          [/"docs-ja"/g, `"docs-${secondaryLang}"`],
          [/docsJa/g, `docs${toCamelSuffix(secondaryLang)}`],
        ],
      );
    }
  } else {
    // Strip i18n entirely
    await removeIfExists(targetDir, "src/pages/ja");
    await removeIfExists(targetDir, "src/content/docs-ja");
    // Also remove versioned locale pages
    await removeVersionedLocalePages(targetDir);
    await removeIfExists(targetDir, "src/components/language-switcher.astro");
    await removeI18nFromAstroConfig(targetDir);
    // Remove docsJa collection from content.config.ts
    await patchFile(
      path.join(targetDir, "src/content.config.ts"),
      [
        [/\nconst docsJa = defineCollection\(\{[^]*?\}\);\n/g, "\n"],
        [/export const collections = \{ docs, "docs-ja": docsJa \};/g, "export const collections = { docs };"],
      ],
    );
    // Remove LanguageSwitcher import + usage from header
    await patchFile(
      path.join(targetDir, "src/components/header.astro"),
      [
        [/import LanguageSwitcher from.*\n/g, ""],
        [/import \{ type Locale \} from.*\n/g, ""],
        [/\s*\{lang && <LanguageSwitcher[^]*?\/>\}\s*\n?/g, "\n"],
      ],
    );
  }

  // Strip search if not selected
  if (!choices.features.includes("search")) {
    await removeIfExists(targetDir, "src/components/search.astro");
    await removeIfExists(targetDir, "src/integrations/pagefind.ts");
    await patchFile(
      path.join(targetDir, "src/components/header.astro"),
      [
        [/import Search from.*\n/g, ""],
        [/\s*<Search\s*\/>\s*\n?/g, "\n"],
      ],
    );
    await patchFile(
      path.join(targetDir, "astro.config.ts"),
      [
        [/import.*pagefindIntegration.*\n/g, ""],
        [/\s*pagefindIntegration\(\),?\n?/g, "\n"],
      ],
    );
  }

  // Strip Claude Resources if not selected
  if (!choices.features.includes("claudeResources")) {
    await removeIfExists(targetDir, "src/integrations/claude-resources");
  }

  // Strip unused theme components based on color scheme mode.
  // The header uses `settings.colorMode && (<ThemeToggle ... />)` —
  // no ColorSchemePicker in header (scheme selection is in the tweak panel).
  if (choices.colorSchemeMode !== "light-dark") {
    // In single scheme mode, ThemeToggle is never used — remove file + imports + usage
    await removeIfExists(targetDir, "src/components/theme-toggle.tsx");
    await patchFile(
      path.join(targetDir, "src/components/header.astro"),
      [
        [/import ThemeToggle from.*\n/g, ""],
        [/\s*\{\s*\n?\s*settings\.colorMode && \(\s*\n?\s*<ThemeToggle[^]*?\/>\s*\n?\s*\)\s*\n?\s*\}\s*\n?/g, "\n"],
      ],
    );
  }

  // Strip color tweak panel if not selected
  if (!choices.features.includes("colorTweakPanel")) {
    await removeIfExists(targetDir, "src/components/color-tweak-panel.tsx");
    await removeIfExists(targetDir, "src/components/color-tweak-export-modal.tsx");
    await removeIfExists(targetDir, "src/config/color-tweak-presets.ts");
    await removeIfExists(targetDir, "src/utils/color-convert.ts");
    await removeIfExists(targetDir, "src/utils/export-code.ts");
    await patchFile(
      path.join(targetDir, "src/layouts/doc-layout.astro"),
      [
        [/import ColorTweakPanel from.*\n/g, ""],
        [/import \{ SEMANTIC_DEFAULTS, SEMANTIC_CSS_NAMES \} from.*\n/g, ""],
        [/\s*\{settings\.colorTweakPanel &&[\s\S]*?<\/script>\s*\n\s*\)\}\s*\n?/g, "\n"],
        [/\s*\{settings\.colorTweakPanel && <ColorTweakPanel[^]*?\/>\}\s*\n?/g, "\n"],
      ],
    );
    // Remove tweak trigger button from header
    await patchFile(
      path.join(targetDir, "src/components/header.astro"),
      [
        [/\s*\{settings\.colorTweakPanel &&[\s\S]*?id="color-tweak-trigger"[\s\S]*?\}\}\s*\n?/g, "\n"],
      ],
    );
  }

  // TODO: Strip sidebar filter when not selected
  // The sidebar filter is built into sidebar-tree.tsx — stripping requires
  // careful component surgery. For now, the filter is always included.

  // --- Strip imports for features disabled by default in generated projects ---
  // The template astro.config.ts is copied from the monorepo root and has ALL
  // imports. We must strip imports for features that are always off by default
  // to avoid referencing packages not in the generated package.json.
  await patchFile(path.join(targetDir, "astro.config.ts"), [
    // Math (always false by default)
    [/import remarkMath from "remark-math";\n/g, ""],
    [/import rehypeKatex from "rehype-katex";\n/g, ""],
    [/\s*\.\.\.\(settings\.math \? \[remarkMath\] : \[\]\),?\n?/g, "\n"],
    [/\s*\.\.\.\(settings\.math \? \[rehypeKatex\] : \[\]\),?\n?/g, "\n"],
    // AI assistant / @astrojs/node adapter (always false by default)
    [/import node from "@astrojs\/node";\n/g, ""],
    [
      /\s*\.\.\.\(settings\.aiAssistant \? \{ adapter: node\(\{ mode: "standalone" \}\) \} : \{\}\),?\n?/g,
      "\n",
    ],
    // Doc history integration (always false by default)
    [
      /import \{ docHistoryIntegration \} from "\.\/src\/integrations\/doc-history";\n/g,
      "",
    ],
    [
      /\s*\.\.\.\(settings\.docHistory \? \[docHistoryIntegration\(\)\] : \[\]\),?\n?/g,
      "\n",
    ],
    // LLMs.txt integration (always false by default)
    [
      /import \{ llmsTxtIntegration \} from "\.\/src\/integrations\/llms-txt";\n/g,
      "",
    ],
    [
      /\s*\.\.\.\(settings\.llmsTxt \? \[llmsTxtIntegration\(\)\] : \[\]\),?\n?/g,
      "\n",
    ],
    // Sitemap integration (disabled — needs siteUrl)
    [
      /import \{ sitemapIntegration \} from "\.\/src\/integrations\/sitemap";\n/g,
      "",
    ],
    [
      /\s*\.\.\.\(settings\.sitemap && !settings\.noindex \? \[sitemapIntegration\(\)\] : \[\]\),?\n?/g,
      "\n",
    ],
    // trailingSlash config line (false by default)
    [
      /\s*trailingSlash: settings\.trailingSlash \? "always" : "never",\n/g,
      "\n",
    ],
  ]);

  // Remove integration files for disabled features
  await removeIfExists(targetDir, "src/integrations/doc-history.ts");
  await removeIfExists(targetDir, "src/integrations/llms-txt.ts");
  await removeIfExists(targetDir, "src/integrations/sitemap.ts");

  // Remove AI chat and MSW mock components (aiAssistant is false by default)
  await removeIfExists(targetDir, "src/components/ai-chat-modal.tsx");
  await removeIfExists(targetDir, "src/components/mock-init.tsx");
  await patchFile(
    path.join(targetDir, "src/layouts/doc-layout.astro"),
    [
      [/import MockInit from.*\n/g, ""],
      [/\s*\{import\.meta\.env\.DEV && import\.meta\.env\.PUBLIC_ENABLE_MOCKS[^}]*<MockInit[^}]*\/>\}\s*\n?/g, "\n"],
    ],
  );

  // Remove doc-history component (docHistory is false by default)
  await removeIfExists(targetDir, "src/components/doc-history.tsx");
}

/**
 * Patch the template's hardcoded "en" default locale to a different language.
 * This modifies i18n.ts, astro.config.ts, and the root page files.
 */
async function patchDefaultLang(
  targetDir: string,
  lang: string,
): Promise<void> {
  const label = getLangLabel(lang);

  // Patch src/config/i18n.ts
  await patchFile(path.join(targetDir, "src/config/i18n.ts"), [
    // Change: export const defaultLocale = "en" as const;
    [
      /export const defaultLocale = "en" as const;/g,
      `export const defaultLocale = "${lang}" as const;`,
    ],
    // Change: if (locale === defaultLocale) return "EN";
    [
      /return "EN";/g,
      `return ${JSON.stringify(label)};`,
    ],
  ]);

  // Patch astro.config.ts: defaultLocale
  await patchFile(path.join(targetDir, "astro.config.ts"), [
    [/defaultLocale: "en"/g, `defaultLocale: "${lang}"`],
    [/locales: \["en"/g, `locales: ["${lang}"`],
  ]);

  // Patch root pages — replace hardcoded "en" locale references
  // src/pages/index.astro
  await patchFile(path.join(targetDir, "src/pages/index.astro"), [
    [/loadLocaleDocs\("en"\)/g, `loadLocaleDocs("${lang}")`],
    [/buildNavTree\(navDocs, "en"/g, `buildNavTree(navDocs, "${lang}"`],
    [/<html lang="en">/g, `<html lang="${lang}">`],
    [/<Header lang="en">/g, `<Header lang="${lang}">`],
  ]);

  // src/pages/docs/[...slug].astro
  await patchFile(path.join(targetDir, "src/pages/docs/[...slug].astro"), [
    [/buildNavTree\(navDocs, "en"/g, `buildNavTree(navDocs, "${lang}"`],
    [/buildBreadcrumbs\(tree, slug, "en"\)/g, `buildBreadcrumbs(tree, slug, "${lang}")`],
    [/buildBreadcrumbs\(tree, node\.slug, "en"\)/g, `buildBreadcrumbs(tree, node.slug, "${lang}")`],
    [/docsUrl\(child\.slug, "en"\)/g, `docsUrl(child.slug, "${lang}")`],
    [/docsUrl\(doc\.slug, "en"\)/g, `docsUrl(doc.slug, "${lang}")`],
    [/locale="en"/g, `locale="${lang}"`],
    [/t\("nav\.previous", "en"\)/g, `t("nav.previous", "${lang}")`],
    [/t\("nav\.next", "en"\)/g, `t("nav.next", "${lang}")`],
  ]);

  // src/pages/docs/tags/index.astro — no patching needed.
  // The English tags/index.astro calls t() without locale arg (defaults to defaultLocale).

  // src/pages/docs/tags/[tag].astro
  await patchFile(path.join(targetDir, "src/pages/docs/tags/[tag].astro"), [
    [/docsUrl\(doc\.slug, "en"\)/g, `docsUrl(doc.slug, "${lang}")`],
  ]);
}

/**
 * Create secondary language page files from the template's ja/ pages,
 * patching locale references to the target secondary language.
 */
async function createSecondaryPages(
  targetDir: string,
  secondaryLang: string,
): Promise<void> {
  const jaDir = path.join(targetDir, "src/pages/ja");
  const newDir = path.join(targetDir, `src/pages/${secondaryLang}`);

  if (!(await fs.pathExists(jaDir))) return;

  // Copy the ja/ directory structure
  await fs.copy(jaDir, newDir);

  // Patch all .astro files in the new directory
  const astroFiles = await findAstroFiles(newDir);
  for (const file of astroFiles) {
    await patchFile(file, [
      // Replace "ja" locale references with the secondary lang
      [/loadLocaleDocs\("ja"\)/g, `loadLocaleDocs("${secondaryLang}")`],
      [/buildNavTree\(navDocs, "ja"/g, `buildNavTree(navDocs, "${secondaryLang}"`],
      [/buildBreadcrumbs\(tree, slug, "ja"\)/g, `buildBreadcrumbs(tree, slug, "${secondaryLang}")`],
      [/buildBreadcrumbs\(tree, node\.slug, "ja"\)/g, `buildBreadcrumbs(tree, node.slug, "${secondaryLang}")`],
      [/<html lang="ja">/g, `<html lang="${secondaryLang}">`],
      [/lang="ja"/g, `lang="${secondaryLang}"`],
      [/docsUrl\(child\.slug, "ja"\)/g, `docsUrl(child.slug, "${secondaryLang}")`],
      [/docsUrl\(doc\.slug, "ja"\)/g, `docsUrl(doc.slug, "${secondaryLang}")`],
      [/locale="ja"/g, `locale="${secondaryLang}"`],
      [/t\("([^"]+)", "ja"\)/g, `t("$1", "${secondaryLang}")`],
      [/getContentDir\("ja"\)/g, `getContentDir("${secondaryLang}")`],
      [/getDocsCollection\("docs-ja"\)/g, `getDocsCollection("docs-${secondaryLang}")`],
      [/withBase\(`\/ja/g, `withBase(\`/${secondaryLang}`],
      [/withBase\("\/ja/g, `withBase("/${secondaryLang}`],
      [/href=\{withBase\("\/ja\//g, `href={withBase("/${secondaryLang}/`],
    ]);
  }
}

/** Rename versioned locale pages from ja/ to the actual secondary language. */
async function renameVersionedLocalePages(
  targetDir: string,
  secondaryLang: string,
): Promise<void> {
  const versionDir = path.join(targetDir, "src/pages/v");
  if (!(await fs.pathExists(versionDir))) return;

  const entries = await fs.readdir(versionDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const jaDir = path.join(versionDir, entry.name, "ja");
      const newDir = path.join(versionDir, entry.name, secondaryLang);
      if (await fs.pathExists(jaDir)) {
        await fs.copy(jaDir, newDir);
        await fs.remove(jaDir);
        // Patch locale refs in the new versioned pages
        const files = await findAstroFiles(newDir);
        for (const file of files) {
          await patchFile(file, [
            [/locale="ja"/g, `locale="${secondaryLang}"`],
            [/t\("([^"]+)", "ja"\)/g, `t("$1", "${secondaryLang}")`],
            [/getContentDir\("ja"\)/g, `getContentDir("${secondaryLang}")`],
            [/getDocsCollection\("docs-ja"\)/g, `getDocsCollection("docs-${secondaryLang}")`],
          ]);
        }
      }
    }
  }
}

/** Remove locale subdirectories from versioned pages (e.g., v/[version]/ja/). */
async function removeVersionedLocalePages(targetDir: string): Promise<void> {
  const versionDir = path.join(targetDir, "src/pages/v");
  if (!(await fs.pathExists(versionDir))) return;

  const entries = await fs.readdir(versionDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const jaDir = path.join(versionDir, entry.name, "ja");
      if (await fs.pathExists(jaDir)) {
        await fs.remove(jaDir);
      }
    }
  }
}

/** Recursively find all .astro files in a directory. */
async function findAstroFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findAstroFiles(fullPath)));
    } else if (entry.name.endsWith(".astro")) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Convert a locale code to a valid JS identifier suffix: "zh-cn" → "ZhCn", "en" → "En". */
function toCamelSuffix(code: string): string {
  return code
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

async function removeIfExists(
  base: string,
  relativePath: string,
): Promise<void> {
  const fullPath = path.join(base, relativePath);
  if (await fs.pathExists(fullPath)) {
    await fs.remove(fullPath);
  }
}

/** Apply a list of regex replacements to a file (if it exists). */
async function patchFile(
  filePath: string,
  replacements: [RegExp, string][],
): Promise<void> {
  if (!(await fs.pathExists(filePath))) return;
  let content = await fs.readFile(filePath, "utf-8");
  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }
  await fs.writeFile(filePath, content);
}

async function removeI18nFromAstroConfig(targetDir: string): Promise<void> {
  const configPath = path.join(targetDir, "astro.config.ts");
  if (!(await fs.pathExists(configPath))) return;
  let content = await fs.readFile(configPath, "utf-8");
  // Remove the i18n block by matching balanced braces (handles nested routing config)
  const i18nStart = content.indexOf("i18n:");
  if (i18nStart === -1) return;

  // Find the opening brace
  const openBrace = content.indexOf("{", i18nStart);
  if (openBrace === -1) return;

  // Count braces to find the matching close
  let depth = 0;
  let end = openBrace;
  for (let i = openBrace; i < content.length; i++) {
    if (content[i] === "{") depth++;
    if (content[i] === "}") depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }

  // Remove from before "i18n:" to after the closing brace + optional comma
  const lineStart = content.lastIndexOf("\n", i18nStart);
  let lineEnd = end + 1;
  if (content[lineEnd] === ",") lineEnd++;
  if (content[lineEnd] === "\n") lineEnd++;

  content = content.slice(0, lineStart) + content.slice(lineEnd);
  await fs.writeFile(configPath, content);
}
