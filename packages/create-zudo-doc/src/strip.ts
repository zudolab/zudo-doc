import fs from "fs-extra";
import path from "path";
import type { UserChoices } from "./prompts.js";

export async function stripFeatures(
  targetDir: string,
  choices: UserChoices,
): Promise<void> {
  // Strip i18n if not selected
  if (!choices.features.includes("i18n")) {
    await removeIfExists(targetDir, "src/pages/ja");
    await removeIfExists(targetDir, "src/content/docs-ja");
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

  // Strip color scheme preview / unused theme components
  if (choices.colorSchemeMode === "light-dark") {
    // In light/dark mode, ThemeToggle replaces ColorSchemePicker
    if (!choices.features.includes("colorSchemePreview")) {
      await removeIfExists(targetDir, "src/components/color-scheme-picker.tsx");
      // Remove ColorSchemePicker import and replace the ternary with just ThemeToggle
      await patchFile(
        path.join(targetDir, "src/components/header.astro"),
        [
          [/import ColorSchemePicker from.*\n/g, ""],
          [
            /\{settings\.colorMode \? \(\s*\n?\s*<ThemeToggle[^]*?\/>\s*\n?\s*\) : \(\s*\n?\s*<ColorSchemePicker[^]*?\/>\s*\n?\s*\)\}/g,
            "<ThemeToggle defaultMode={settings.colorMode.defaultMode} client:load />",
          ],
        ],
      );
    }
  } else {
    // In single scheme mode, ThemeToggle is never used — remove file + imports + usage
    await removeIfExists(targetDir, "src/components/theme-toggle.tsx");
    // Replace the ternary with just ColorSchemePicker and remove ThemeToggle import
    await patchFile(
      path.join(targetDir, "src/components/header.astro"),
      [
        [/import ThemeToggle from.*\n/g, ""],
        [
          /\{settings\.colorMode \? \(\s*\n?\s*<ThemeToggle[^]*?\/>\s*\n?\s*\) : \(\s*\n?\s*<ColorSchemePicker[^]*?\/>\s*\n?\s*\)\}/g,
          "<ColorSchemePicker client:load />",
        ],
      ],
    );
    if (!choices.features.includes("colorSchemePreview")) {
      await removeIfExists(targetDir, "src/components/color-scheme-picker.tsx");
      await patchFile(
        path.join(targetDir, "src/components/header.astro"),
        [
          [/import ColorSchemePicker from.*\n/g, ""],
          [/\s*<ColorSchemePicker\s+client:load\s*\/>\s*\n?/g, "\n"],
        ],
      );
    }
  }

  // TODO: Strip sidebar filter when not selected
  // The sidebar filter is built into sidebar-tree.tsx — stripping requires
  // careful component surgery. For now, the filter is always included.
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
