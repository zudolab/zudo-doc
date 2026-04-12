// Keep in sync with packages/create-zudo-doc/src/constants.ts

export const FEATURES = [
  { value: "i18n", label: "i18n (multi-language)", cliFlag: "i18n", default: false },
  { value: "search", label: "Pagefind search", cliFlag: "search", default: true },
  { value: "sidebarFilter", label: "Sidebar filter", cliFlag: "sidebar-filter", default: true },
  { value: "claudeResources", label: "Claude Resources", cliFlag: "claude-resources", default: false },
  { value: "claudeSkills", label: "Claude skills (user-facing)", cliFlag: "claude-skills", default: false },
  { value: "colorTweakPanel", label: "Color tweak panel", cliFlag: "color-tweak-panel", default: false },
  { value: "sidebarResizer", label: "Sidebar resizer", cliFlag: "sidebar-resizer", default: false },
  { value: "sidebarToggle", label: "Sidebar toggle", cliFlag: "sidebar-toggle", default: false },
  { value: "versioning", label: "Versioning", cliFlag: "versioning", default: false },
  { value: "docHistory", label: "Document history", cliFlag: "doc-history", default: false },
  { value: "llmsTxt", label: "llms.txt", cliFlag: "llms-txt", default: false },
  { value: "skillSymlinker", label: "Skill symlinker", cliFlag: "skill-symlinker", default: false },
  { value: "tauri", label: "Tauri desktop app", cliFlag: "tauri", default: false },
  { value: "footerNavGroup", label: "Footer nav group", cliFlag: "footer-nav-group", default: false },
  { value: "footerCopyright", label: "Footer copyright", cliFlag: "footer-copyright", default: false },
  { value: "changelog", label: "Changelog", cliFlag: "changelog", default: false },
] as const;

export type ColorSchemeMode = "single" | "light-dark";

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

  parts.push(state.cjkFriendly ? "--cjk-friendly" : "--no-cjk-friendly");

  parts.push(`--pm ${pm}`);
  parts.push("--yes");

  return parts.join(" ");
}
