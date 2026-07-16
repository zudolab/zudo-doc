export interface LightDarkPairing {
  light: string;
  dark: string;
  label: string;
}

export const LIGHT_DARK_PAIRINGS: LightDarkPairing[] = [
  { light: "Default Light", dark: "Default Dark", label: "Default" },
];

// All available single schemes (dark-first ordering — asserted by the host
// sync test).
export const SINGLE_SCHEMES = ["Default Dark", "Default Light"];

// Light-only subset of SINGLE_SCHEMES. Used by the preset generator to populate
// the "Light scheme" dropdown (dark schemes are derived as SINGLE_SCHEMES minus these).
export const LIGHT_SCHEMES = ["Default Light"];

export interface SupportedLang {
  value: string;
  label: string;
}

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

export interface ThemePackOption {
  slug: string;
  label: string;
  hint: string;
}

// Hand-kept mirror of the bundled theme-pack registry
// (packages/zudo-doc/src/theme-packs/<slug>/meta.json — theme pack ADR
// #2818, census landed by #2819). Same convention as DEFAULT_MIRROR in
// zfb-config-gen.ts: create-zudo-doc cannot import @takazudo/zudo-doc at
// generator-build time, so the CLI/prompt catalog is a local copy. The later
// Finalize epic syncs the full ~20-pack list — this only needs the slugs the
// generator can offer today.
export const THEME_PACKS: ThemePackOption[] = [
  {
    slug: "default",
    label: "Default",
    hint: "Stock zudo-doc look — no extra stylesheet loaded",
  },
  {
    slug: "foundry",
    label: "Foundry",
    hint: "GitHub-neutral baseline — white paper, Primer-blue accents",
  },
];

export interface Feature {
  value: string;
  label: string;
  hint: string;
  default: boolean;
  cliFlag: string;
}

export const FEATURES: Feature[] = [
  {
    value: "i18n",
    label: "i18n (multi-language)",
    hint: "Add a secondary language",
    default: false,
    cliFlag: "i18n",
  },
  {
    value: "search",
    label: "Pagefind search",
    hint: "Full-text search",
    default: true,
    cliFlag: "search",
  },
  {
    value: "sidebarFilter",
    label: "Sidebar filter",
    hint: "Real-time sidebar filtering",
    default: true,
    cliFlag: "sidebar-filter",
  },
  {
    value: "claudeResources",
    label: "Claude Resources",
    hint: "Auto-generate Claude Code docs",
    default: false,
    cliFlag: "claude-resources",
  },
  {
    value: "claudeSkills",
    label: "Claude skills (user-facing)",
    hint: "Ship zudo-doc-* Claude Code skills (design-system, translate, version-bump)",
    default: false,
    cliFlag: "claude-skills",
  },
  {
    value: "designTokenPanel",
    label: "Design Token Panel",
    hint: "Interactive tabbed panel for tweaking spacing, font, size, and color tokens",
    default: false,
    cliFlag: "design-token-panel",
  },
  {
    value: "themePackSwitcher",
    label: "Theme pack switcher",
    hint: "Bottom-right flyout to switch between installed theme packs",
    default: false,
    cliFlag: "theme-pack-switcher",
  },
  {
    value: "sidebarResizer",
    label: "Sidebar resizer",
    hint: "Draggable sidebar width",
    default: false,
    cliFlag: "sidebar-resizer",
  },
  {
    value: "sidebarToggle",
    label: "Sidebar toggle",
    hint: "Show/hide desktop sidebar",
    default: false,
    cliFlag: "sidebar-toggle",
  },
  {
    value: "versioning",
    label: "Versioning",
    hint: "Multi-version documentation support",
    default: false,
    cliFlag: "versioning",
  },
  {
    value: "docHistory",
    label: "Document history",
    hint: "Show document edit history",
    default: false,
    cliFlag: "doc-history",
  },
  {
    value: "bodyFootUtil",
    label: "Body foot util area",
    hint: "Right-aligned strip below each doc: doc history trigger + View source on GitHub link",
    default: false,
    cliFlag: "body-foot-util",
  },
  {
    value: "llmsTxt",
    label: "llms.txt",
    hint: "Generate llms.txt for LLM consumption",
    default: false,
    cliFlag: "llms-txt",
  },
  {
    value: "skillSymlinker",
    label: "Skill symlinker",
    hint: "Symlink documentation skills into Claude Code or Codex",
    default: false,
    cliFlag: "skill-symlinker",
  },
  {
    value: "tauri",
    label: "Tauri desktop app",
    hint: "macOS desktop wrapper with in-page search",
    default: false,
    cliFlag: "tauri",
  },
  {
    value: "tauriDev",
    label: "Tauri dev wrapper (Mode 2)",
    hint: "Configurable desktop dev wrapper for any project",
    default: false,
    cliFlag: "tauri-dev",
  },
  {
    value: "footerNavGroup",
    label: "Footer nav group",
    hint: "Navigation links in the footer",
    default: false,
    cliFlag: "footer-nav-group",
  },
  {
    value: "imageEnlarge",
    label: "Image enlarge",
    hint: "Click-to-enlarge for oversized markdown images",
    default: true,
    cliFlag: "image-enlarge",
  },
  {
    value: "dynamicPageTransition",
    label: "Dynamic page transition",
    hint: "SPA-style page transition with history handling",
    default: true,
    cliFlag: "dynamic-page-transition",
  },
  {
    value: "footerCopyright",
    label: "Footer copyright",
    hint: "Copyright notice in the footer",
    default: true,
    cliFlag: "footer-copyright",
  },
  {
    value: "changelog",
    label: "Changelog",
    hint: "Changelog page",
    default: false,
    cliFlag: "changelog",
  },
  {
    value: "tagGovernance",
    label: "Tag governance",
    hint: "Vocabulary-aware tag audit + suggest scripts",
    default: false,
    cliFlag: "tag-governance",
  },
  {
    value: "docTags",
    label: "Doc tags pages",
    hint: "Per-tag and tag-index browsing routes (docs/tags/...)",
    default: false,
    cliFlag: "doc-tags",
  },
  {
    value: "footerTaglist",
    label: "Footer taglist",
    hint: "Grouped tag index in the footer (requires tagGovernance)",
    default: false,
    cliFlag: "footer-taglist",
  },
  {
    value: "noindex",
    label: "Avoid robots indexing",
    hint: "Keep search engines out (noindex meta + robots.txt)",
    default: false,
    cliFlag: "noindex",
  },
];

// Display labels for header-right items. Keys are canonical component/trigger
// names from HeaderRightComponentName / HeaderRightTriggerName
// (src/config/settings-types.ts in the host); they are deliberately not imported
// here so constants.ts stays pure data with no cross-package dependencies.
export const HEADER_RIGHT_LABELS: Record<string, string> = {
  "version-switcher": "Version switcher",
  "design-token-panel": "Design token panel (trigger)",
  "ai-chat": "AI chat (trigger)",
  "github-link": "GitHub link",
  "theme-toggle": "Theme toggle",
  search: "Search",
  "language-switcher": "Language switcher",
};
