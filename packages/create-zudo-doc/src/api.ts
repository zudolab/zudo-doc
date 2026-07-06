import path from "path";
import { SINGLE_SCHEMES } from "./constants.js";
import { scaffold } from "./scaffold.js";
import { initGitRepo, installDependencies, validateProjectName } from "./utils.js";

export type { UserChoices } from "./prompts.js";

export interface CreateOptions {
  projectName: string;
  /** Default language code (default: "en") */
  defaultLang?: string;
  colorSchemeMode: "single" | "light-dark";
  singleScheme?: string;
  lightScheme?: string;
  darkScheme?: string;
  respectPrefersColorScheme?: boolean;
  defaultMode?: "light" | "dark";
  features: string[];
  /** GitHub repository URL — drives the header GitHub link and body-foot
   *  "View source on GitHub" link. Empty = disabled. */
  githubUrl?: string;
  packageManager: "pnpm" | "npm" | "yarn" | "bun";
  /** Install dependencies after scaffolding (default: false) */
  install?: boolean;
  /**
   * Initialize a git repository + initial commit after scaffolding
   * (default: false). The CLI defaults this on; the programmatic API defaults
   * it off so automation / test callers never create unexpected repos.
   */
  git?: boolean;
}

export async function createZudoDoc(options: CreateOptions): Promise<string> {
  const { install = false, git = false, ...rest } = options;
  const nameError = validateProjectName(rest.projectName);
  if (nameError) throw new Error(`Invalid projectName: ${nameError}`);
  // Validate scheme names like the CLI (cli.ts) and preset (preset.ts) paths do.
  // Only `Default Light`/`Default Dark` exist post-catalog-drop (#2619); an
  // unvalidated name here would be written verbatim into settings.ts and throw
  // "Unknown color scheme" at the generated site's build — the exact failure
  // this epic set out to eliminate. This is the last scaffolding entry point
  // that lacked the guard.
  for (const [label, value] of [
    ["color scheme", rest.singleScheme],
    ["light scheme", rest.lightScheme],
    ["dark scheme", rest.darkScheme],
  ] as const) {
    if (value && !SINGLE_SCHEMES.includes(value)) {
      throw new Error(`Unknown ${label} "${value}"`);
    }
  }
  const choices = { ...rest, defaultLang: rest.defaultLang ?? "en" };
  await scaffold(choices);
  const targetDir = path.resolve(process.cwd(), choices.projectName);
  if (install) {
    installDependencies(targetDir, choices.packageManager);
  }
  if (git) {
    initGitRepo(targetDir);
  }
  return targetDir;
}
