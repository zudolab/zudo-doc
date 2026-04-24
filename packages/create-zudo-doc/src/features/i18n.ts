import fs from "fs-extra";
import path from "path";
import type { FeatureModule } from "../compose.js";
import type { UserChoices } from "../prompts.js";
import { getSecondaryLang, patchDefaultLang, patchFile } from "../utils.js";

export const i18nFeature: FeatureModule = (choices) => ({
  name: "i18n",
  injections: [
    {
      file: "src/components/header.astro",
      anchor: "// @slot:header:imports",
      content: `import LanguageSwitcher from "@/components/language-switcher.astro";`,
    },
    {
      file: "src/components/header.astro",
      anchor: "<!-- @slot:header:after-theme-toggle -->",
      content: `      {lang && <LanguageSwitcher lang={lang} />}`,
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

// --- i18n-specific helpers ---

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
      [/buildNavTree\((navDocs|allDocs|docs), "ja"/g, `buildNavTree($1, "${secondaryLang}"`],
      [/buildBreadcrumbs\((tree|fullTree), (slug|node\.slug), "ja"\)/g, `buildBreadcrumbs($1, $2, "${secondaryLang}")`],
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

