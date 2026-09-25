import type {
  HeaderNavItem,
  HeaderRightItem,
  ChangelogConfig,
  ColorModeConfig,
  LocaleConfig,
  MetaTagsConfig,
  DateFormatSetting,
} from "@takazudo/zudo-doc/settings";
import type { ZudoDocConfig } from "@takazudo/zudo-doc/config";

export const settings = {
  // Keep fixture homes on the no-introduction package default.
  home: { wide: false, introMarkdown: "", sitemapHeading: "" },
  colorScheme: "Default Dark",
  colorMode: false as ColorModeConfig | false,
  siteName: "Host Panel Test",
  siteDescription: "Test fixture for the host-mounted design token panel" as string,
  logo: "auto" as string | false,
  base: "/",
  minifyHtml: true as boolean,
  docsDir: "src/content/docs",
  entryDocSlug: "getting-started",
  // Mirrors the showcase default — see /docs/guides/configuration.
  dateFormat: "locale" as DateFormatSetting,
  defaultLocale: "en" as const,
  locales: {} satisfies Record<string, LocaleConfig>,
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
  llmsTxt: false,
  changelogs: false as ChangelogConfig[] | false,
  math: false,
  docHistory: false,
  docHistoryExclude: [],
  assetViewer: false,
  assetViewerDir: "assets",
  assetViewerRoutePrefix: "files",
  assetViewerExclude: [],
  assetViewerIndex: false,
  assetViewerIndexing: false,
  // The POINT of this fixture (#4310, epic #4309): the PACKAGE panel is off, so
  // the package drops both its `#design-token-trigger` button and its
  // pre-hydration toggle shim, and the host mounts its own panel instead (see
  // src/host-panel/). `bundleZdtp: true` is mandatory in that combination —
  // without it the preset shadows `@takazudo/zudo-doc/zdtp-loader` with a
  // throwing stub (#4201) and the host panel's `loadZdtp()` rejects the moment
  // it is opened, despite a green build (#4261).
  designTokenPanel: false as boolean,
  bundleZdtp: true as boolean,
  // Mirrors the showcase default — themePackSwitcher stays off here
  // (allowlisted, epic Theme Core #2812, #2826).
  themePack: "default" as string,
  findInPage: false as boolean,
  dynamicPageTransition: true as boolean,
  claudeResources: false as { claudeDir: string; projectRoot?: string; scanRoot?: string } | false,
  codexResources: false as { codexDir: string; projectRoot?: string; scanRoot?: string } | false,
  defaultLocaleOnlyPrefixes: [] as string[],
  tocMinDepth: 2 as number,
  tocMaxDepth: 4 as number,
  searchMaxBodyLength: 3000 as number,
  headerNav: [
    {
      label: "Getting Started",
      path: "/docs/getting-started",
      categoryMatch: "getting-started",
    },
  ] satisfies HeaderNavItem[] as HeaderNavItem[],
  // `type: "component"` is load-bearing: `header.tsx` keys its dispatch table
  // on `${type}:${component}`, so an entry written without `type` resolves to
  // no handler and the header renders nothing at all. The name resolves through
  // `chromeBindings.headerRightComponents` in src/chrome-bindings.fixture.tsx.
  headerRightItems: [
    { type: "component", component: "host-token-trigger" },
  ] satisfies HeaderRightItem[] as HeaderRightItem[],
  packageOwnedRoutes: true,
} satisfies ZudoDocConfig;
