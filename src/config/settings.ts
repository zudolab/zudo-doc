export type {
  HeaderNavChildItem,
  HeaderNavItem,
  HeaderRightItem,
  ColorModeConfig,
  HtmlPreviewConfig,
  LocaleConfig,
  VersionConfig,
  FooterConfig,
  FrontmatterPreviewConfig,
  BodyFootUtilAreaConfig,
  TagPlacement,
  TagGovernanceMode,
  TagVocabularyEntry,
  MetaTagsConfig,
} from "@takazudo/zudo-doc/settings";
import type {
  HeaderNavItem,
  HeaderRightItem,
  ColorModeConfig,
  HtmlPreviewConfig,
  LocaleConfig,
  VersionConfig,
  FooterConfig,
  FrontmatterPreviewConfig,
  BodyFootUtilAreaConfig,
  TagPlacement,
  TagGovernanceMode,
  MetaTagsConfig,
  Settings,
} from "@takazudo/zudo-doc/settings";

export const settings = {
  colorScheme: "Default Dark",
  colorMode: {
    defaultMode: "dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    respectPrefersColorScheme: true,
  } satisfies ColorModeConfig as ColorModeConfig | false,
  siteName: "zudo-doc",
  siteDescription: "Documentation base framework built with zfb, MDX, and Tailwind CSS v4." as string,
  // Showcase keeps its hand-drawn asset; downstream default is "auto" (generated SVG).
  logo: "/img/logo.svg" as string | false,
  base: "/",
  trailingSlash: true as boolean,
  minifyHtml: true as boolean,
  docsDir: "src/content/docs",
  entryDocSlug: "getting-started",
  defaultLocale: "en" as const,
  locales: {
    ja: { label: "JA", dir: "src/content/docs-ja" },
  } satisfies Record<string, LocaleConfig>,
  mermaid: true,
  noindex: false as boolean, // When true, adds noindex/nofollow to all pages (for internal docs)
  // Not yet wired: wiring requires adding an editLink slot to BodyFootUtilArea (v2 package API change, #2140).
  editUrl: false as string | false,
  githubUrl: "https://github.com/zudolab/zudo-doc" as string | false,
  siteUrl: "https://zudo-doc.takazudomodular.com" as string, // canonical prod host; sitemap/canonical links use this regardless of deploy URL
  metaTags: {
    description: true,
    keywords: false,
    ogImage: "/img/ogp.png",
    ogSiteName: true,
    twitterCard: "summary_large_image",
  } satisfies MetaTagsConfig as MetaTagsConfig,
  sitemap: true,
  docMetainfo: true,
  docTags: true,
  // Not yet wired: settings uses "before-pager" but DocTags (v2 package) expects "before-footer" — types must align first (#2140).
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
   * - `true`  — canonical validation and grouped-footer rendering are active.
   *             Governance level is decided by
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
  changelogs: [
    {
      sourceDir: "src/content/docs/changelog",
      outputFile: "packages/zudo-doc/CHANGELOG.md",
      packageName: "@takazudo/zudo-doc",
    },
  ],
  // Reserved: not yet consumed by the zfb pipeline; wiring site TBD (#2140).
  math: true,
  cjkFriendly: true as boolean,
  onBrokenMarkdownLinks: "warn" as "warn" | "error" | "ignore",
  aiAssistant: true as boolean,
  /**
   * When `true`, `POST /api/ai-chat` short-circuits and replies with a fixed
   * "disabled on this demo" message — no Anthropic API key, no KV namespace,
   * no rate limiter touched. This keeps the showcase deployment functional
   * without server-side secrets while still rendering a meaningful assistant
   * reply in the chat modal.
   *
   * Default `true` for this showcase repo. Downstream projects that wire up
   * their own `ANTHROPIC_API_KEY` flip this to `false` to enable the real
   * Claude-backed chat.
   *
   * **Security warning**: flipping this to `false` exposes a real Anthropic
   * API key endpoint. Harden your deployment with the settings below:
   * - `aiChatAllowedOrigins` — restrict CORS to known origins (default blocks
   *   all cross-origin requests when not in demo mode).
   * - `aiChatGlobalDailyLimit` — exact daily paid-call admission cap.
   * Rate limiting also becomes fail-closed (KV errors → HTTP 429) when
   * `aiChatDemoMode` is `false`, so a KV outage cannot unlock unbounded spend.
   * Note: `cf-connecting-ip` is only trustworthy when deployed behind Cloudflare.
   */
  aiChatDemoMode: true as boolean,
  /**
   * Allowed CORS origins for `POST /api/ai-chat` when `aiChatDemoMode` is
   * `false`. The request `Origin` header is echoed only if it matches one of
   * these values; non-matching (or missing) origins receive no
   * `Access-Control-Allow-Origin` header, so browsers block the request.
   *
   * - Empty array (default) — all cross-origin browser requests are blocked;
   *   same-origin requests (no `Origin` header) are always allowed.
   * - `["https://your-docs-site.example.com"]` — allow a specific origin.
   * - Has no effect in demo mode (`aiChatDemoMode: true`), which always sends
   *   `Access-Control-Allow-Origin: *` for back-compat.
   */
  aiChatAllowedOrigins: [] as string[],
  /**
   * Optional exact daily paid-call admission cap across all IPs as a cost
   * backstop against IP rotation / botnets. `false` (default) disables the
   * cap. When set to a positive integer (e.g. `500`), a UTC-day Durable Object
   * admits at most that many Anthropic fetch attempts before returning 429.
   * Admissions are consumed immediately before fetch and are not refunded on
   * provider/network failure; this is not provider-confirmed spend accounting.
   *
   * Has no effect in demo mode (`aiChatDemoMode: true`).
   */
  aiChatGlobalDailyLimit: false as number | false,
  /**
   * Enables the interactive Design Token Tweak panel (tabbed UI for spacing,
   * font, size and color tokens). The Color tab reproduces the former
   * Color-Tweak panel; other tabs are filled in by follow-up sub-issues.
   *
   * Set to `true` to enable the panel.
   */
  designTokenPanel: true as boolean,
  /**
   * Active theme pack — "default" is the stock zudo-doc look (no pack
   * stylesheet loaded). Explicit here (matches the field's own default) for
   * fixture/showcase drift-diff clarity (epic Theme Core #2812, #2826).
   */
  themePack: "default" as string,
  /**
   * Mounts the bottom-right theme-pack switcher flyout (+ browse-all dialog)
   * so every preview deploy demonstrates the feature with the stock look
   * active (epic Theme Core #2812, #2826).
   */
  themePackSwitcher: true as boolean,
  /**
   * Minimum heading depth included in the TOC (restriction-only: 2–4, default 2).
   *
   * Raise to 3 or 4 to hide shallower headings from the TOC. Cannot go below 2
   * (h1 is always the page title) or above `tocMaxDepth`. Invalid values fall
   * back to the default of 2.
   */
  tocMinDepth: 2 as number,
  /**
   * Maximum heading depth included in the TOC (restriction-only: 2–4, default 4).
   *
   * Lower to 2 or 3 to hide deeper headings from the TOC. Cannot exceed 4
   * (h5–h6 are never shown) or go below `tocMinDepth`. Invalid values fall
   * back to the default of 4.
   */
  tocMaxDepth: 4 as number,
  sidebarResizer: true as boolean,
  sidebarToggle: true as boolean,
  tocToggle: true as boolean,
  imageEnlarge: true as boolean,
  // Tauri-desktop-only (mounts the package's Cmd/Ctrl+F find-in-page island).
  // Inert for this showcase: `BodyEndIslands` below (this repo's own
  // chrome-bindings slot, see pages/lib/_body-end-islands.tsx) overrides the
  // package default and never mounts `FindInPageInit`, so the flag has no
  // runtime effect here regardless of its value. Kept `false` for census
  // parity with the package `Settings` type.
  findInPage: false as boolean,
  dynamicPageTransition: true as boolean,
  frontmatterPreview: {} satisfies FrontmatterPreviewConfig as FrontmatterPreviewConfig | false,
  docHistory: true,
  // Generated from project CLAUDE.md files; omit these high-churn pages from history capture.
  docHistoryExclude: ["claude-md/**"],
  bodyFootUtilArea: {
    docHistory: true,
    viewSourceLink: true,
  } satisfies BodyFootUtilAreaConfig as BodyFootUtilAreaConfig | false,
  // Kept as `undefined` (not `false`) because the consumer uses `?? null`
  // (pages/_mdx-components.ts), which converts undefined→null but passes
  // false as-is; `false` doesn't satisfy `HtmlPreviewGlobalConfig | null` (#2140).
  htmlPreview: undefined as HtmlPreviewConfig | undefined,
  versions: [
    {
      // Intentionally English-only: no `locales` field and no docs-v1-ja directory.
      // Versioned docs are not translated for archived versions; the bilingual rule
      // applies to the current docs only (#2140).
      slug: "1.0",
      label: "1.0.0",
      docsDir: "src/content/docs-v1",
      banner: "unmaintained",
    },
  ] satisfies VersionConfig[] as VersionConfig[] | false,
  claudeResources: {
    claudeDir: ".claude",
  } as { claudeDir: string; projectRoot?: string; scanRoot?: string } | false,
  defaultLocaleOnlyPrefixes: [
    "/docs/claude-md/",
    "/docs/claude-skills/",
    "/docs/claude-agents/",
    "/docs/claude-commands/",
  ] as string[],
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
    copyright: `Copyright © ${new Date().getFullYear()} <a href="https://x.com/Takazudo">Takazudo</a>. Built with <a href="https://zudo-doc.takazudomodular.com/docs/getting-started/">zudo-doc</a>.`,
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
    {
      label: "Learn",
      labelKey: "nav.learn",
      path: "/docs/guides",
      categoryMatch: "guides",
      children: [
        { label: "Guides", labelKey: "nav.guides", path: "/docs/guides", categoryMatch: "guides" },
        { label: "Components", labelKey: "nav.components", path: "/docs/components", categoryMatch: "components" },
        { label: "Markdown Features", labelKey: "nav.markdownFeatures", path: "/docs/markdown-features", categoryMatch: "markdown-features" },
      ],
    },
    { label: "Reference", labelKey: "nav.reference", path: "/docs/reference", categoryMatch: "reference" },
    // Claude-resources routes are generated only for the default docsDir and never
    // exist in an archived version directory, so this item must opt out of version
    // prefixing (#3216/#3217) — otherwise it 404s under an active `/v/{version}`.
    { label: "Claude", labelKey: "nav.claude", path: "/docs/claude", categoryMatch: "claude", versioned: false },
    { label: "Changelog", labelKey: "nav.changelog", path: "/docs/changelog", categoryMatch: "changelog" },
    { label: "Develop", labelKey: "nav.develop", path: "/docs/develop", categoryMatch: "develop" },
  ] satisfies HeaderNavItem[] as HeaderNavItem[],
  headerRightItems: [
    { type: "component", component: "version-switcher" },
    { type: "trigger", trigger: "design-token-panel" },
    { type: "trigger", trigger: "ai-chat" },
    { type: "component", component: "github-link" },
    { type: "component", component: "theme-toggle" },
    { type: "component", component: "search" },
    { type: "component", component: "language-switcher" },
  ] satisfies HeaderRightItem[] as HeaderRightItem[],
  // Build-time package-owned route injection (epic Package-First Finale #2356;
  // ADR packages/zudo-doc/docs/adr/route-injection-seam.md). The preset adds
  // `@takazudo/zudo-doc/plugins/routes`; kept user `pages/*.tsx` stubs take
  // precedence on a URL collision (user route wins). Flipped ON in this
  // fast-follow once upstream zfb dev-render support landed (#2372).
  packageOwnedRoutes: true,
} satisfies Settings;
