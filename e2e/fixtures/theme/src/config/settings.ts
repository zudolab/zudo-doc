import type {
  HeaderNavItem,
  HeaderRightItem,
  ChangelogConfig,
  ColorModeConfig,
  LocaleConfig,
  MetaTagsConfig,
} from "@takazudo/zudo-doc/settings";
import type { ColorScheme } from "@takazudo/zudo-doc/color-scheme-utils";
import { defaultColorSchemes } from "@takazudo/zudo-doc/color-schemes-defaults";

const defaultDark = defaultColorSchemes["Default Dark"]!;
const syntaxVariation = {
  ramps: defaultDark.ramps,
  map: {
    bg: defaultDark.map.bg,
    fg: defaultDark.map.fg,
    selectionBg: defaultDark.map.selectionBg,
    selectionFg: defaultDark.map.selectionFg,
    semantic: {
      ...defaultDark.map.semantic,
      accent: { state: "info" },
    },
    syntax: {
      ...defaultDark.map.syntax,
      syntaxKeyword: { state: "info" },
    },
  },
} satisfies ColorScheme;

export const settings = {
  colorScheme: "Default Dark",
  colorMode: {
    defaultMode: "light",
    lightScheme: "Default Light",
    darkScheme: "Syntax Variation",
    respectPrefersColorScheme: true,
  } satisfies ColorModeConfig as ColorModeConfig | false,
  colorSchemes: {
    ...defaultColorSchemes,
    "Syntax Variation": syntaxVariation,
  },
  siteName: "Theme Test",
  siteDescription: "Test fixture for theme toggle E2E tests" as string,
  base: "/",
  minifyHtml: true as boolean,
  docsDir: "src/content/docs",
  defaultLocale: "en" as const,
  locales: {} satisfies Record<string, LocaleConfig>,
  mermaid: false,
  noindex: true as boolean,
  editUrl: false as string | false,
  siteUrl: "" as string,
  metaTags: {
    description: true,
    keywords: false,
    ogImage: false,
    ogSiteName: true,
    twitterCard: false,
  } satisfies MetaTagsConfig as MetaTagsConfig,
  sitemap: false,
  docMetainfo: false,
  docTags: false,
  changelogs: false as ChangelogConfig[] | false,
  math: false,
  designTokenPanel: true as boolean,
  // Enabled so e2e/theme-pack-switcher*.spec.ts and
  // e2e/theme-pack-zdtp-interplay.spec.ts have the flyout to drive
  // (epic Theme Core #2812, #2826). themePack stays explicit at its own
  // default for fixture/showcase drift-diff clarity.
  themePack: "default" as string,
  themePackSwitcher: true as boolean,
  findInPage: false as boolean,
  dynamicPageTransition: true as boolean,
  docHistory: false,
  claudeResources: false as { claudeDir: string; projectRoot?: string; scanRoot?: string } | false,
  defaultLocaleOnlyPrefixes: [] as string[],
  tocMinDepth: 2 as number,
  tocMaxDepth: 4 as number,
  headerNav: [
    {
      label: "Getting Started",
      path: "/docs/getting-started",
      categoryMatch: "getting-started",
    },
  ] satisfies HeaderNavItem[] as HeaderNavItem[],
  headerRightItems: [
    { type: "trigger", trigger: "design-token-panel" },
    { type: "component", component: "theme-toggle" },
  ] satisfies HeaderRightItem[] as HeaderRightItem[],
  packageOwnedRoutes: true,
};
