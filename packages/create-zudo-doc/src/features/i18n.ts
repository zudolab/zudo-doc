import fs from "fs-extra";
import path from "path";
import type { FeatureModule } from "../compose.js";
import type { UserChoices } from "../prompts.js";
import { getSecondaryLang } from "../scaffold.js";
import { getLangLabel } from "../utils.js";

export const i18nFeature: FeatureModule = (choices) => ({
  name: "i18n",
  files: [
    "src/components/language-switcher.astro",
    // Secondary language pages are copied from template and patched in postProcess
  ],
  injections: [
    {
      file: "src/components/header.astro",
      anchor: "// @slot:header:imports",
      content: `import LanguageSwitcher from "@/components/language-switcher.astro";
import { locales } from "@/config/i18n";`,
    },
    {
      file: "src/components/header.astro",
      anchor: "<!-- @slot:header:after-theme-toggle -->",
      content: `      {lang && <LanguageSwitcher lang={lang} locales={locales} />}`,
      position: "after",
    },
  ],
  postProcess: async (targetDir, ch) => {
    const defaultLang = ch.defaultLang;
    const secondaryLang = getSecondaryLang(defaultLang);

    // Patch default language if not "en"
    if (defaultLang !== "en") {
      await patchDefaultLang(targetDir, defaultLang);
    }

    // Copy and patch secondary language pages
    if (secondaryLang !== "ja") {
      // Template has ja/ pages — recreate them for the actual secondary lang
      await createSecondaryPages(targetDir, secondaryLang);
      await removeIfExists(targetDir, "src/pages/ja");
    }
    // else secondaryLang === "ja" — template pages are already correct
  },
});

// --- Helpers extracted from strip.ts ---

async function patchDefaultLang(
  targetDir: string,
  lang: string,
): Promise<void> {
  const label = getLangLabel(lang);

  await patchFile(path.join(targetDir, "src/config/i18n.ts"), [
    [/export const defaultLocale = "en" as const;/g, `export const defaultLocale = "${lang}" as const;`],
    [/return "EN";/g, `return ${JSON.stringify(label)};`],
  ]);

  // Patch root pages
  await patchFile(path.join(targetDir, "src/pages/index.astro"), [
    [/loadLocaleDocs\("en"\)/g, `loadLocaleDocs("${lang}")`],
    [/buildNavTree\(navDocs, "en"/g, `buildNavTree(navDocs, "${lang}"`],
    [/lang="en"/g, `lang="${lang}"`],
  ]);

  await patchFile(path.join(targetDir, "src/pages/404.astro"), [
    [/lang="en"/g, `lang="${lang}"`],
  ]);

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

  await patchFile(path.join(targetDir, "src/pages/docs/tags/[tag].astro"), [
    [/docsUrl\(doc\.slug, "en"\)/g, `docsUrl(doc.slug, "${lang}")`],
  ]);
}

async function createSecondaryPages(
  targetDir: string,
  secondaryLang: string,
): Promise<void> {
  const jaDir = path.join(targetDir, "src/pages/ja");
  const newDir = path.join(targetDir, `src/pages/${secondaryLang}`);

  if (!(await fs.pathExists(jaDir))) return;

  await fs.copy(jaDir, newDir);

  const astroFiles = await findAstroFiles(newDir);
  for (const file of astroFiles) {
    await patchFile(file, [
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

async function removeIfExists(base: string, relativePath: string): Promise<void> {
  const fullPath = path.join(base, relativePath);
  if (await fs.pathExists(fullPath)) {
    await fs.remove(fullPath);
  }
}

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
