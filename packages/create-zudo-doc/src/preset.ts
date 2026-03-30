import fs from "fs";
import { FEATURES } from "./constants.js";
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
  return presetToChoices(json);
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
