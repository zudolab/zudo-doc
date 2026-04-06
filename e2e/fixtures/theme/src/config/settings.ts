import type {
  HeaderNavItem,
  ColorModeConfig,
  LocaleConfig,
} from "./settings-types";

export const settings = {
  colorScheme: "Default Dark",
  colorMode: {
    defaultMode: "light",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    respectPrefersColorScheme: true,
  } satisfies ColorModeConfig as ColorModeConfig | false,
  siteName: "Theme Test",
  siteDescription: "Test fixture for theme toggle E2E tests" as string,
  base: "/",
  docsDir: "src/content/docs",
  locales: {} as Record<string, LocaleConfig>,
  mermaid: false,
  noindex: true as boolean,
  editUrl: false as string | false,
  siteUrl: "" as string,
  sitemap: false,
  docMetainfo: false,
  docTags: false,
  math: false,
  colorTweakPanel: true as boolean,
  docHistory: false,
  claudeResources: false as { claudeDir: string; projectRoot?: string } | false,
  headerNav: [
    {
      label: "Getting Started",
      path: "/docs/getting-started",
      categoryMatch: "getting-started",
    },
  ] as HeaderNavItem[],
};
