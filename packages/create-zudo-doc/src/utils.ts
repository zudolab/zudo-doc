import { execSync } from "child_process";
import fs from "fs-extra";

// Project-name grammar (locked by F4 — S4 #2013):
// /^[a-z0-9][a-z0-9._-]*$/, max 214 chars, unscoped, used as both directory
// name and package name. Mirrors npm's unscoped-name rules + max path safety.
const PROJECT_NAME_RE = /^[a-z0-9][a-z0-9._-]*$/;
const PROJECT_NAME_MAX = 214;

/**
 * Validate a project name against the locked grammar.
 *
 * Returns `null` when valid; a human-readable error string when invalid.
 * Apply on every input path: CLI arg, interactive prompt, preset, and
 * programmatic API.
 */
export function validateProjectName(name: string): string | null {
  if (!name || name.length === 0) {
    return "Project name is required";
  }
  if (name.length > PROJECT_NAME_MAX) {
    return `Project name must be ${PROJECT_NAME_MAX} characters or fewer`;
  }
  if (!PROJECT_NAME_RE.test(name)) {
    return (
      "Project name must start with a lowercase letter or digit and contain " +
      "only lowercase letters, digits, dots, underscores, and hyphens"
    );
  }
  return null;
}

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
