export interface LightDarkPairing {
  light: string;
  dark: string;
  label: string;
}

export const LIGHT_DARK_PAIRINGS: LightDarkPairing[] = [
  { light: "Default Light", dark: "Default Dark", label: "Default" },
  { light: "GitHub Light", dark: "GitHub Dark", label: "GitHub" },
  { light: "Catppuccin Latte", dark: "Catppuccin Mocha", label: "Catppuccin" },
  { light: "Solarized Light", dark: "Solarized Dark", label: "Solarized" },
  { light: "Rose Pine Dawn", dark: "Rose Pine", label: "Rosé Pine" },
  { light: "Atom One Light", dark: "Atom One Dark", label: "Atom One" },
  { light: "Everforest Light", dark: "Everforest Dark", label: "Everforest" },
  { light: "Gruvbox Light", dark: "Gruvbox Dark", label: "Gruvbox" },
  { light: "Ayu Light", dark: "Ayu Dark", label: "Ayu" },
];

// All available single schemes (dark ones most popular first)
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
    value: "colorTweakPanel",
    label: "Color tweak panel",
    hint: "Live color editor for designing schemes",
    default: false,
    cliFlag: "color-tweak-panel",
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
    value: "llmsTxt",
    label: "llms.txt",
    hint: "Generate llms.txt for LLM consumption",
    default: false,
    cliFlag: "llms-txt",
  },
  {
    value: "skillSymlinker",
    label: "Skill symlinker",
    hint: "Symlink documentation skills",
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
    value: "footerCopyright",
    label: "Footer copyright",
    hint: "Copyright notice in the footer",
    default: false,
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
    default: true,
    cliFlag: "tag-governance",
  },
  {
    value: "footerTaglist",
    label: "Footer taglist",
    hint: "Grouped tag index in the footer (requires tagGovernance)",
    default: false,
    cliFlag: "footer-taglist",
  },
];
