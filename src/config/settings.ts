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
} from "./settings-types";
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
} from "./settings-types";

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
  base: "/",
  trailingSlash: true as boolean,
  docsDir: "src/content/docs",
  defaultLocale: "en" as const,
  locales: {
    ja: { label: "JA", dir: "src/content/docs-ja" },
  } satisfies Record<string, LocaleConfig>,
  mermaid: true,
  noindex: false as boolean, // When true, adds noindex/nofollow to all pages (for internal docs)
  // Not yet wired: wiring requires adding an editLink slot to BodyFootUtilArea (v2 package API change, #2140).
  editUrl: false as string | false,
  githubUrl: "https://github.com/zudolab/zudo-doc" as string | false,
  githubAutolinksRepo: "zudolab/zudo-doc",
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
   * - `aiChatGlobalDailyLimit` — cap total daily requests as a cost backstop.
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
   * Optional global daily request ceiling across all IPs as a cost backstop
   * against IP rotation / botnets. `false` (default) disables the ceiling.
   * When set to a positive integer (e.g. `500`), the endpoint returns HTTP 429
   * once that many requests have been served in the current UTC day.
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
  /**
   * Heading-ID (anchor) strategy. Single source of truth shared by the zfb
   * engine config (`markdown.features.headingIds.strategy` in `zfb.config.ts`)
   * and the host TOC builder (`extractHeadings` in `pages/lib/_extract-headings.ts`)
   * so the rendered `<hN id>` and the TOC `href="#…"` can never diverge.
   *
   * - `"flat"` (zfb default): github-slugger slugs with one dedup counter shared
   *   across h2–h6 (`overview`, `overview-1`, …).
   * - `"hierarchical"`: each heading's slug is prefixed with its ancestor chain
   *   (`## Foo` / `### Moo` / `#### Mew` → `foo`, `foo-moo`, `foo-moo-mew`),
   *   deduped on the full path — anchors become reconstructible from the
   *   heading outline and collide far less often.
   *
   * Switching to `"hierarchical"` is **anchor-breaking** for existing deep
   * links to nested headings (upstream zfb#871; original finding #1938).
   */
  headingIdStrategy: "hierarchical" as "flat" | "hierarchical",
  sidebarResizer: true as boolean,
  sidebarToggle: true as boolean,
  imageEnlarge: true as boolean,
  dynamicPageTransition: true as boolean,
  frontmatterPreview: {} satisfies FrontmatterPreviewConfig as FrontmatterPreviewConfig | false,
  docHistory: true,
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
  } as { claudeDir: string; projectRoot?: string } | false,
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
    { label: "Claude", labelKey: "nav.claude", path: "/docs/claude", categoryMatch: "claude" },
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
  // ADR packages/zudo-doc/docs/adr/route-injection-seam.md). Dormant by
  // default — internal/advanced. With this off, the showcase keeps shipping its
  // pages/*.tsx route stubs and the build is byte-unchanged. A fast-follow
  // flips it on once upstream zfb dev-render support lands.
  packageOwnedRoutes: false,
} satisfies Settings;
