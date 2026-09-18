import type {
  HeaderNavItem,
  HeaderRightItem,
  ChangelogConfig,
  ColorModeConfig,
  HtmlPreviewConfig,
  LocaleConfig,
  FrontmatterPreviewConfig,
  BodyFootUtilAreaConfig,
  MetaTagsConfig,
  DateFormatSetting,
} from "@takazudo/zudo-doc/settings";

export const settings = {
  // Keep fixture homes on the no-introduction package default.
  home: { wide: false, introMarkdown: "", sitemapHeading: "" },
  colorScheme: "Default Dark",
  colorMode: {
    defaultMode: "dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    respectPrefersColorScheme: true,
  } satisfies ColorModeConfig as ColorModeConfig | false,
  // Long enough to genuinely overflow the mobile header at 390px/24px before
  // truncation, while still fitting at the default 16px preference
  // (zudolab/zudo-doc#4287/#4289) — see
  // smoke-header-site-name-truncation.spec.ts, which measures both. Every
  // "Smoke Test" literal in smoke-llms-txt.spec.ts and smoke-seo.spec.ts
  // must stay in lockstep. Kept short of "Smoke Test Documentation": that
  // longer string also overflowed the UNRELATED home-hero heading at
  // 390px/24px (zudolab/zudo-doc#4297, out of scope for this epic).
  siteName: "Smoke Test Guide",
  siteDescription: "Test fixture for smoke E2E tests" as string,
  logo: "auto" as string | false,
  base: "/",
  minifyHtml: true as boolean,
  docsDir: "src/content/docs",
  entryDocSlug: "getting-started",
  // Mirrors the showcase default — see /docs/guides/configuration.
  dateFormat: "locale" as DateFormatSetting,
  defaultLocale: "en" as const,
  locales: {} satisfies Record<string, LocaleConfig>,
  mermaid: true,
  transclude: false,
  noindex: true as boolean,
  editUrl: "https://github.com/example/repo/edit/main" as string | false,
  githubUrl: "https://github.com/example/repo" as string | false,
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
  llmsTxt: true,
  changelogs: false as ChangelogConfig[] | false,
  math: true,
  aiAssistant: true as boolean,
  aiChatDemoMode: true as boolean,
  aiChatAllowedOrigins: [] as string[],
  aiChatGlobalDailyLimit: false as number | false,
  designTokenPanel: true as boolean,
  // Mirrors the showcase default — themePackSwitcher stays off here
  // (allowlisted, epic Theme Core #2812, #2826).
  themePack: "default" as string,
  imageEnlarge: true as boolean,
  findInPage: false as boolean,
  dynamicPageTransition: true as boolean,
  frontmatterPreview: {} satisfies FrontmatterPreviewConfig as FrontmatterPreviewConfig | false,
  docHistory: true,
  docHistoryExclude: [],
  assetViewer: true,
  assetViewerDir: "assets",
  assetViewerRoutePrefix: "files",
  assetViewerExclude: [],
  assetViewerIndex: true,
  assetViewerIndexing: false,
  bodyFootUtilArea: {
    docHistory: true,
    viewSourceLink: true,
  } satisfies BodyFootUtilAreaConfig as BodyFootUtilAreaConfig | false,
  htmlPreview: {
    css: `.global-test { border: 3px solid rgb(255, 0, 0); }`,
  } as HtmlPreviewConfig | undefined,
  claudeResources: false as { claudeDir: string; projectRoot?: string; scanRoot?: string } | false,
  codexResources: false as { codexDir: string; projectRoot?: string; scanRoot?: string } | false,
  defaultLocaleOnlyPrefixes: [] as string[],
  tocMinDepth: 2 as number,
  tocMaxDepth: 4 as number,
  // Exercises the home-page secondary category row (epic #4235, #4244): moves
  // the "changelog" top-level category out of the SiteTreeNav grid and into the
  // `[data-home-secondary-nav]` row — see smoke-home-secondary-nav.spec.ts.
  // Not "guides": smoke-home-sitemap-font-pref-overflow.spec.ts needs its
  // long-title page to stay in the grid.
  siteTreeNavSecondary: ["changelog"] as string[],
  headerNav: [
    {
      label: "Getting Started",
      path: "/docs/getting-started",
      categoryMatch: "getting-started",
    },
    {
      label: "Learn",
      path: "/docs/guides",
      categoryMatch: "guides",
      children: [
        { label: "Guides", path: "/docs/guides", categoryMatch: "guides" },
      ],
    },
    {
      label: "Changelog",
      path: "/docs/changelog",
      categoryMatch: "changelog",
      children: [
        { label: "pkg-a", path: "/docs/changelog/pkg-a" },
        { label: "pkg-b", path: "/docs/changelog/pkg-b" },
      ],
    },
  ] satisfies HeaderNavItem[] as HeaderNavItem[],
  headerRightItems: [
    { type: "trigger", trigger: "design-token-panel" },
    { type: "trigger", trigger: "ai-chat" },
    { type: "component", component: "github-link" },
    { type: "component", component: "search" },
    { type: "component", component: "theme-toggle" },
  ] satisfies HeaderRightItem[] as HeaderRightItem[],
  packageOwnedRoutes: true,
};
