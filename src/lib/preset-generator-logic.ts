// Single source of truth: packages/create-zudo-doc/src/constants.ts.
// These five lists are mirrored here (not runtime-imported) because this file
// is bundled by zfb into a client island, and the host cannot reach into the
// generator package's source across the e2e-fixture symlink boundary (the
// package is not a host dependency). Parity with constants.ts is enforced by
// src/__tests__/preset-generator-lists-sync.test.ts — editing either side
// without the other fails that test. This matches the FEATURES drift pattern.

export interface SupportedLang {
  value: string;
  label: string;
}

export const SINGLE_SCHEMES = ["Default Dark", "Default Light"];

export const LIGHT_SCHEMES = ["Default Light"];

export interface ThemePackOption {
  slug: string;
  label: string;
  hint: string;
}

/** Mirrors THEME_PACKS from packages/create-zudo-doc/src/constants.ts (ADR
 *  #2818; full catalog synced by #2855). Order: "default" first, then the
 *  rest alphabetically by slug (matches resolveEnabledPacks). */
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
} from "@takazudo/zudo-doc/settings";

export type { HeaderRightComponentName, HeaderRightTriggerName };

/**
 * UI-internal representation of a header-right item. The preset generator UI
 * benefits from a uniform `{ kind, name }` handle while the user is reordering
 * and toggling rows, but the JSON output uses the canonical `HeaderRightItem`
 * discriminated union (`type` + `trigger | component`) from
 * `@takazudo/zudo-doc/settings`. v1 of preset support intentionally rejects
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
  { value: "i18n", label: "i18n (multi-language)", cliFlag: "i18n", default: false, docPath: "/docs/guides/i18n/" },
  { value: "search", label: "Pagefind search", cliFlag: "search", default: true, docPath: "/docs/guides/search/" },
  { value: "sidebarFilter", label: "Sidebar filter", cliFlag: "sidebar-filter", default: true, docPath: "/docs/guides/sidebar-filter/" },
  { value: "claudeResources", label: "Claude Resources", cliFlag: "claude-resources", default: false, docPath: "/docs/guides/claude-resources/" },
  { value: "claudeSkills", label: "Claude skills (user-facing)", cliFlag: "claude-skills", default: false, docPath: "/docs/guides/claude-skills/" },
  { value: "designTokenPanel", label: "Design Token Panel", cliFlag: "design-token-panel", default: false, docPath: "/docs/reference/design-token-panel/" },
  // No docPath yet — the theme-packs guide page lands with #2827; add it
  // here once that page exists.
  { value: "themePackSwitcher", label: "Theme pack switcher", cliFlag: "theme-pack-switcher", default: false },
  { value: "sidebarResizer", label: "Sidebar resizer", cliFlag: "sidebar-resizer", default: false, docPath: "/docs/guides/configuration/#sidebarresizer" },
  { value: "sidebarToggle", label: "Sidebar toggle", cliFlag: "sidebar-toggle", default: false, docPath: "/docs/guides/configuration/#sidebartoggle" },
  { value: "tocToggle", label: "TOC toggle", cliFlag: "toc-toggle", default: false, docPath: "/docs/guides/configuration/#toctoggle" },
  { value: "versioning", label: "Versioning", cliFlag: "versioning", default: false, docPath: "/docs/guides/versioning/" },
  { value: "docHistory", label: "Document history", cliFlag: "doc-history", default: false, docPath: "/docs/guides/doc-history/" },
  { value: "bodyFootUtil", label: "Body foot util area", cliFlag: "body-foot-util", default: false, docPath: "/docs/guides/body-foot-util-area/" },
  { value: "llmsTxt", label: "llms.txt", cliFlag: "llms-txt", default: false, docPath: "/docs/guides/llms-txt/" },
  { value: "skillSymlinker", label: "Skill symlinker", cliFlag: "skill-symlinker", default: false, docPath: "/docs/guides/doc-skill-symlinker/" },
  { value: "tauri", label: "Tauri desktop app", cliFlag: "tauri", default: false, docPath: "/docs/guides/tauri-modes/" },
  { value: "tauriDev", label: "Tauri dev wrapper (Mode 2)", cliFlag: "tauri-dev", default: false, docPath: "/docs/guides/tauri-modes/" },
  { value: "footerNavGroup", label: "Footer nav group", cliFlag: "footer-nav-group", default: false, docPath: "/docs/guides/footer/" },
  { value: "imageEnlarge", label: "Image enlarge", cliFlag: "image-enlarge", default: true, docPath: "/docs/markdown-features/image-enlarge/" },
  { value: "dynamicPageTransition", label: "Dynamic page transition", cliFlag: "dynamic-page-transition", default: true, docPath: "/docs/guides/dynamic-page-transitions/" },
  { value: "footerCopyright", label: "Footer copyright", cliFlag: "footer-copyright", default: true, docPath: "/docs/guides/footer/" },
  { value: "changelog", label: "Changelog", cliFlag: "changelog", default: false, docPath: "/docs/guides/changelog/" },
  { value: "tagGovernance", label: "Tag governance", cliFlag: "tag-governance", default: false, docPath: "/docs/guides/tag-governance/" },
  { value: "docTags", label: "Doc tags pages", cliFlag: "doc-tags", default: false, docPath: "/docs/guides/tags/" },
  { value: "footerTaglist", label: "Footer taglist", cliFlag: "footer-taglist", default: false, docPath: "/docs/guides/footer-taglist/" },
  { value: "noindex", label: "Avoid robots indexing", cliFlag: "noindex", default: false, docPath: "/docs/guides/avoid-robots-indexing/" },
] as const;

/** Each entry in FEATURES; docPath is optional (absent means no docs link). */
export type FeatureEntry = {
  value: string;
  label: string;
  cliFlag: string;
  default: boolean;
  docPath?: string;
};

export type ColorSchemeMode = "single" | "light-dark";

/** Mirrors MetaTagsConfig from @takazudo/zudo-doc/settings for preset-generator form state. */
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
  /** Theme pack slug (ADR #2818 Decision 7). "default" = the stock look. */
  themePack: string;
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

  // "Omit when default" — mirrors zfb-config-gen.ts's diff-from-defaults
  // emission rule (ADR #2818 Decision 7 / #2823) so the JSON preset stays
  // lossless without freezing an inert themePack: "default" into every preset.
  if (state.themePack && state.themePack !== "default") {
    base.themePack = state.themePack;
  }

  base.features = state.features;
  base.cjkFriendly = state.cjkFriendly;
  base.packageManager = state.packageManager;
  // Always emit the canonical {type, trigger|component} shape (not the internal
  // kind/name shape) — self-documents the preset for users who copy-paste.
  base.headerRightItems = state.headerRightItems.map(specToHeaderRightItem);

  // Omit metaTags entirely when every value equals the S4 scaffold defaults —
  // keeps the default JSON clean (S2 regression test asserts no metaTags key).
  const mt = state.metaTags;
  if (!mt) {
    throw new TypeError("state.metaTags is required");
  }
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

  parts.push(`--theme-pack ${state.themePack}`);

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
