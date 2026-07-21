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
// #2818, census landed by #2819, full catalog synced by the Finalize epic's
// catalog-sync sub-issue #2855). Same convention as DEFAULT_MIRROR in
// zfb-config-gen.ts: create-zudo-doc cannot import @takazudo/zudo-doc at
// generator-build time, so the CLI/prompt catalog is a local copy. Order
// mirrors the package's own default enablement order (resolveEnabledPacks):
// "default" first, then the rest alphabetically by slug.
export const THEME_PACKS: ThemePackOption[] = [
  {
    slug: "default",
    label: "Default",
    hint: "Stock zudo-doc look — no extra stylesheet loaded",
  },
  {
    slug: "academia",
    label: "Academia",
    hint: "A LaTeX paper for the web — white page, Computer-Modern-black ink, hyperref navy links, numbered theorem admonitions, booktabs tables",
  },
  {
    slug: "bauhaus",
    label: "Bauhaus",
    hint: "Primary triad as structure — gallery white, near-black ink, and red, yellow, blue doing structural work: circle, triangle, square markers, thick geometric rules",
  },
  {
    slug: "beacon",
    label: "Beacon",
    hint: "WCAG-AAA high contrast — 7:1+ ink, 3px focus rings, always-underlined links",
  },
  {
    slug: "blueprint",
    label: "Blueprint",
    hint: "Cyanotype drafting sheet — pale-cyan linework on prussian grid paper, title-block caps, dashed rules, mono-caps labels",
  },
  {
    slug: "botanica",
    label: "Botanica",
    hint: "A vintage botanical plate — herbarium cream, deep green ink, engraved double rules, Latin small-caps plate labels",
  },
  {
    slug: "broadsheet",
    label: "Broadsheet",
    hint: "Newspaper editorial — Playfair masthead, Oxford ink rules, a red drop cap",
  },
  {
    slug: "brutalist",
    label: "Brutalist",
    hint: "Raw concrete web — stark black on white, 4px slab borders, hazard-orange tape",
  },
  {
    slug: "drift",
    label: "Drift",
    hint: "Floaty slate-blue comfort dark for long reading, relaxed Plex type",
  },
  {
    slug: "eink",
    label: "E-Ink",
    hint: "E-reader grayscale — warm paper, near-black ink, shadowless hairline chrome, zero radius",
  },
  {
    slug: "fjord",
    label: "Fjord",
    hint: "Polar-night blue under a faint aurora — frost-cyan accents, icy borders",
  },
  {
    slug: "foundry",
    label: "Foundry",
    hint: "GitHub-neutral baseline — white paper, Primer-blue accents",
  },
  {
    slug: "futura-editorial",
    label: "Futura Editorial",
    hint: "Geometric Futura headings over Noto Sans body, one restrained red accent",
  },
  {
    slug: "hearth",
    label: "Hearth",
    hint: "Warm cream & brick-red fireside docs — Fraunces headings, ember-glow dark mode",
  },
  {
    slug: "hollow",
    label: "Hollow",
    hint: "Dark violet space — neon pink headings, violet links, a quiet starfield",
  },
  {
    slug: "ledger",
    label: "Ledger",
    hint: "Cream academic serif in the Tufte tradition — warm paper, oxblood links",
  },
  {
    slug: "manuscript",
    label: "Manuscript",
    hint: "A quiet Garamond book page — warm paper, soft ink, sepia rubrication",
  },
  {
    slug: "matcha",
    label: "Matcha",
    hint: "Green tea ceremony — deep matcha on warm cream, mincho headings, zen whitespace",
  },
  {
    slug: "nocturne",
    label: "Nocturne",
    hint: "Purple midnight — velvet aubergine depths, lavender links, muted gold hairlines",
  },
  {
    slug: "observatory",
    label: "Observatory",
    hint: "Night-sky atlas — star-field depth, nebula violet and comet gold over navy",
  },
  {
    slug: "onyx",
    label: "Onyx",
    hint: "Luxury noir — jet black, champagne serif headings, a single gold hairline accent",
  },
  {
    slug: "phosphor",
    label: "Phosphor",
    hint: "Green CRT terminal — phosphor glow, scanlines, inverse-video nav",
  },
  {
    slug: "riso",
    label: "Riso",
    hint: "Risograph duotone print — warm paper, two inks (riso blue + fluorescent coral), misregistered offset shadows, soft linear paper grain",
  },
  {
    slug: "sakura",
    label: "Sakura",
    hint: "Cherry-blossom pastels — blush-white paper, plum ink, and rose accents on petal-soft corners",
  },
  {
    slug: "scandi",
    label: "Scandi",
    hint: "Hygge minimalism — oat linen, sage & clay, pill nav actives and 8px corners",
  },
  {
    slug: "solar",
    label: "Solar",
    hint: "Solarized precision — low-eyestrain paper tones, blue/cyan/orange accents",
  },
  {
    slug: "sumi",
    label: "Sumi",
    hint: "Sumi-e ink on washi — bold mincho brush headings, one vermillion hanko seal accent",
  },
  {
    slug: "swissgrid",
    label: "Swissgrid",
    hint: "International Typographic Style — grid discipline, one hot Swiss-red accent",
  },
  {
    slug: "tidepool",
    label: "Tidepool",
    hint: "Marine teal dark — deep-sea teal surfaces, seafoam text, bioluminescent aqua accents, kelp-green success, coral danger",
  },
  {
    slug: "timberline",
    label: "Timberline",
    hint: "Forest cabin after dark — pine & umber planks, cream prose, and matte lantern-amber accents",
  },
  {
    slug: "washi",
    label: "Washi",
    hint: "Warm washi paper, sumi ink, and ai-iro indigo seals for calm documentation",
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
