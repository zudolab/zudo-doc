// Settings for the no-src route-injection build proof — i18n variant (S1 #2370).
//
// Identical to the `route-injection` fixture EXCEPT it configures ONE non-default
// locale (`ja`). That turns on the locale-prefixed injected routes
// (`/[locale]/docs/[[...slug]]`, …) in deriveRoutes(), so the no-src test can
// prove the resolver picks `routes-src/locale-docs-slug.tsx` when the published
// package has no `src/`.

import type { Settings } from "@takazudo/zudo-doc/settings";

export const settings = {
  colorScheme: "Default Dark",
  colorMode: false,
  siteName: "Route Injection i18n Proof",
  siteDescription: "Minimal i18n fixture for the no-src route-injection build proof",
  base: "/",
  trailingSlash: true,
  docsDir: "src/content/docs",
  defaultLocale: "en",
  locales: {
    ja: { label: "日本語", dir: "src/content/docs-ja" },
  },
  mermaid: false,
  noindex: true,
  editUrl: false,
  githubUrl: false,
  siteUrl: "",
  metaTags: {
    description: false,
    keywords: false,
    ogImage: false,
    ogSiteName: false,
    twitterCard: false,
  },
  sitemap: false,
  docMetainfo: false,
  docTags: false,
  tagPlacement: "after-title",
  tagGovernance: "off",
  tagVocabulary: false,
  llmsTxt: false,
  math: false,
  cjkFriendly: false,
  onBrokenMarkdownLinks: "warn",
  aiAssistant: false,
  aiChatDemoMode: false,
  aiChatAllowedOrigins: [],
  aiChatGlobalDailyLimit: false,
  designTokenPanel: false,
  tocMinDepth: 2,
  tocMaxDepth: 4,
  headingIdStrategy: "hierarchical",
  sidebarResizer: false,
  sidebarToggle: false,
  imageEnlarge: false,
  dynamicPageTransition: false,
  frontmatterPreview: false,
  docHistory: false,
  bodyFootUtilArea: false,
  htmlPreview: undefined,
  versions: false,
  claudeResources: false,
  defaultLocaleOnlyPrefixes: [],
  footer: false,
  headerNav: [],
  headerRightItems: [],
  // The flag under test: enables the A1 route-injection seam.
  packageOwnedRoutes: true,
} satisfies Settings;
