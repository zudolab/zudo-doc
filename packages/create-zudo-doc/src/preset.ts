import fs from "fs";
import { FEATURES, SINGLE_SCHEMES, SUPPORTED_LANGS } from "./constants.js";
import type { PartialChoices } from "./prompts.js";

/**
 * Header-right item shapes accepted in v1 of preset support. Mirrors
 * `HeaderRightComponentItem` and `HeaderRightTriggerItem` from
 * `src/config/settings-types.ts`. The wider `link`/`html` variants are
 * intentionally rejected for now — they need free-text fields that pollute
 * the JSON preset schema and the generator UI.
 */
export type PresetHeaderRightComponentName =
  | "theme-toggle"
  | "language-switcher"
  | "version-switcher"
  | "github-link"
  | "search";

export type PresetHeaderRightTriggerName =
  | "design-token-panel"
  | "ai-chat";

export interface PresetHeaderRightComponentItem {
  type: "component";
  component: PresetHeaderRightComponentName;
}

export interface PresetHeaderRightTriggerItem {
  type: "trigger";
  trigger: PresetHeaderRightTriggerName;
}

export type PresetHeaderRightItem =
  | PresetHeaderRightComponentItem
  | PresetHeaderRightTriggerItem;

const VALID_HEADER_RIGHT_COMPONENTS = new Set<PresetHeaderRightComponentName>([
  "theme-toggle",
  "language-switcher",
  "version-switcher",
  "github-link",
  "search",
]);

const VALID_HEADER_RIGHT_TRIGGERS = new Set<PresetHeaderRightTriggerName>([
  "design-token-panel",
  "ai-chat",
]);

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
  githubUrl?: string;
  cjkFriendly?: boolean;
  packageManager?: "pnpm" | "npm" | "yarn" | "bun";
  headerRightItems?: PresetHeaderRightItem[];
}

export function loadPreset(pathOrStdin: string): PartialChoices {
  let raw: string;
  if (pathOrStdin === "-") {
    raw = fs.readFileSync(0, "utf8");
  } else {
    raw = fs.readFileSync(pathOrStdin, "utf8");
  }

  const json: unknown = JSON.parse(raw);
  const error = validatePreset(json);
  if (error) {
    throw new Error(error);
  }
  return presetToChoices(json as PresetJson);
}

const VALID_LANGS = new Set(SUPPORTED_LANGS.map((l) => l.value));
const VALID_SCHEMES = new Set(SINGLE_SCHEMES);
const VALID_PMS = new Set(["pnpm", "npm", "yarn", "bun"]);

export function validatePreset(json: unknown): string | null {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    return "Preset must be a JSON object";
  }
  const p = json as PresetJson;
  if (p.features !== undefined && !Array.isArray(p.features)) {
    return `"features" must be an array in preset`;
  }
  if (p.defaultLang && !VALID_LANGS.has(p.defaultLang)) {
    return `Invalid language "${p.defaultLang}" in preset`;
  }
  if (p.colorSchemeMode && !["single", "light-dark"].includes(p.colorSchemeMode)) {
    return `Invalid colorSchemeMode "${p.colorSchemeMode}" in preset`;
  }
  if (p.singleScheme && !VALID_SCHEMES.has(p.singleScheme)) {
    return `Unknown color scheme "${p.singleScheme}" in preset`;
  }
  if (p.lightScheme && !VALID_SCHEMES.has(p.lightScheme)) {
    return `Unknown light scheme "${p.lightScheme}" in preset`;
  }
  if (p.darkScheme && !VALID_SCHEMES.has(p.darkScheme)) {
    return `Unknown dark scheme "${p.darkScheme}" in preset`;
  }
  if (p.defaultMode && !["light", "dark"].includes(p.defaultMode)) {
    return `Invalid defaultMode "${p.defaultMode}" in preset`;
  }
  if (p.packageManager && !VALID_PMS.has(p.packageManager)) {
    return `Invalid packageManager "${p.packageManager}" in preset`;
  }
  if (p.cjkFriendly !== undefined && typeof p.cjkFriendly !== "boolean") {
    return `"cjkFriendly" must be a boolean in preset`;
  }
  if (p.headerRightItems !== undefined) {
    if (!Array.isArray(p.headerRightItems)) {
      return `"headerRightItems" must be an array in preset`;
    }
    for (let i = 0; i < p.headerRightItems.length; i++) {
      const item = p.headerRightItems[i] as unknown;
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        return `headerRightItems[${i}] must be an object`;
      }
      const t = (item as { type?: unknown }).type;
      if (t === "link" || t === "html") {
        return `headerRightItems[${i}] type "${t}" is not supported in presets (v1) — edit settings.ts after scaffold`;
      }
      if (t === "component") {
        const component = (item as { component?: unknown }).component;
        if (typeof component !== "string") {
          return `headerRightItems[${i}].component must be a string`;
        }
        if (!VALID_HEADER_RIGHT_COMPONENTS.has(
          component as PresetHeaderRightComponentName,
        )) {
          return `headerRightItems[${i}] unknown component "${component}". Allowed: ${[
            ...VALID_HEADER_RIGHT_COMPONENTS,
          ].join(", ")}`;
        }
      } else if (t === "trigger") {
        const trigger = (item as { trigger?: unknown }).trigger;
        if (typeof trigger !== "string") {
          return `headerRightItems[${i}].trigger must be a string`;
        }
        if (!VALID_HEADER_RIGHT_TRIGGERS.has(
          trigger as PresetHeaderRightTriggerName,
        )) {
          return `headerRightItems[${i}] unknown trigger "${trigger}". Allowed: ${[
            ...VALID_HEADER_RIGHT_TRIGGERS,
          ].join(", ")}`;
        }
      } else {
        return `headerRightItems[${i}] must have type "component" or "trigger" (got ${JSON.stringify(t)})`;
      }
    }
  }
  // Cross-field validation
  if (p.colorSchemeMode === "single" && (p.lightScheme || p.darkScheme)) {
    return `lightScheme/darkScheme are only valid with colorSchemeMode "light-dark"`;
  }
  if (p.colorSchemeMode === "light-dark" && p.singleScheme) {
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
  if (json.githubUrl !== undefined) choices.githubUrl = json.githubUrl;
  if (json.cjkFriendly !== undefined) choices.cjkFriendly = json.cjkFriendly;
  if (json.headerRightItems !== undefined) {
    choices.headerRightItems = json.headerRightItems;
  }

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
