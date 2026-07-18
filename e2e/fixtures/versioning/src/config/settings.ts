import type {
  HeaderNavItem,
  HeaderRightItem,
  ChangelogConfig,
  ColorModeConfig,
  LocaleConfig,
  VersionConfig,
  MetaTagsConfig,
} from "@takazudo/zudo-doc/settings";

export const settings = {
  colorScheme: "Default Dark",
  colorMode: false as ColorModeConfig | false,
  siteName: "Versioning Test",
  siteDescription: "Test fixture for versioning E2E tests" as string,
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
  llmsTxt: false,
  changelogs: false as ChangelogConfig[] | false,
  math: false,
  docHistory: false,
  docHistoryExclude: [],
  // Mirrors the showcase default — themePackSwitcher stays off here
  // (allowlisted, epic Theme Core #2812, #2826).
  themePack: "default" as string,
  findInPage: false as boolean,
  dynamicPageTransition: true as boolean,
  versions: [
    {
      slug: "1.0",
      label: "1.0.0",
      docsDir: "src/content/docs-v1",
      banner: "unmaintained",
    },
  ] satisfies VersionConfig[] as VersionConfig[] | false,
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
    { type: "component", component: "version-switcher" },
  ] satisfies HeaderRightItem[] as HeaderRightItem[],
  packageOwnedRoutes: true,
};
