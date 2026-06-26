import type {
  HeaderNavItem,
  ColorModeConfig,
  LocaleConfig,
  MetaTagsConfig,
} from "./settings-types";

export const settings = {
  colorScheme: "Default Dark",
  colorMode: false as ColorModeConfig | false,
  siteName: "Sidebar Test",
  siteDescription: "Test fixture for sidebar E2E tests" as string,
  base: "/",
  docsDir: "src/content/docs",
  defaultLocale: "en" as const,
  locales: {} satisfies Record<string, LocaleConfig>,
  mermaid: false,
  // Enabled so the persisted DesktopSidebarToggle island + pre-paint script
  // mount in this fixture — required to exercise the SPA-nav flash regression
  // (#2198), which only reproduces with the toggle island present.
  sidebarToggle: true as boolean,
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
  math: false,
  docHistory: false,
  claudeResources: false as { claudeDir: string; projectRoot?: string } | false,
  defaultLocaleOnlyPrefixes: [] as string[],
  tocMinDepth: 2 as number,
  tocMaxDepth: 4 as number,
  headingIdStrategy: "hierarchical" as "flat" | "hierarchical",
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
