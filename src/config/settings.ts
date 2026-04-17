export type {
  HeaderNavChildItem,
  HeaderNavItem,
  ColorModeConfig,
  HtmlPreviewConfig,
  LocaleConfig,
  VersionConfig,
  FooterConfig,
} from "./settings-types";
import type {
  HeaderNavItem,
  ColorModeConfig,
  HtmlPreviewConfig,
  LocaleConfig,
  VersionConfig,
  FooterConfig,
} from "./settings-types";

export const settings = {
  colorScheme: "Default Dark",
  colorMode: {
    defaultMode: "dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    respectPrefersColorScheme: true,
  } as ColorModeConfig | false,
  siteName: "zudo-doc",
  siteDescription: "Documentation base framework built with Astro and MDX." as string,
  base: "/pj/zudo-doc/",
  trailingSlash: true as boolean,
  docsDir: "src/content/docs",
  locales: {
    ja: { label: "JA", dir: "src/content/docs-ja" },
  } satisfies Record<string, LocaleConfig>,
  mermaid: true,
  noindex: false as boolean, // When true, adds noindex/nofollow to all pages (for internal docs)
  editUrl: false as string | false,
  siteUrl: "" as string, // e.g. "https://example.com" — required for sitemap absolute URLs
  sitemap: true,
  docMetainfo: true,
  docTags: true,
  llmsTxt: true,
  math: true,
  cjkFriendly: true as boolean,
  onBrokenMarkdownLinks: "warn" as "warn" | "error" | "ignore",
  aiAssistant: true as boolean,
  colorTweakPanel: true as boolean,
  sidebarResizer: true as boolean,
  sidebarToggle: true as boolean,
  imageEnlarge: true as boolean,
  docHistory: true,
  htmlPreview: undefined as HtmlPreviewConfig | undefined,
  versions: [
    {
      slug: "1.0",
      label: "1.0.0",
      docsDir: "src/content/docs-v1",
      banner: "unmaintained",
    },
  ] as VersionConfig[] | false,
  claudeResources: {
    claudeDir: ".claude",
  } as { claudeDir: string; projectRoot?: string } | false,
  footer: {
    links: [
      {
        title: "Docs",
        locales: { ja: { title: "ドキュメント" } },
        items: [
          { label: "Getting Started", href: "/docs/getting-started", locales: { ja: { label: "はじめに" } } },
          { label: "Guides", href: "/docs/guides", locales: { ja: { label: "ガイド" } } },
        ],
      },
      {
        title: "Community",
        locales: { ja: { title: "コミュニティ" } },
        items: [
          { label: "GitHub", href: "https://github.com/zudolab/zudo-doc" },
        ],
      },
    ],
    copyright: `Copyright © ${new Date().getFullYear()} <a href="https://x.com/Takazudo">Takazudo</a>. Built with <a href="https://zudo-doc.pages.dev/pj/zudo-doc/docs/getting-started/">zudo-doc</a>.`,
  } satisfies FooterConfig as FooterConfig | false,
  headerNav: [
    { label: "Getting Started", labelKey: "nav.gettingStarted", path: "/docs/getting-started", categoryMatch: "getting-started" },
    {
      label: "Learn",
      labelKey: "nav.learn",
      path: "/docs/guides",
      categoryMatch: "guides",
      children: [
        { label: "Guides", labelKey: "nav.guides", path: "/docs/guides", categoryMatch: "guides" },
        { label: "Components", labelKey: "nav.components", path: "/docs/components", categoryMatch: "components" },
      ],
    },
    { label: "Reference", labelKey: "nav.reference", path: "/docs/reference", categoryMatch: "reference" },
    { label: "Claude", labelKey: "nav.claude", path: "/docs/claude", categoryMatch: "claude" },
    { label: "Changelog", labelKey: "nav.changelog", path: "/docs/changelog", categoryMatch: "changelog" },
    { label: "Develop", labelKey: "nav.develop", path: "/docs/develop", categoryMatch: "develop" },
  ] as HeaderNavItem[],
};
