export interface HeaderNavItem {
  label: string;
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
  base: "/pj/zudo-doc/",
  docsDir: "src/content/docs",
  locales: {
    ja: { label: "JA", dir: "src/content/docs-ja" },
    de: { label: "DE", dir: "src/content/docs-de" },
  } as Record<string, LocaleConfig>,
  mermaid: true,
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
    { label: "Getting Started", path: "/docs/getting-started", categoryMatch: "getting-started" },
    { label: "Guides", path: "/docs/guides", categoryMatch: "guides" },
    { label: "Reference", path: "/docs/reference", categoryMatch: "reference" },
    { label: "API", path: "/docs/api", categoryMatch: "api" },
    { label: "Claude", path: "/docs/claude", categoryMatch: "claude" },
  ] satisfies HeaderNavItem[],
};
