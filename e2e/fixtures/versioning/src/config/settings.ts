import type {
  HeaderNavItem,
  HeaderRightItem,
  ColorModeConfig,
  LocaleConfig,
  VersionConfig,
} from "./settings-types";

export const settings = {
  colorScheme: "Default Dark",
  colorMode: false as ColorModeConfig | false,
  siteName: "Versioning Test",
  siteDescription: "Test fixture for versioning E2E tests" as string,
  base: "/",
  docsDir: "src/content/docs",
  defaultLocale: "en",
  locales: {} as Record<string, LocaleConfig>,
  mermaid: false,
  noindex: true as boolean,
  editUrl: false as string | false,
  siteUrl: "" as string,
  sitemap: false,
  docMetainfo: false,
  docTags: false,
  llmsTxt: false,
  math: false,
  docHistory: false,
  versions: [
    {
      slug: "1.0",
      label: "1.0.0",
      docsDir: "src/content/docs-v1",
      banner: "unmaintained",
    },
  ] as VersionConfig[] | false,
  claudeResources: false as { claudeDir: string; projectRoot?: string } | false,
  headerNav: [
    {
      label: "Getting Started",
      path: "/docs/getting-started",
      categoryMatch: "getting-started",
    },
  ] as HeaderNavItem[],
  headerRightItems: [
    { type: "component", component: "version-switcher" },
  ] as HeaderRightItem[],
};
