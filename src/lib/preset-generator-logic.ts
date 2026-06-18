// Single source of truth: packages/create-zudo-doc/src/constants.ts.
// These four lists are mirrored here (not runtime-imported) because this file
// is bundled by zfb into a client island, and the host cannot reach into the
// generator package's source across the e2e-fixture symlink boundary (the
// package is not a host dependency). Parity with constants.ts is enforced by
// src/__tests__/preset-generator-lists-sync.test.ts — editing either side
// without the other fails that test. This matches the FEATURES drift pattern.

export interface SupportedLang {
  value: string;
  label: string;
}

export const SINGLE_SCHEMES = [
  "Default Dark",
  "Dracula",
  "Catppuccin Mocha",
  "GitHub Dark",
  "Nord",
  "TokyoNight",
  "Gruvbox Dark",
  "Atom One Dark",
  "Rose Pine",
  "Solarized Dark",
  "Material Ocean",
  "Monokai Pro",
  "Everforest Dark",
  "Kanagawa Wave",
  "Night Owl",
  "Ayu Dark",
  "VS Code Dark+",
  "Doom One",
  "Challenger Deep",
  "Catppuccin Frappe",
  "Catppuccin Macchiato",
  "Gruvbox Dark Hard",
  "Rose Pine Moon",
  "GitHub Dark Dimmed",
  "Ayu Mirage",
  "Material Darker",
  "Material Dark",
  "Monokai Remastered",
  "Monokai Vivid",
  "Monokai Soda",
  "Solarized Dark Higher Contrast",
  "Gruvbox Material Dark",
  "Kanagawa Dragon",
  // Light schemes
  "Default Light",
  "GitHub Light",
  "Catppuccin Latte",
  "Solarized Light",
  "Rose Pine Dawn",
  "Atom One Light",
  "Everforest Light",
  "Gruvbox Light",
  "Ayu Light",
];

export const LIGHT_SCHEMES = [
  "Default Light",
  "GitHub Light",
  "Catppuccin Latte",
  "Solarized Light",
  "Rose Pine Dawn",
  "Atom One Light",
  "Everforest Light",
  "Gruvbox Light",
  "Ayu Light",
];

export const SUPPORTED_LANGS: SupportedLang[] = [
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "zh-cn", label: "Chinese (Simplified)" },
  { value: "zh-tw", label: "Chinese (Traditional)" },
  { value: "ko", label: "Korean" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
];

export const HEADER_RIGHT_LABELS: Record<string, string> = {
  "version-switcher": "Version switcher",
  "design-token-panel": "Design token panel (trigger)",
  "ai-chat": "AI chat (trigger)",
  "github-link": "GitHub link",
  "theme-toggle": "Theme toggle",
  search: "Search",
  "language-switcher": "Language switcher",
};

import type {
  HeaderRightComponentName,
  HeaderRightTriggerName,
  HeaderRightItem,
} from "../config/settings-types";

export type { HeaderRightComponentName, HeaderRightTriggerName };

/**
 * UI-internal representation of a header-right item. The preset generator UI
 * benefits from a uniform `{ kind, name }` handle while the user is reordering
 * and toggling rows, but the JSON output uses the canonical `HeaderRightItem`
 * discriminated union (`type` + `trigger | component`) from
 * `src/config/settings-types.ts`. v1 of preset support intentionally rejects
 * `link`/`html` items (they need free-text fields).
 */
export type HeaderRightItemSpec =
  | { kind: "trigger"; name: HeaderRightTriggerName }
  | { kind: "component"; name: HeaderRightComponentName };

/**
 * Canonical default order, mirrored from `src/config/settings.ts`. Editing
 * either side without the other will desync the preset generator from the
 * project's own scaffold.
 */
export const DEFAULT_HEADER_RIGHT_ITEMS: readonly HeaderRightItemSpec[] = [
  { kind: "component", name: "version-switcher" },
  { kind: "trigger", name: "design-token-panel" },
  { kind: "trigger", name: "ai-chat" },
  { kind: "component", name: "github-link" },
  { kind: "component", name: "theme-toggle" },
  { kind: "component", name: "search" },
  { kind: "component", name: "language-switcher" },
];

export const INITIAL_HEADER_RIGHT_ITEMS: readonly HeaderRightItemSpec[] = [
  { kind: "component", name: "github-link" },
  { kind: "component", name: "theme-toggle" },
  { kind: "component", name: "search" },
  { kind: "component", name: "language-switcher" },
];

/**
 * Map a UI-internal {@link HeaderRightItemSpec} to the canonical
 * `HeaderRightItem` shape consumed by `settings.ts`.
 */
export function specToHeaderRightItem(spec: HeaderRightItemSpec): HeaderRightItem {
  if (spec.kind === "trigger") {
    return { type: "trigger", trigger: spec.name };
  }
  return { type: "component", component: spec.name };
}

export const FEATURES = [
  { value: "i18n", label: "i18n (multi-language)", cliFlag: "i18n", default: false },
  { value: "search", label: "Pagefind search", cliFlag: "search", default: true },
  { value: "sidebarFilter", label: "Sidebar filter", cliFlag: "sidebar-filter", default: true },
  { value: "claudeResources", label: "Claude Resources", cliFlag: "claude-resources", default: false },
  { value: "claudeSkills", label: "Claude skills (user-facing)", cliFlag: "claude-skills", default: false },
  { value: "designTokenPanel", label: "Design Token Panel", cliFlag: "design-token-panel", default: false },
  { value: "sidebarResizer", label: "Sidebar resizer", cliFlag: "sidebar-resizer", default: false },
  { value: "sidebarToggle", label: "Sidebar toggle", cliFlag: "sidebar-toggle", default: false },
  { value: "versioning", label: "Versioning", cliFlag: "versioning", default: false },
  { value: "docHistory", label: "Document history", cliFlag: "doc-history", default: false },
  { value: "bodyFootUtil", label: "Body foot util area", cliFlag: "body-foot-util", default: false },
  { value: "llmsTxt", label: "llms.txt", cliFlag: "llms-txt", default: false },
  { value: "skillSymlinker", label: "Skill symlinker", cliFlag: "skill-symlinker", default: false },
  { value: "tauri", label: "Tauri desktop app", cliFlag: "tauri", default: false },
  { value: "tauriDev", label: "Tauri dev wrapper (Mode 2)", cliFlag: "tauri-dev", default: false },
  { value: "footerNavGroup", label: "Footer nav group", cliFlag: "footer-nav-group", default: false },
  { value: "imageEnlarge", label: "Image enlarge", cliFlag: "image-enlarge", default: true },
  { value: "footerCopyright", label: "Footer copyright", cliFlag: "footer-copyright", default: false },
  { value: "changelog", label: "Changelog", cliFlag: "changelog", default: false },
  { value: "tagGovernance", label: "Tag governance", cliFlag: "tag-governance", default: false },
  { value: "docTags", label: "Doc tags pages", cliFlag: "doc-tags", default: false },
  { value: "footerTaglist", label: "Footer taglist", cliFlag: "footer-taglist", default: false },
  { value: "noindex", label: "Avoid robots indexing", cliFlag: "noindex", default: false },
] as const;

export type ColorSchemeMode = "single" | "light-dark";

/** Mirrors MetaTagsConfig from src/config/settings-types.ts for preset-generator form state. */
export interface MetaTagsFormState {
  description: boolean;
  keywordsEnabled: boolean;
  keywords: string;
  ogImageEnabled: boolean;
  ogImage: string;
  ogSiteName: boolean;
  twitterCardEnabled: boolean;
  twitterCard: "summary" | "summary_large_image";
  twitterSite: string;
  twitterCreator: string;
}

/** Defaults that mirror S4 scaffold defaults exactly. */
export const DEFAULT_META_TAGS: MetaTagsFormState = {
  description: true,
  keywordsEnabled: false,
  keywords: "",
  ogImageEnabled: false,
  ogImage: "/img/ogp.png",
  ogSiteName: true,
  twitterCardEnabled: false,
  twitterCard: "summary",
  twitterSite: "",
  twitterCreator: "",
};

export interface FormState {
  projectName: string;
  defaultLang: string;
  colorSchemeMode: ColorSchemeMode;
  singleScheme: string;
  lightScheme: string;
  darkScheme: string;
  defaultMode: "light" | "dark";
  respectPrefersColorScheme: boolean;
  features: string[];
  cjkFriendly: boolean;
  packageManager: string;
  headerRightItems: HeaderRightItemSpec[];
  metaTags: MetaTagsFormState;
}

export function buildJson(state: FormState): Record<string, unknown> {
  const base: Record<string, unknown> = {
    projectName: state.projectName || "my-docs",
    defaultLang: state.defaultLang,
    colorSchemeMode: state.colorSchemeMode,
  };

  if (state.colorSchemeMode === "single") {
    base.singleScheme = state.singleScheme;
  } else {
    base.lightScheme = state.lightScheme;
    base.darkScheme = state.darkScheme;
    base.defaultMode = state.defaultMode;
    base.respectPrefersColorScheme = state.respectPrefersColorScheme;
  }

  base.features = state.features;
  base.cjkFriendly = state.cjkFriendly;
  base.packageManager = state.packageManager;
  // Always emit the canonical {type, trigger|component} shape (not the internal
  // kind/name shape) — self-documents the preset for users who copy-paste.
  base.headerRightItems = state.headerRightItems.map(specToHeaderRightItem);

  // Omit metaTags entirely when every value equals the S4 scaffold defaults —
  // keeps the default JSON clean (S2 regression test asserts no metaTags key).
  // state.metaTags may be absent in tests using makeState() without it.
  const mt = state.metaTags ?? DEFAULT_META_TAGS;
  const d = DEFAULT_META_TAGS;
  const isDefault =
    mt.description === d.description &&
    mt.keywordsEnabled === d.keywordsEnabled &&
    mt.keywords === d.keywords &&
    mt.ogImageEnabled === d.ogImageEnabled &&
    mt.ogImage === d.ogImage &&
    mt.ogSiteName === d.ogSiteName &&
    mt.twitterCardEnabled === d.twitterCardEnabled &&
    mt.twitterCard === d.twitterCard &&
    mt.twitterSite === d.twitterSite &&
    mt.twitterCreator === d.twitterCreator;

  if (!isDefault) {
    const metaTagsJson: Record<string, unknown> = {
      description: mt.description,
      keywords: mt.keywordsEnabled ? mt.keywords || "" : false,
      ogImage: mt.ogImageEnabled ? mt.ogImage || "/img/ogp.png" : false,
      ogSiteName: mt.ogSiteName,
      twitterCard: mt.twitterCardEnabled ? mt.twitterCard : false,
    };
    if (mt.twitterCardEnabled && mt.twitterSite) {
      metaTagsJson.twitterSite = mt.twitterSite;
    }
    if (mt.twitterCardEnabled && mt.twitterCreator) {
      metaTagsJson.twitterCreator = mt.twitterCreator;
    }
    base.metaTags = metaTagsJson;
  }

  return base;
}

export function buildCliCommand(state: FormState): string {
  const pm = state.packageManager;
  const name = state.projectName || "my-docs";
  const quotedName = /\s/.test(name) ? `"${name}"` : name;
  const parts = [`${pm} create zudo-doc ${quotedName}`];

  parts.push(`--lang ${state.defaultLang}`);
  parts.push(`--color-scheme-mode ${state.colorSchemeMode}`);

  if (state.colorSchemeMode === "single") {
    parts.push(`--scheme "${state.singleScheme}"`);
  } else {
    parts.push(`--light-scheme "${state.lightScheme}"`);
    parts.push(`--dark-scheme "${state.darkScheme}"`);
    parts.push(`--default-mode ${state.defaultMode}`);
    if (state.respectPrefersColorScheme) {
      parts.push("--respect-system-preference");
    } else {
      parts.push("--no-respect-system-preference");
    }
  }

  for (const feat of FEATURES) {
    const enabled = state.features.includes(feat.value);
    parts.push(enabled ? `--${feat.cliFlag}` : `--no-${feat.cliFlag}`);
  }

  parts.push(`--pm ${pm}`);
  parts.push("--yes");

  // Trailing comments: array/object configs that don't fit the --flag CLI model.
  // Surfaced as shell comment lines so users know to use a JSON preset (--preset).
  const trailingNote =
    "\n# headerRightItems: use a JSON preset (--preset) — array configs are not expressible as CLI flags" +
    "\n# metaTags: use a JSON preset (--preset) — object config is not expressible as CLI flags";

  return parts.join(" ") + trailingNote;
}
