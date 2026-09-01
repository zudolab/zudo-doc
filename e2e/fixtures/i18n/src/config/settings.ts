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
  logo: "auto" as string | false,
  base: "/",
  minifyHtml: true as boolean,
  docsDir: "src/content/docs",
  entryDocSlug: "getting-started",
  defaultLocale: "en" as const,
  locales: {
    ja: { label: "JA", dir: "src/content/docs-ja" },
    de: { label: "DE", dir: "src/content/docs-de" },
  } satisfies Record<string, LocaleConfig>,
  mermaid: false,
  transclude: false,
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
  llmsTxt: true,
  changelogs: false as ChangelogConfig[] | false,
  math: false,
  docHistory: false,
  docHistoryExclude: [],
  assetViewer: true,
  assetViewerDir: "assets",
  assetViewerRoutePrefix: "files",
  assetViewerExclude: [],
  assetViewerIndex: true,
  assetViewerIndexing: false,
  // Mirrors the showcase default — themePackSwitcher stays off here
  // (allowlisted, epic Theme Core #2812, #2826).
  themePack: "default" as string,
  findInPage: false as boolean,
  dynamicPageTransition: true as boolean,
  claudeResources: {
    claudeDir: "src/content/resources/.claude",
    projectRoot: ".",
    scanRoot: "src/content/resources/.claude",
  } as { claudeDir: string; projectRoot?: string; scanRoot?: string } | false,
  codexResources: {
    codexDir: "src/content/resources/.codex",
    projectRoot: ".",
    scanRoot: "src/content/resources/.codex",
  } as { codexDir: string; projectRoot?: string; scanRoot?: string } | false,
  // Keep one concrete default-locale-only page in the fixture so the
  // language-switcher E2E can assert that the disclosure collapses to its
  // single active link for pages without translated routes.
  defaultLocaleOnlyPrefixes: ["/docs/default-only/"] as string[],
  tocMinDepth: 2 as number,
  tocMaxDepth: 4 as number,
  headerNav: [
    {
      label: "Getting Started",
      path: "/docs/getting-started",
      categoryMatch: "getting-started",
    },
    { label: "Guides", path: "/docs/guides", categoryMatch: "guides" },
    {
      label: "Claude",
      labelKey: "nav.claude",
      path: "/docs/claude",
      categoryMatch: "claude",
      versioned: false,
    },
    {
      label: "Codex",
      labelKey: "nav.codex",
      path: "/docs/codex",
      categoryMatch: "codex",
      versioned: false,
    },
  ] satisfies HeaderNavItem[] as HeaderNavItem[],
  // Render the desktop header language switcher so the #2551 SPA-nav re-wire
  // regression (i18n-vt-chrome-persist.spec.ts) can exercise it.
  headerRightItems: [
    { type: "component", component: "language-switcher" },
  ] satisfies HeaderRightItem[] as HeaderRightItem[],
  packageOwnedRoutes: true,
};
