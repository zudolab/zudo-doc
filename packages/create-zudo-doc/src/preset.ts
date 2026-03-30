import fs from "fs";
import { FEATURES, SINGLE_SCHEMES, SUPPORTED_LANGS } from "./constants.js";
import type { PartialChoices } from "./prompts.js";

export interface PresetJson {
  projectName?: string;
  defaultLang?: string;
  colorSchemeMode?: "single" | "light-dark";
  singleScheme?: string;
  lightScheme?: string;
  darkScheme?: string;
  defaultMode?: "light" | "dark";
  respectPrefersColorScheme?: boolean;
  features?: string[];
  packageManager?: "pnpm" | "npm" | "yarn" | "bun";
}

export function loadPreset(pathOrStdin: string): PartialChoices {
  let raw: string;
  if (pathOrStdin === "-") {
    raw = fs.readFileSync(0, "utf8");
  } else {
    raw = fs.readFileSync(pathOrStdin, "utf8");
  }

  const json: PresetJson = JSON.parse(raw);
  const error = validatePreset(json);
  if (error) {
    throw new Error(error);
  }
  return presetToChoices(json);
}

const VALID_LANGS = new Set(SUPPORTED_LANGS.map((l) => l.value));
const VALID_SCHEMES = new Set(SINGLE_SCHEMES);
const VALID_PMS = new Set(["pnpm", "npm", "yarn", "bun"]);

export function validatePreset(json: PresetJson): string | null {
  if (json.features !== undefined && !Array.isArray(json.features)) {
    return `"features" must be an array in preset`;
  }
  if (json.defaultLang && !VALID_LANGS.has(json.defaultLang)) {
    return `Invalid language "${json.defaultLang}" in preset`;
  }
  if (json.colorSchemeMode && !["single", "light-dark"].includes(json.colorSchemeMode)) {
    return `Invalid colorSchemeMode "${json.colorSchemeMode}" in preset`;
  }
  if (json.singleScheme && !VALID_SCHEMES.has(json.singleScheme)) {
    return `Unknown color scheme "${json.singleScheme}" in preset`;
  }
  if (json.lightScheme && !VALID_SCHEMES.has(json.lightScheme)) {
    return `Unknown light scheme "${json.lightScheme}" in preset`;
  }
  if (json.darkScheme && !VALID_SCHEMES.has(json.darkScheme)) {
    return `Unknown dark scheme "${json.darkScheme}" in preset`;
  }
  if (json.defaultMode && !["light", "dark"].includes(json.defaultMode)) {
    return `Invalid defaultMode "${json.defaultMode}" in preset`;
  }
  if (json.packageManager && !VALID_PMS.has(json.packageManager)) {
    return `Invalid packageManager "${json.packageManager}" in preset`;
  }
  // Cross-field validation
  if (json.colorSchemeMode === "single" && (json.lightScheme || json.darkScheme)) {
    return `lightScheme/darkScheme are only valid with colorSchemeMode "light-dark"`;
  }
  if (json.colorSchemeMode === "light-dark" && json.singleScheme) {
    return `singleScheme is only valid with colorSchemeMode "single"`;
  }
  return null;
}

const KNOWN_FEATURES = new Set(FEATURES.map((f) => f.value));

export function presetToChoices(json: PresetJson): PartialChoices {
  const choices: PartialChoices = {};

  if (json.projectName) choices.projectName = json.projectName;
  if (json.defaultLang) choices.defaultLang = json.defaultLang;
  if (json.colorSchemeMode) choices.colorSchemeMode = json.colorSchemeMode;
  if (json.singleScheme) choices.singleScheme = json.singleScheme;
  if (json.lightScheme) choices.lightScheme = json.lightScheme;
  if (json.darkScheme) choices.darkScheme = json.darkScheme;
  if (json.defaultMode) choices.defaultMode = json.defaultMode;
  if (json.respectPrefersColorScheme !== undefined) {
    choices.respectPrefersColorScheme = json.respectPrefersColorScheme;
  }
  if (json.packageManager) choices.packageManager = json.packageManager;

  if (json.features) {
    // Warn about unrecognized feature names
    for (const name of json.features) {
      if (!KNOWN_FEATURES.has(name)) {
        console.warn(`Warning: unknown feature "${name}" in preset — ignored`);
      }
    }

    const featureMap: Partial<Record<string, boolean>> = {};
    for (const f of FEATURES) {
      featureMap[f.value] = json.features.includes(f.value);
    }
    choices.features = featureMap;
  }

  return choices;
}
