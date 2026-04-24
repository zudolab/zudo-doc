import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";

export function installDependencies(dir: string, pm: string): void {
  const commands: Record<string, string> = {
    pnpm: "pnpm install",
    npm: "npm install",
    yarn: "yarn",
    bun: "bun install",
  };
  const cmd = commands[pm] || "npm install";
  // Use pipe to avoid garbled output when used alongside spinner
  execSync(cmd, { cwd: dir, stdio: "pipe" });
}

export function capitalize(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Get a short uppercase label for a language code (e.g. "en" → "EN", "zh-cn" → "ZH-CN"). */
export function getLangLabel(langCode: string): string {
  return langCode.toUpperCase();
}

/** Determine the secondary language code when i18n is enabled. */
export function getSecondaryLang(defaultLang: string): string {
  return defaultLang === "en" ? "ja" : "en";
}

/** Apply a list of regex replacements to a file (if it exists). */
export async function patchFile(
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

/** Patch default locale references in page files.
 *
 * Base pages no longer contain literal `"en"` for the default locale — they
 * read `defaultLocale` from `src/config/i18n.ts`, which in turn reads
 * `settings.defaultLocale`. So this hook only needs to patch the
 * `getLocaleLabel` fallback in i18n.ts so that `getLocaleLabel(defaultLocale)`
 * returns the correct uppercase label (e.g. "JA" instead of "EN").
 */
export async function patchDefaultLang(
  targetDir: string,
  lang: string,
): Promise<void> {
  const label = getLangLabel(lang);

  await patchFile(path.join(targetDir, "src/config/i18n.ts"), [
    [/return "EN";/g, `return ${JSON.stringify(label)};`],
  ]);
}
