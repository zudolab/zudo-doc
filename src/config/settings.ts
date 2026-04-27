export type {
  HeaderNavChildItem,
  HeaderNavItem,
  HeaderRightItem,
  ColorModeConfig,
  HtmlPreviewConfig,
  LocaleConfig,
  VersionConfig,
  BlogConfig,
  FooterConfig,
  FrontmatterPreviewConfig,
  BodyFootUtilAreaConfig,
  TagPlacement,
  TagGovernanceMode,
  TagVocabularyEntry,
} from "./settings-types";
import type {
  HeaderNavItem,
  HeaderRightItem,
  ColorModeConfig,
  HtmlPreviewConfig,
  LocaleConfig,
  VersionConfig,
  BlogConfig,
  FooterConfig,
  FrontmatterPreviewConfig,
  BodyFootUtilAreaConfig,
  TagPlacement,
  TagGovernanceMode,
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
  defaultLocale: "en" as string,
  locales: {
    ja: { label: "JA", dir: "src/content/docs-ja" },
  } satisfies Record<string, LocaleConfig>,
  mermaid: true,
  noindex: false as boolean, // When true, adds noindex/nofollow to all pages (for internal docs)
  editUrl: false as string | false,
  githubUrl: "https://github.com/zudolab/zudo-doc" as string | false,
  siteUrl: "" as string, // e.g. "https://example.com" — required for sitemap absolute URLs
  sitemap: true,
  docMetainfo: true,
  docTags: true,
  tagPlacement: "after-title" as TagPlacement,
  /**
   * Tag governance enforcement level.
   *
   * - `"off"`    — no vocabulary-aware enforcement (pre-vocabulary behaviour).
   * - `"warn"`   — tag audit reports unknown tags but the build still passes.
   * - `"strict"` — unknown tags fail `pnpm check` / `pnpm build` via Zod.
   *
   * Orthogonal to `tagVocabulary`. `tagGovernance` controls the enforcement
   * level when the vocabulary is consulted; `tagVocabulary` controls whether
   * it is consulted at all.
   */
  tagGovernance: "warn" as TagGovernanceMode,
  /**
   * Whether `tag-vocabulary.ts` is consulted at runtime.
   *
   * - `true`  — alias rewrites, deprecation filtering, and grouped-footer
   *             rendering are active. Governance level is decided by
   *             `tagGovernance`.
   * - `false` — the vocabulary file is ignored entirely, regardless of
   *             `tagGovernance`. Tags stay completely loose. Useful to keep
   *             the vocabulary file in the repo while temporarily running
   *             unfiltered.
   *
   * Orthogonal to `tagGovernance`. Defaults are `true` / `"warn"`.
   */
  tagVocabulary: true as boolean,
  llmsTxt: true,
  math: true,
  cjkFriendly: true as boolean,
  onBrokenMarkdownLinks: "warn" as "warn" | "error" | "ignore",
  aiAssistant: true as boolean,
  /**
   * Enables the interactive Design Token Tweak panel (tabbed UI for spacing,
   * font, size and color tokens). The Color tab reproduces the former
   * Color-Tweak panel; other tabs are filled in by follow-up sub-issues.
   *
   * Either `designTokenPanel` or the deprecated alias `colorTweakPanel` may
   * be set to `true` — the panel is enabled when either one is truthy.
   */
  designTokenPanel: true as boolean,
  /**
   * @deprecated Use `designTokenPanel` instead. Retained for one release so
   * existing user projects keep working. When `true`, the panel is still
   * enabled; when unset, only `designTokenPanel` is consulted.
   */
  colorTweakPanel: undefined as boolean | undefined,
  sidebarResizer: true as boolean,
  sidebarToggle: true as boolean,
  imageEnlarge: true as boolean,
  frontmatterPreview: {} satisfies FrontmatterPreviewConfig as FrontmatterPreviewConfig | false,
  docHistory: true,
  bodyFootUtilArea: {
    docHistory: true,
    viewSourceLink: true,
  } satisfies BodyFootUtilAreaConfig as BodyFootUtilAreaConfig | false,
  htmlPreview: undefined as HtmlPreviewConfig | undefined,
  versions: [
    {
      slug: "1.0",
      label: "1.0.0",
      docsDir: "src/content/docs-v1",
      banner: "unmaintained",
    },
  ] as VersionConfig[] | false,
  /**
   * Opt-in blog feature. Off by default — leave as `false` to disable, or set
   * to a config object to enable.
   *
   * The example below shows every supported field with the documented default
   * applied, so it can be copy-pasted as a starting point. Only `enabled` is
   * required; omit any field you are happy to inherit from the default.
   *
   * Defaults:
   *   - `dir`                 → `"src/content/blog"`
   *   - `sidebarRecentCount`  → `30`
   *   - `postsPerPage`        → `10`
   *   - `locales`             → `undefined` (no locale mirrors)
   *
   * Example:
   *
   *   blog: {
   *     enabled: true,
   *     dir: "src/content/blog",
   *     sidebarRecentCount: 30,
   *     postsPerPage: 10,
   *     locales: {
   *       ja: { dir: "src/content/blog-ja" },
   *     },
   *   },
   */
  blog: {
    enabled: true,
    dir: "src/content/blog",
    locales: { ja: { dir: "src/content/blog-ja" } },
    sidebarRecentCount: 30,
    postsPerPage: 10,
  } as BlogConfig | false,
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
    /**
     * Opt-in footer tag index. Leave `enabled: false` (or omit the block
     * entirely) to render the footer unchanged from today.
     *
     * When `groupBy: "group"`, one column is rendered per vocabulary `group`
     * (in declaration order from `tag-vocabulary.ts`). When `groupBy: "flat"`,
     * a single alphabetised column is rendered with the title `taglist.title`.
     * If the vocabulary is inactive, `groupBy` falls back to `"flat"`.
     *
     * Example:
     *
     *   taglist: {
     *     enabled: true,
     *     title: "Tags",
     *     groupBy: "group",
     *     groupTitles: { topic: "By topic", type: "By type", level: "By level" },
     *     locales: {
     *       ja: {
     *         title: "タグ",
     *         groupTitles: { topic: "トピック別", type: "種類別", level: "レベル別" },
     *       },
     *     },
     *   },
     */
  } satisfies FooterConfig as FooterConfig | false,
  headerNav: [
    { label: "Getting Started", labelKey: "nav.gettingStarted", path: "/docs/getting-started", categoryMatch: "getting-started" },
    { label: "Blog", labelKey: "nav.blog", path: "/blog", categoryMatch: "blog" },
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
  headerRightItems: [
    { type: "component", component: "version-switcher" },
    { type: "trigger", trigger: "design-token-panel" },
    { type: "trigger", trigger: "ai-chat" },
    { type: "component", component: "github-link" },
    { type: "component", component: "theme-toggle" },
    { type: "component", component: "search" },
    { type: "component", component: "language-switcher" },
  ] as HeaderRightItem[],
};
