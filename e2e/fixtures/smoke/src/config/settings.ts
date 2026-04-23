import type {
  HeaderNavItem,
  HeaderRightItem,
  ColorModeConfig,
  HtmlPreviewConfig,
  LocaleConfig,
  FrontmatterPreviewConfig,
  BodyFootUtilAreaConfig,
} from "./settings-types";

export const settings = {
  colorScheme: "Default Dark",
  colorMode: false as ColorModeConfig | false,
  siteName: "Smoke Test",
  siteDescription: "Test fixture for smoke E2E tests" as string,
  base: "/",
  docsDir: "src/content/docs",
  locales: {} as Record<string, LocaleConfig>,
  mermaid: true,
  noindex: true as boolean,
  editUrl: "https://github.com/example/repo/edit/main" as string | false,
  githubUrl: "https://github.com/example/repo" as string | false,
  siteUrl: "" as string,
  sitemap: false,
  docMetainfo: false,
  docTags: false,
  math: false,
  aiAssistant: true as boolean,
  colorTweakPanel: true as boolean,
  imageEnlarge: true as boolean,
  frontmatterPreview: {} as FrontmatterPreviewConfig,
  docHistory: true,
  bodyFootUtilArea: {
    docHistory: true,
    viewSourceLink: true,
  } as BodyFootUtilAreaConfig,
  htmlPreview: {
    css: `.global-test { border: 3px solid rgb(255, 0, 0); }`,
  } as HtmlPreviewConfig | undefined,
  claudeResources: false as { claudeDir: string; projectRoot?: string } | false,
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
  ] as HeaderNavItem[],
  headerRightItems: [
    { type: "trigger", trigger: "design-token-panel" },
    { type: "trigger", trigger: "ai-chat" },
    { type: "component", component: "github-link" },
    { type: "component", component: "theme-toggle" },
  ] as HeaderRightItem[],
};
