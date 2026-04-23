import path from "path";
import { scaffold } from "./scaffold.js";
import { installDependencies } from "./utils.js";

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
}

export async function createZudoDoc(options: CreateOptions): Promise<string> {
  const { install = false, ...rest } = options;
  const choices = { ...rest, defaultLang: rest.defaultLang ?? "en" };
  await scaffold(choices);
  const targetDir = path.resolve(process.cwd(), choices.projectName);
  if (install) {
    installDependencies(targetDir, choices.packageManager);
  }
  return targetDir;
}
