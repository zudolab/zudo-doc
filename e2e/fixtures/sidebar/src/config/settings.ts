import type {
  HeaderNavItem,
  ColorModeConfig,
  LocaleConfig,
} from "./settings-types";

export const settings = {
  colorScheme: "Default Dark",
  colorMode: false as ColorModeConfig | false,
  siteName: "Sidebar Test",
  siteDescription: "Test fixture for sidebar E2E tests" as string,
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
  ] as HeaderNavItem[],
};
