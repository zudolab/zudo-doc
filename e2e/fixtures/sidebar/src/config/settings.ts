import type {
  HeaderNavItem,
  ChangelogConfig,
  ColorModeConfig,
  LocaleConfig,
  MetaTagsConfig,
} from "@takazudo/zudo-doc/settings";

export const settings = {
  colorScheme: "Default Dark",
  colorMode: false as ColorModeConfig | false,
  siteName: "Sidebar Test",
  siteDescription: "Test fixture for sidebar E2E tests" as string,
  logo: "auto" as string | false,
  base: "/",
  minifyHtml: true as boolean,
  docsDir: "src/content/docs",
  entryDocSlug: "getting-started",
  defaultLocale: "en" as const,
  locales: {} satisfies Record<string, LocaleConfig>,
  mermaid: false,
  // Enabled so the SidebarResizerRestore pre-paint <script> mounts in this
  // fixture — required to exercise the localStorage width-restore regression
  // deterministically (#2527; see .claude/skills/test-flow-sidebar-width-restore).
  sidebarResizer: true as boolean,
  // Enabled so the persisted DesktopSidebarToggle island + pre-paint script
  // mount in this fixture — required to exercise the SPA-nav flash regression
  // (#2198), which only reproduces with the toggle island present.
  sidebarToggle: true as boolean,
  // Enabled so the persisted DesktopTocToggle island + pre-paint script mount
  // in this fixture — required to exercise the toggle/persistence/SPA-nav
  // regressions (epic #3252), which only reproduce with the toggle island
  // present.
  tocToggle: true as boolean,
  // Mirrors the showcase default — themePackSwitcher stays off here
  // (allowlisted, epic Theme Core #2812, #2826).
  themePack: "default" as string,
  findInPage: false as boolean,
  dynamicPageTransition: true as boolean,
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
  assetViewer: false,
  assetViewerDir: "assets",
  assetViewerRoutePrefix: "files",
  assetViewerExclude: [],
  assetViewerIndex: false,
  claudeResources: false as { claudeDir: string; projectRoot?: string; scanRoot?: string } | false,
  codexResources: false as { codexDir: string; projectRoot?: string; scanRoot?: string } | false,
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
    { label: "Notes", path: "/docs/notes", categoryMatch: "notes" },
    { label: "Journal", path: "/docs/journal", categoryMatch: "journal" },
    {
      label: "Series by Year",
      path: "/docs/series-year",
      categoryMatch: "series-year",
    },
  ] satisfies HeaderNavItem[] as HeaderNavItem[],
  packageOwnedRoutes: true,
};
