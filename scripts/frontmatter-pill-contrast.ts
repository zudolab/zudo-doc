/**
 * Deterministic WCAG sweep for the showcase frontmatter status pills.
 *
 * The foreground/background recipes are parsed from `src/styles/global.css`
 * so this guard measures the CSS that renders, rather than duplicating its
 * percentages in test code. The required catalog is pinned to the 16 packs
 * accepted for #2869; changes to that contract must be deliberate.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultColorSchemes } from "@takazudo/zudo-doc/color-schemes-defaults";
import { schemeToCssPairs } from "@takazudo/zudo-doc/color-scheme-utils";
import { colorMixSrgb, contrastRatio } from "../src/config/contrast-utils";

export const PILL_ROLES = ["danger", "success", "warning", "info", "muted"] as const;
export type PillRole = (typeof PILL_ROLES)[number];
export type ColorMode = "light" | "dark";

export const REQUIRED_PILL_PACKS = [
  "default",
  "foundry",
  "broadsheet",
  "ledger",
  "manuscript",
  "swissgrid",
  "futura-editorial",
  "hearth",
  "matcha",
  "sumi",
  "washi",
  "drift",
  "fjord",
  "hollow",
  "nocturne",
  "onyx",
] as const;

export const PILL_CONTRAST_THRESHOLD = 4.5;

interface PillCssRecipe {
  foregroundRolePct: number;
  backgroundRolePct: number;
}

export interface PillContrastResult {
  pack: string;
  mode: ColorMode;
  role: PillRole;
  foreground: string;
  background: string;
  ratio: number;
  pass: boolean;
}

type ResolvedColors = Record<"bg" | "fg" | PillRole, string>;

const REQUIRED_COLOR_KEYS = ["bg", "fg", ...PILL_ROLES] as const;
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse and validate the actual per-role CSS derivation. */
export function parsePillCssRecipe(css: string): PillCssRecipe {
  let sharedRecipe: PillCssRecipe | undefined;

  for (const role of PILL_ROLES) {
    const block = css.match(
      new RegExp(`\\.zd-fm-pill--${escapeRegExp(role)}\\s*\\{([\\s\\S]*?)\\}`),
    )?.[1];
    if (!block) throw new Error(`Missing .zd-fm-pill--${role} CSS rule`);

    const foreground = block.match(
      new RegExp(
        `color:\\s*color-mix\\(in srgb,\\s*var\\(--color-${escapeRegExp(role)}\\)\\s+(\\d+(?:\\.\\d+)?)%,\\s*var\\(--color-fg\\)\\s*\\)\\s*;`,
      ),
    );
    const background = block.match(
      new RegExp(
        `background-color:\\s*color-mix\\(in srgb,\\s*var\\(--color-${escapeRegExp(role)}\\)\\s+(\\d+(?:\\.\\d+)?)%,\\s*var\\(--color-bg\\)\\s*\\)\\s*;`,
      ),
    );
    if (!foreground || !background) {
      throw new Error(`Pill ${role} must derive foreground from role + fg and background from role + bg`);
    }

    const recipe = {
      foregroundRolePct: Number(foreground[1]),
      backgroundRolePct: Number(background[1]),
    };
    if (recipe.backgroundRolePct !== 12) {
      throw new Error(`Pill ${role} background tint must remain locked at 12%`);
    }
    if (
      sharedRecipe &&
      (recipe.foregroundRolePct !== sharedRecipe.foregroundRolePct ||
        recipe.backgroundRolePct !== sharedRecipe.backgroundRolePct)
    ) {
      throw new Error(`Pill ${role} derivation differs from the other roles`);
    }
    sharedRecipe = recipe;
  }

  if (!sharedRecipe) throw new Error("No frontmatter pill CSS recipes found");
  return sharedRecipe;
}

function resolveDefaultColors(mode: ColorMode): ResolvedColors {
  const scheme = defaultColorSchemes[mode === "light" ? "Default Light" : "Default Dark"];
  if (!scheme) throw new Error(`Missing default ${mode} color scheme`);
  const pairs = new Map(schemeToCssPairs(scheme));
  return Object.fromEntries(
    REQUIRED_COLOR_KEYS.map((key) => {
      const value = pairs.get(`--zd-${key}`);
      if (!value) throw new Error(`Default ${mode} scheme is missing --zd-${key}`);
      return [key, value];
    }),
  ) as ResolvedColors;
}

function resolvePackColors(repoRoot: string, pack: string, mode: ColorMode): ResolvedColors {
  if (pack === "default") return resolveDefaultColors(mode);
  const css = readFileSync(resolve(repoRoot, "packages/zudo-doc/src/theme-packs", pack, "pack.css"), "utf8");
  const modeIndex = mode === "light" ? 1 : 2;

  return Object.fromEntries(
    REQUIRED_COLOR_KEYS.map((key) => {
      const match = css.match(
        new RegExp(`--zd-${escapeRegExp(key)}:\\s*light-dark\\((.+?),\\s*(.+?)\\)\\s*;`),
      );
      if (!match) throw new Error(`Pack ${pack} is missing a light-dark() --zd-${key} declaration`);
      return [key, match[modeIndex].trim()];
    }),
  ) as ResolvedColors;
}

export function evaluateFrontmatterPillContrast(repoRoot = REPO_ROOT): PillContrastResult[] {
  const css = readFileSync(resolve(repoRoot, "src/styles/global.css"), "utf8");
  const recipe = parsePillCssRecipe(css);
  const results: PillContrastResult[] = [];

  for (const pack of REQUIRED_PILL_PACKS) {
    for (const mode of ["light", "dark"] as const) {
      const colors = resolvePackColors(repoRoot, pack, mode);
      for (const role of PILL_ROLES) {
        const foreground = colorMixSrgb(colors[role], colors.fg, recipe.foregroundRolePct);
        const background = colorMixSrgb(colors[role], colors.bg, recipe.backgroundRolePct);
        const ratio = contrastRatio(foreground, background);
        results.push({
          pack,
          mode,
          role,
          foreground,
          background,
          ratio,
          pass: ratio >= PILL_CONTRAST_THRESHOLD,
        });
      }
    }
  }
  return results;
}

function main(): void {
  const results = evaluateFrontmatterPillContrast();
  const failures = results.filter((result) => !result.pass);
  const floor = results.reduce((lowest, result) => (result.ratio < lowest.ratio ? result : lowest));
  console.log(
    `Frontmatter pills: ${results.length - failures.length}/${results.length} pass; floor ${floor.ratio.toFixed(6)}:1 at ${floor.pack}/${floor.mode}/${floor.role}`,
  );
  for (const result of failures) {
    console.error(`${result.pack}/${result.mode}/${result.role}: ${result.ratio.toFixed(6)}:1`);
  }
  if (failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
