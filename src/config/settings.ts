export interface HeaderNavItem {
  label: string;
  labelKey?: string;
  path: string;
  categoryMatch?: string;
}

export interface ColorModeConfig {
  defaultMode: "light" | "dark";
  lightScheme: string;
  darkScheme: string;
  respectPrefersColorScheme: boolean;
}

export interface LocaleConfig {
  label: string;
  dir: string;
}

export const settings = {
  colorScheme: "Default Dark",
  colorMode: {
    defaultMode: "light",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    respectPrefersColorScheme: true,
  } as ColorModeConfig | false,
  siteName: "zudo-doc",
  siteDescription: "A minimal, fast documentation framework built with Astro and MDX." as string,
  base: "/pj/zudo-doc/",
  docsDir: "src/content/docs",
  locales: {
    ja: { label: "JA", dir: "src/content/docs-ja" },
    de: { label: "DE", dir: "src/content/docs-de" },
  } satisfies Record<string, LocaleConfig>,
  mermaid: true,
  noindex: false as boolean, // When true, adds noindex/nofollow to all pages (for internal docs)
  editUrl: false as string | false,
  siteUrl: "" as string, // e.g. "https://example.com" — required for sitemap absolute URLs
  sitemap: true,
  docMetainfo: true,
  docTags: true,
  math: true,
  docHistory: true,
  claudeResources: {
    claudeDir: ".claude",
  } as { claudeDir: string; projectRoot?: string } | false,
  headerNav: [
    { label: "Getting Started", labelKey: "nav.gettingStarted", path: "/docs/getting-started", categoryMatch: "getting-started" },
    { label: "Guides", labelKey: "nav.guides", path: "/docs/guides", categoryMatch: "guides" },
    { label: "Reference", labelKey: "nav.reference", path: "/docs/reference", categoryMatch: "reference" },
    { label: "API", labelKey: "nav.api", path: "/docs/api", categoryMatch: "api" },
    { label: "Claude", labelKey: "nav.claude", path: "/docs/claude", categoryMatch: "claude" },
  ] satisfies HeaderNavItem[],
};
