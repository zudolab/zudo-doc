import type {
  HeaderNavItem,
  ColorModeConfig,
  LocaleConfig,
} from "./settings-types";

export const settings = {
  colorScheme: "Default Dark",
  colorMode: false as ColorModeConfig | false,
  siteName: "i18n Test",
  siteDescription: "Test fixture for i18n E2E tests" as string,
  base: "/",
  docsDir: "src/content/docs",
  defaultLocale: "en",
  locales: {
    ja: { label: "JA", dir: "src/content/docs-ja" },
    de: { label: "DE", dir: "src/content/docs-de" },
  } satisfies Record<string, LocaleConfig>,
  mermaid: false,
  noindex: true as boolean,
  editUrl: false as string | false,
  siteUrl: "" as string,
  sitemap: false,
  docMetainfo: false,
  docTags: false,
  math: false,
  docHistory: false,
  claudeResources: false as { claudeDir: string; projectRoot?: string } | false,
  headerNav: [
    {
      label: "Getting Started",
      path: "/docs/getting-started",
      categoryMatch: "getting-started",
    },
    { label: "Guides", path: "/docs/guides", categoryMatch: "guides" },
  ] as HeaderNavItem[],
};
