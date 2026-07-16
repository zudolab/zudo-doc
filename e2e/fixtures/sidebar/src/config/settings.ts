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
  base: "/",
  minifyHtml: true as boolean,
  docsDir: "src/content/docs",
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
  packageOwnedRoutes: true,
};
