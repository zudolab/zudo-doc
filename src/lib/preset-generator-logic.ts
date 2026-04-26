// Keep in sync with packages/create-zudo-doc/src/constants.ts

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
  { value: "footerNavGroup", label: "Footer nav group", cliFlag: "footer-nav-group", default: false },
  { value: "imageEnlarge", label: "Image enlarge", cliFlag: "image-enlarge", default: true },
  { value: "footerCopyright", label: "Footer copyright", cliFlag: "footer-copyright", default: false },
  { value: "changelog", label: "Changelog", cliFlag: "changelog", default: false },
  { value: "tagGovernance", label: "Tag governance", cliFlag: "tag-governance", default: true },
  { value: "footerTaglist", label: "Footer taglist", cliFlag: "footer-taglist", default: false },
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
  headerRightItems: HeaderRightItemSpec[];
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

  // Trailing comment: headerRightItems is an array of discriminated unions
  // that does not fit the --flag CLI model. Surfaced as a shell comment line
  // so users know to use a JSON preset (--preset) for header-right ordering.
  const trailingNote =
    "\n# headerRightItems: use a JSON preset (--preset) — array configs are not expressible as CLI flags";

  return parts.join(" ") + trailingNote;
}
