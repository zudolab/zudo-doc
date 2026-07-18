import path from "path";
import { SINGLE_SCHEMES, THEME_PACKS } from "./constants.js";
import type { PresetHeaderRightItem, PresetMetaTagsConfig } from "./preset.js";
import { validateHeaderRightItems, validateMetaTags } from "./preset.js";
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
  /** Theme pack slug (ADR #2818 Decision 7), validated against THEME_PACKS. Default: "default". */
  themePack?: string;
  features: string[];
  /** GitHub repository URL — drives the header GitHub link and body-foot
   *  "View source on GitHub" link. Empty = disabled. */
  githubUrl?: string;
  /** Enable remark-cjk-friendly plugin (intelligent spacing around CJK text). Default: false. */
  cjkFriendly?: boolean;
  /** Minify production HTML output. Default: true. */
  minifyHtml?: boolean;
  packageManager: "pnpm" | "npm" | "yarn" | "bun";
  /** Header-right items override, validated against the v1 preset allowlist
   *  (see `validateHeaderRightItems`). When omitted, keeps the package default. */
  headerRightItems?: PresetHeaderRightItem[];
  /** Meta tags config, validated against the v1 preset shape
   *  (see `validateMetaTags`). When omitted, keeps the package defaults. */
  metaTags?: PresetMetaTagsConfig;
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
  // Validate the theme pack slug like the CLI (cli.ts) and preset (preset.ts)
  // paths do (ADR #2818 Decision 7 / #2823 codex-review follow-up) — an
  // unvalidated slug here would be written verbatim into zfb.config.ts and
  // only fail when the generated site's build reaches plugin setup.
  if (rest.themePack && !THEME_PACKS.some((t) => t.slug === rest.themePack)) {
    const catalog = THEME_PACKS.map((t) => t.slug).join(", ");
    throw new Error(`Unknown theme pack "${rest.themePack}". Available: ${catalog}`);
  }
  // Validate headerRightItems/metaTags shape like the preset (preset.ts) path
  // does (#2922) — the two validators are shared via preset.ts so this can
  // never drift from `validatePreset()`'s rules. Booleans (cjkFriendly,
  // minifyHtml) need no validation.
  if (rest.headerRightItems !== undefined) {
    const err = validateHeaderRightItems(rest.headerRightItems);
    if (err) throw new Error(err);
  }
  if (rest.metaTags !== undefined) {
    const err = validateMetaTags(rest.metaTags);
    if (err) throw new Error(err);
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
