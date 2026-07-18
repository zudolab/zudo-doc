import type {
  HeaderNavItem,
  HeaderRightItem,
  ChangelogConfig,
  ColorModeConfig,
  LocaleConfig,
  MetaTagsConfig,
} from "@takazudo/zudo-doc/settings";

export const settings = {
  colorScheme: "Default Dark",
  colorMode: false as ColorModeConfig | false,
  siteName: "i18n Test",
  siteDescription: "Test fixture for i18n E2E tests" as string,
  base: "/",
  minifyHtml: true as boolean,
  docsDir: "src/content/docs",
  defaultLocale: "en" as const,
  locales: {
    ja: { label: "JA", dir: "src/content/docs-ja" },
    de: { label: "DE", dir: "src/content/docs-de" },
  } satisfies Record<string, LocaleConfig>,
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
  docHistory: false,
  docHistoryExclude: [],
  // Mirrors the showcase default — themePackSwitcher stays off here
  // (allowlisted, epic Theme Core #2812, #2826).
  themePack: "default" as string,
  findInPage: false as boolean,
  dynamicPageTransition: true as boolean,
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
    { label: "Guides", path: "/docs/guides", categoryMatch: "guides" },
  ] satisfies HeaderNavItem[] as HeaderNavItem[],
  // Render the desktop header language switcher so the #2551 SPA-nav re-wire
  // regression (i18n-vt-chrome-persist.spec.ts) can exercise it.
  headerRightItems: [
    { type: "component", component: "language-switcher" },
  ] satisfies HeaderRightItem[] as HeaderRightItem[],
  packageOwnedRoutes: true,
};
