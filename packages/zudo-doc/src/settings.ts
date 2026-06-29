// settings.ts — pure Settings interfaces exported as `@takazudo/zudo-doc/settings`.
//
// Moved from the showcase's `src/config/settings-types.ts` into the shared
// package as part of the package-first migration (epic #2321, S4 #2327).
//
// The showcase project keeps its concrete `settings` object in
// `src/config/settings.ts` using `satisfies Settings`. This file ships
// ONLY the type definitions — no runtime values, no project-specific data.
// Generated projects will import `Settings` from here and use it to
// type-check their own `settings` object.

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
export type TagGovernanceMode = "off" | "warn" | "strict";

/**
 * A single entry in the tag vocabulary.
 *
 * - `id`         — canonical tag id. What content files should ideally use.
 * - `label`      — optional human-readable label (falls back to `id`).
 * - `description`— optional short description for tooling / tag index pages.
 * - `group`      — optional grouping key used by the grouped tag footer
 *                  (e.g. `"type"`, `"level"`, `"topic"`).
 * - `aliases`    — alternate strings that content files may use. Alias
 *                  resolution rewrites these to `id` before aggregation.
 * - `deprecated` — `true` marks the tag as deprecated with no redirect: the
 *                  canonical id is dropped from aggregation. Pass
 *                  `{ redirect: "<other-id>" }` to rewrite this tag to another
 *                  canonical id when it appears in content.
 */
export interface TagVocabularyEntry {
  id: string;
  label?: string;
  description?: string;
  group?: string;
  aliases?: readonly string[];
  deprecated?: boolean | { redirect?: string };
}

export interface HeaderNavChildItem {
  label: string;
  labelKey?: string;
  path: string;
  categoryMatch?: string;
}

export interface HeaderNavItem extends HeaderNavChildItem {
  children?: HeaderNavChildItem[];
}

export type HeaderRightComponentName =
  | "theme-toggle"
  | "language-switcher"
  | "version-switcher"
  | "github-link"
  | "search";

export type HeaderRightTriggerName = "design-token-panel" | "ai-chat";

export interface HeaderRightComponentItem {
  type: "component";
  component: HeaderRightComponentName;
}

export interface HeaderRightTriggerItem {
  type: "trigger";
  trigger: HeaderRightTriggerName;
}

export interface HeaderRightLinkItem {
  type: "link";
  href: string;
  label?: string;
  ariaLabel?: string;
  icon?: "github";
}

export interface HeaderRightHtmlItem {
  type: "html";
  html: string;
}

export type HeaderRightItem =
  | HeaderRightComponentItem
  | HeaderRightTriggerItem
  | HeaderRightLinkItem
  | HeaderRightHtmlItem;

export interface BodyFootUtilAreaConfig {
  docHistory?: boolean;
  viewSourceLink?: boolean;
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

export interface FooterLinkItem {
  label: string;
  href: string;
  locales?: Record<string, { label: string }>;
}

export interface FooterLinkColumn {
  title: string;
  items: FooterLinkItem[];
  locales?: Record<string, { title: string }>;
}

/**
 * Per-locale overrides for the footer taglist labels.
 *
 * `title`        — overrides `taglist.title` on this locale.
 * `groupTitles`  — per-group title overrides keyed by vocabulary `group`.
 */
export interface FooterTaglistLocaleConfig {
  title?: string;
  groupTitles?: Record<string, string>;
}

/**
 * Opt-in footer tag index.
 *
 * Renders one or more columns of tag links inside the existing footer grid.
 * Off by default: when `enabled: false` (or the field is omitted entirely),
 * the footer renders unchanged.
 *
 * - `groupBy: "group"` — one column per vocabulary `group`, in the order the
 *   groups first appear in `tag-vocabulary.ts`. Each column's title comes from
 *   `groupTitles[group]`, falling back to a capitalised version of the group
 *   name.
 * - `groupBy: "flat"` — a single column titled `title` listing every tag
 *   alphabetically. This is also the fallback used when the vocabulary is
 *   inactive (`tagVocabulary: false` or `tagGovernance: "off"`).
 */
export interface FooterTaglistConfig {
  enabled: boolean;
  /** Column title used in flat mode (and as fallback for ungrouped tags). */
  title?: string;
  /** Default `"group"` when the vocabulary is active, otherwise forced to `"flat"`. */
  groupBy?: "group" | "flat";
  /** English (default-locale) group titles, e.g. `{ type: "By type" }`. */
  groupTitles?: Record<string, string>;
  /** Locale-specific overrides for `title` and `groupTitles`. */
  locales?: Record<string, FooterTaglistLocaleConfig>;
}

export interface FooterConfig {
  links: FooterLinkColumn[];
  /** Copyright text displayed at the bottom of the footer. HTML is supported. */
  copyright?: string;
  /** Opt-in footer tag index. Off by default. */
  taglist?: FooterTaglistConfig;
}

export interface HtmlPreviewConfig {
  /** Raw HTML injected into <head> (links, meta, fonts) */
  head?: string;
  /** CSS injected as <style> after preflight */
  css?: string;
  /** JS injected as <script> before </body> */
  js?: string;
}

export interface FrontmatterPreviewConfig {
  /**
   * Completely replaces the default ignore list.
   * When set, `extraIgnoreKeys` is ignored.
   */
  ignoreKeys?: string[];
  /**
   * Additional keys to ignore on top of the defaults.
   * Has no effect when `ignoreKeys` is also set.
   */
  extraIgnoreKeys?: string[];
}

export type TagPlacement = "after-title" | "before-pager";

export interface VersionConfig {
  /** Version identifier, used in URL path (e.g., "1.0", "v1") */
  slug: string;
  /** Display label (e.g., "1.0.0", "Version 1") */
  label: string;
  /** Content directory for this version's English docs */
  docsDir: string;
  /** Per-locale content directories for this version */
  locales?: Record<string, { dir: string }>;
  /** Banner text shown on versioned pages (e.g., "unmaintained", "unreleased") */
  banner?: "unmaintained" | "unreleased" | false;
}

export interface MetaTagsConfig {
  /** Emit <meta name="description">. Default true. */
  description: boolean;
  /** Emit <meta name="keywords"> with a comma-separated string. false = omit. Default false. */
  keywords: string | false;
  /** og:image (and twitter:image) path. false = omit. Default false. Showcase: '/img/ogp.png'. */
  ogImage: string | false;
  /** Emit og:site_name. Default true (preserves current og:site_name). */
  ogSiteName: boolean;
  /** TwitterCard type. false = omit entire twitter:card block. Default false. Showcase: 'summary_large_image'. */
  twitterCard: "summary" | "summary_large_image" | false;
  /** twitter:site handle (e.g. '@yourbrand'). Optional. */
  twitterSite?: string;
  /** twitter:creator handle. Optional. */
  twitterCreator?: string;
}

/**
 * Site-wide custom `<head>` extras injected into every page via
 * {@link HeadWithDefaults}. All fields are JSON-serializable (no VNodes or
 * callables) — settings objects are `JSON.stringify`'d in the
 * route-injection path (`@takazudo/zudo-doc/plugins/routes`), so
 * non-serializable values would be silently dropped.
 *
 * Emit order: preconnect → preload → stylesheets → alternateLinks → meta.
 *
 * Note: `HtmlPreviewConfig.head` (a raw-HTML string scoped to the
 * HTML-preview iframe sandbox, see {@link HtmlPreviewConfig}) is unrelated
 * to this interface — that field injects content only into the preview
 * sandbox, not the page `<head>`. This interface is site-wide.
 */
export interface SiteHeadConfig {
  preconnect?: { href: string; crossorigin?: "anonymous" | "use-credentials" }[];
  stylesheets?: { href: string; crossorigin?: "anonymous" | "use-credentials"; media?: string; async?: boolean }[];
  preload?: { href: string; as: string; type?: string; crossorigin?: "anonymous" | "use-credentials" }[];
  meta?: { name?: string; property?: string; content: string }[];
  alternateLinks?: { rel: string; href: string; type?: string; title?: string }[];
}

/**
 * The full zudo-doc project settings interface.
 *
 * Consumer projects declare their concrete settings object using `satisfies Settings`
 * to get type-checking against this interface:
 *
 * ```ts
 * import type { Settings } from "@takazudo/zudo-doc/settings";
 * export const settings = { ... } satisfies Settings;
 * ```
 */
export interface Settings {
  colorScheme: string;
  colorMode: ColorModeConfig | false;
  siteName: string;
  siteDescription: string;
  base: string;
  trailingSlash: boolean;
  docsDir: string;
  defaultLocale: string;
  locales: Record<string, LocaleConfig>;
  mermaid: boolean;
  noindex: boolean;
  editUrl: string | false;
  githubUrl: string | false;
  /** "owner/repo" — enables `#123` / SHA autolinks in markdown. Omit or leave undefined to disable. */
  githubAutolinksRepo?: string;
  siteUrl: string;
  metaTags: MetaTagsConfig;
  /**
   * Site-wide custom `<head>` extras — see {@link SiteHeadConfig}.
   *
   * Optional. When absent (the common case), no extra elements are emitted and
   * the page output is byte-identical to the pre-2.0.1 baseline (the #2425
   * route-injection byte-hashes remain green).
   *
   * Note: the iframe-scoped `htmlPreview.head` ({@link HtmlPreviewConfig.head})
   * is unrelated to this field — it targets only the HTML-preview sandbox.
   */
  head?: SiteHeadConfig;
  sitemap: boolean;
  docMetainfo: boolean;
  docTags: boolean;
  tagPlacement: TagPlacement;
  tagGovernance: TagGovernanceMode;
  tagVocabulary: boolean;
  llmsTxt: boolean;
  math: boolean;
  cjkFriendly: boolean;
  onBrokenMarkdownLinks: "warn" | "error" | "ignore";
  aiAssistant: boolean;
  aiChatDemoMode: boolean;
  aiChatAllowedOrigins: string[];
  aiChatGlobalDailyLimit: number | false;
  designTokenPanel: boolean;
  tocMinDepth: number;
  tocMaxDepth: number;
  headingIdStrategy: "flat" | "hierarchical";
  sidebarResizer: boolean;
  sidebarToggle: boolean;
  imageEnlarge: boolean;
  dynamicPageTransition: boolean;
  frontmatterPreview: FrontmatterPreviewConfig | false;
  docHistory: boolean;
  bodyFootUtilArea: BodyFootUtilAreaConfig | false;
  htmlPreview: HtmlPreviewConfig | undefined;
  versions: VersionConfig[] | false;
  claudeResources: { claudeDir: string; projectRoot?: string } | false;
  defaultLocaleOnlyPrefixes: string[];
  footer: FooterConfig | false;
  headerNav: HeaderNavItem[];
  headerRightItems: HeaderRightItem[];
  /**
   * Build-time package-owned route injection (epic Package-First Finale #2356,
   * ADR `docs/adr/route-injection-seam.md`). When `true` (the **default** when
   * omitted — #2404), the preset adds the `@takazudo/zudo-doc/plugins/routes`
   * plugin, which injects the doc routes from the package instead of requiring
   * project-shipped `pages/*.tsx` stubs.
   *
   * Set explicitly to `false` only if your project ships its own `pages/*.tsx`
   * stubs for every doc route. Any injected route whose URL shape collides with
   * a kept `pages/` stub is silently dropped (user `pages/` wins), so existing
   * stubs are a harmless no-op if you later re-enable this.
   *
   * When `false` AND doc content is configured (`docsDir` non-empty and/or
   * locales/versions set), a single `console.warn` is emitted per build to
   * flag a potentially-empty build (#2404). No throw — the build succeeds.
   */
  packageOwnedRoutes?: boolean;
}
