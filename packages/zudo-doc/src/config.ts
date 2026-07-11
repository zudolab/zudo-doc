/**
 * `@takazudo/zudo-doc/config` — the single-entry config API (epic
 * zudolab/zudo-doc#2651, Wave 4 #2657).
 *
 * A generated project's ENTIRE configuration is:
 *
 * ```ts
 * // zfb.config.ts — the one config file
 * import { defineConfig } from "zfb/config";
 * import { zudoDoc } from "@takazudo/zudo-doc/config";
 *
 * export default defineConfig(zudoDoc({
 *   siteName: "My Docs",
 *   // …only the fields you chose; everything has a documented @default.
 * }));
 * ```
 *
 * `zudoDoc()` SHALLOW-merges the user's fields over {@link DEFAULT_SETTINGS} —
 * top-level fields only (`{ ...DEFAULT_SETTINGS, ...user }`). A supplied nested
 * object (e.g. `colorMode`, `metaTags`) REPLACES the default wholesale; it is
 * NOT deep-merged key-by-key. This is safe because every nested config type is
 * all-required-fields, so a caller supplying one supplies all of its fields.
 * `zudoDoc()` also supplies the Wave-3 package defaults
 * (`buildDocsSchema`/`directiveVocabulary`/`translations`/`colorSchemes`/tag
 * vocabulary) unless overridden, and returns a **complete `ZfbConfig`** — the
 * host spreads nothing.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * COMPOSITION MECHANISM (locked, #2653): JS object composition — NOT zfb-native
 * `presets:`. `zudoDoc()` builds the full `ZfbConfig` in JS and returns it
 * complete; the returned object carries **no `presets` field**. `zudoDocPreset()`
 * stays the internal fragment builder this calls (still exported at
 * `@takazudo/zudo-doc/preset` as an advanced escape hatch); its
 * collections/plugins/markdown logic is NOT reimplemented here.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * NODE-BUILTIN-FREE EVAL GRAPH (non-negotiable — guarded by a unit test)
 * ──────────────────────────────────────────────────────────────────────────
 * zfb evaluates the config module through esbuild with `--platform=neutral`
 * (mirrors zfb's `loader.rs:277`); a transitive `node:*` import fails the load.
 * `zudoDoc()` is the new central node in that eval graph — it transitively pulls
 * in `preset.ts` plus every #2654 default module — so this module and all of
 * them MUST stay free of `node:*` builtins. `zod` is the only allowed runtime
 * dependency on this path (a required peer). The `ZfbConfig`/`BundleConfig`
 * imports from `@takazudo/zfb/config` are **type-only** (erased before esbuild
 * resolution), so they add nothing to the eval graph. The guard lives in
 * `src/__tests__/foundation-eval-graph.test.ts` (`config.ts` is in
 * `NODE_FREE_MODULES`).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * SERIALIZABILITY SPLIT
 * ──────────────────────────────────────────────────────────────────────────
 * The non-serializable / data overrides (`buildDocsSchema` fn, `colorSchemes`,
 * `translations`, `directives`, `tagVocabularyEntries`) and the shell fields
 * (`port`/`adapter`/`bundle`) are peeled off `user` up front so they never leak
 * into the merged `settings` object — only clean, JSON-serializable settings
 * ride into the routes plugin's virtual-module payload (exactly as
 * `zudoDocPreset()` does today). The function-valued/data overrides travel the
 * import-graph side (passed as `zudoDocPreset()` arguments, not serialized).
 */

import type { ZfbConfig, BundleConfig } from "@takazudo/zfb/config";
import type { ZodType } from "zod";

import { zudoDocPreset } from "./preset.js";
import type {
  DirectiveVocabulary,
  PresetTranslations,
  PresetTagVocabularyEntry,
} from "./preset.js";
import type { ColorScheme } from "./color-scheme-utils.js";
import type {
  Settings,
  ColorModeConfig,
  LocaleConfig,
  MetaTagsConfig,
  SiteHeadConfig,
  TagPlacement,
  TagGovernanceMode,
  VersionConfig,
  FooterConfig,
  HeaderNavItem,
  HeaderRightItem,
  FrontmatterPreviewConfig,
  BodyFootUtilAreaConfig,
  HtmlPreviewConfig,
} from "./settings.js";

import { buildDocsSchema as defaultBuildDocsSchema } from "./docs-schema/index.js";
import { defaultDirectiveVocabulary } from "./directive-vocabulary-defaults/index.js";
import { defaultTranslations } from "./i18n-defaults/index.js";
import { defaultColorSchemes } from "./color-schemes-defaults/index.js";

/** The `settings.claudeResources` block (or `false` when disabled). */
type ClaudeResourcesConfig =
  | { claudeDir: string; projectRoot?: string; scanRoot?: string }
  | false;

// ---------------------------------------------------------------------------
// DEFAULT_SETTINGS — the documented default for EVERY serializable settings
// field. `zudoDoc()` merges user fields over these per-field (user wins). Every
// value here is the same default that the matching `ZudoDocConfig` field's
// `@default` JSDoc records. Kept as a complete `Settings` object so the routes
// plugin's virtual-module payload is fully populated for zero-override users.
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: Settings = {
  colorScheme: "Default Dark",
  colorMode: {
    defaultMode: "dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    respectPrefersColorScheme: true,
  },
  siteName: "Docs",
  siteDescription: "",
  base: "/",
  trailingSlash: false,
  minifyHtml: true,
  docsDir: "src/content/docs",
  defaultLocale: "en",
  locales: {},
  mermaid: true,
  noindex: false,
  editUrl: false,
  githubUrl: false,
  siteUrl: "",
  metaTags: {
    description: true,
    keywords: false,
    ogImage: false,
    ogSiteName: true,
    twitterCard: false,
  },
  sitemap: false,
  docMetainfo: false,
  docTags: false,
  tagPlacement: "after-title",
  tagGovernance: "off",
  tagVocabulary: false,
  llmsTxt: false,
  changelogs: false,
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
  findInPage: false,
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
  headerRightItems: [{ type: "component", component: "theme-toggle" }],
  packageOwnedRoutes: true,
};

// ---------------------------------------------------------------------------
// ZudoDocConfig — the single user-facing settings reference. Every field is
// OPTIONAL and carries a `@default` JSDoc (this type IS the IDE-hover
// documentation the docs pages align with). A test
// (`config-jsdoc.test.ts`) enforces that every field carries `@default`.
// ---------------------------------------------------------------------------

export interface ZudoDocConfig {
  // ── Serializable settings fields ─────────────────────────────────────────

  /**
   * Active color scheme name (must exist in `colorSchemes`).
   * @default "Default Dark"
   */
  colorScheme?: string;
  /**
   * Light/dark mode wiring, or `false` for a single fixed scheme.
   * @default { defaultMode: "dark", lightScheme: "Default Light", darkScheme: "Default Dark", respectPrefersColorScheme: true }
   */
  colorMode?: ColorModeConfig | false;
  /**
   * Site name shown in the header and metadata. The one field you almost
   * always set.
   * @default "Docs"
   */
  siteName?: string;
  /**
   * Site description used in metadata (`<meta name="description">`, llms.txt).
   * @default ""
   */
  siteDescription?: string;
  /**
   * Public URL sub-path prefix mounted in front of every absolute asset URL
   * (e.g. `"/pj/my-site/"`). `"/"` = root-mounted.
   * @default "/"
   */
  base?: string;
  /**
   * Append a trailing `/` to extensionless internal hrefs.
   * @default false
   */
  trailingSlash?: boolean;
  /**
   * Minify production HTML output from `zfb build`.
   * @default true
   */
  minifyHtml?: boolean;
  /**
   * Directory (project-root-relative) holding the default-locale docs.
   * @default "src/content/docs"
   */
  docsDir?: string;
  /**
   * Default locale code (unprefixed routes).
   * @default "en"
   */
  defaultLocale?: string;
  /**
   * Additional locales: code → `{ label, dir }`. Each becomes a
   * `/<code>/docs/…` route tree + `docs-<code>` collection.
   * @default {}
   */
  locales?: Record<string, LocaleConfig>;
  /**
   * Enable mermaid diagram rendering in markdown.
   * @default true
   */
  mermaid?: boolean;
  /**
   * Add `noindex,nofollow` to every page (for internal docs).
   * @default false
   */
  noindex?: boolean;
  /**
   * "Edit this page" link base, or `false` to omit.
   * @default false
   */
  editUrl?: string | false;
  /**
   * GitHub repository URL shown in the header, or `false` to omit.
   * @default false
   */
  githubUrl?: string | false;
  /**
   * "owner/repo" — enables `#123` / SHA autolinks in markdown. Omit to disable.
   * @default undefined
   */
  githubAutolinksRepo?: string;
  /**
   * Canonical site origin (e.g. `"https://example.com"`) for sitemap /
   * canonical / og:url. Empty = not set.
   * @default ""
   */
  siteUrl?: string;
  /**
   * `<meta>` / OpenGraph / Twitter-card emission toggles.
   * @default { description: true, keywords: false, ogImage: false, ogSiteName: true, twitterCard: false }
   */
  metaTags?: MetaTagsConfig;
  /**
   * Site-wide custom `<head>` extras (preconnect / preload / stylesheets /
   * meta / alternateLinks). Omit to emit nothing extra.
   * @default undefined
   */
  head?: SiteHeadConfig;
  /**
   * Emit a sitemap route.
   * @default false
   */
  sitemap?: boolean;
  /**
   * Show the Created/Updated/Author meta block on doc pages.
   * @default false
   */
  docMetainfo?: boolean;
  /**
   * Enable the `/docs/tags` + `/docs/tags/[tag]` tag index routes.
   * @default false
   */
  docTags?: boolean;
  /**
   * Where per-page tags render relative to the content.
   * @default "after-title"
   */
  tagPlacement?: TagPlacement;
  /**
   * Tag-governance enforcement level when the vocabulary is consulted.
   * @default "off"
   */
  tagGovernance?: TagGovernanceMode;
  /**
   * Whether the tag vocabulary is consulted at runtime (alias resolution,
   * deprecation filtering, grouped footer). Orthogonal to `tagGovernance`.
   * The vocabulary ENTRIES are supplied separately via `tagVocabularyEntries`.
   * @default false
   */
  tagVocabulary?: boolean;
  /**
   * Emit an `llms.txt` route summarising the docs.
   * @default false
   */
  llmsTxt?: boolean;
  /**
   * Changelog generation config(s), or `false` to disable.
   * @default false
   */
  changelogs?: Settings["changelogs"];
  /**
   * Enable KaTeX math rendering in markdown.
   * @default false
   */
  math?: boolean;
  /**
   * Enable zfb's CJK-friendly line-break / emphasis handling.
   * @default false
   */
  cjkFriendly?: boolean;
  /**
   * What to do when a `.md`/`.mdx` link cannot be resolved.
   * @default "warn"
   */
  onBrokenMarkdownLinks?: "warn" | "error" | "ignore";
  /**
   * Enable the AI-chat assistant route (`/api/ai-chat`, SSR).
   * @default false
   */
  aiAssistant?: boolean;
  /**
   * Short-circuit `/api/ai-chat` with a fixed "disabled" reply (no API key /
   * KV / rate limiter touched).
   * @default false
   */
  aiChatDemoMode?: boolean;
  /**
   * Allowed CORS origins for `/api/ai-chat` when not in demo mode. Empty =
   * block all cross-origin browser requests.
   * @default []
   */
  aiChatAllowedOrigins?: string[];
  /**
   * Global daily request ceiling across all IPs for `/api/ai-chat`, or `false`
   * to disable the ceiling.
   * @default false
   */
  aiChatGlobalDailyLimit?: number | false;
  /**
   * Enable the interactive Design Token Panel (zdtp).
   * @default false
   */
  designTokenPanel?: boolean;
  /**
   * Minimum heading depth included in the TOC (2–4).
   * @default 2
   */
  tocMinDepth?: number;
  /**
   * Maximum heading depth included in the TOC (2–4).
   * @default 4
   */
  tocMaxDepth?: number;
  /**
   * Heading-ID (anchor) strategy. `"hierarchical"` prefixes each anchor with
   * its ancestor chain; `"flat"` is zfb's legacy github-slugger scheme.
   * @default "hierarchical"
   */
  headingIdStrategy?: "flat" | "hierarchical";
  /**
   * Enable the draggable sidebar resizer.
   * @default false
   */
  sidebarResizer?: boolean;
  /**
   * Enable the desktop sidebar collapse toggle.
   * @default false
   */
  sidebarToggle?: boolean;
  /**
   * Enable click-to-enlarge for content images.
   * @default false
   */
  imageEnlarge?: boolean;
  /**
   * Mount the `FindInPageInit` island (Cmd/Ctrl+F find bar). Self-gates on
   * `window.__TAURI_INTERNALS__`, so it is a safe no-op outside a Tauri
   * shell even when `true`.
   * @default false
   */
  findInPage?: boolean;
  /**
   * Enable the dynamic (view-transition) page-loading overlay.
   * @default false
   */
  dynamicPageTransition?: boolean;
  /**
   * Frontmatter-preview config (ignore-key overrides), or `false` to disable
   * the preview panel.
   * @default false
   */
  frontmatterPreview?: FrontmatterPreviewConfig | false;
  /**
   * Enable per-page git history (Created/Updated + dropdown).
   * @default false
   */
  docHistory?: boolean;
  /**
   * Body-foot utility area (doc-history / view-source), or `false` to disable.
   * @default false
   */
  bodyFootUtilArea?: BodyFootUtilAreaConfig | false;
  /**
   * Global HTML-preview sandbox config, or `undefined` to disable.
   * @default undefined
   */
  htmlPreview?: HtmlPreviewConfig | undefined;
  /**
   * Docs versions, or `false` for a single (unversioned) doc set.
   * @default false
   */
  versions?: VersionConfig[] | false;
  /**
   * Claude-resources ingestion config, or `false` to disable.
   * @default false
   */
  claudeResources?: ClaudeResourcesConfig;
  /**
   * Route prefixes served only in the default locale (never locale-prefixed).
   * @default []
   */
  defaultLocaleOnlyPrefixes?: string[];
  /**
   * Footer config (link columns / copyright / taglist), or `false` for no
   * footer.
   * @default false
   */
  footer?: FooterConfig | false;
  /**
   * Primary header navigation items.
   * @default []
   */
  headerNav?: HeaderNavItem[];
  /**
   * Header right-hand-side items (toggles, switchers, links).
   * @default [{ type: "component", component: "theme-toggle" }]
   */
  headerRightItems?: HeaderRightItem[];
  /**
   * Build-time package-owned route injection. When `true`, doc routes are
   * injected from the package (no project-shipped `pages/*.tsx` stubs needed).
   * Set `false` only if your project ships its own doc-route stubs.
   * @default true
   */
  packageOwnedRoutes?: boolean;
  /**
   * Project-root-relative path to a host module exporting
   * `chromeBindings: ChromeHostBindings` (only consumed when
   * `packageOwnedRoutes` is on). Omit to keep the injected chrome shim at its
   * package-default stubs.
   * @default undefined
   */
  chromeBindingsModule?: string;
  /**
   * Project-root-relative path to a host module exporting a named
   * `buildDesignTokenPanelConfig(mode: "light" | "dark")` zdtp `PanelConfig`
   * builder (only consumed when `packageOwnedRoutes` is on, and only relevant
   * when `designTokenPanel` is `true`). When omitted, the panel uses the
   * package-default builder (`@takazudo/zudo-doc/design-token-panel-config`)
   * — derived from the shipped token manifest and the bundled color schemes —
   * so `designTokenPanel: true` works with no host config file. Point this at
   * your own module only when you need a fully custom panel (your own token
   * manifest, your own color schemes).
   * @default undefined (package-default builder is used)
   */
  designTokenPanelConfigModule?: string;

  // ── Escape hatches (non-serializable / data overrides) ───────────────────

  /**
   * Replace the default docs-frontmatter zod schema builder entirely. When
   * omitted, `zudoDoc()` builds the default schema
   * (`@takazudo/zudo-doc/docs-schema`), governance-aware from `tagGovernance`
   * + `tagVocabularyEntries`.
   * @default undefined (package default `buildDocsSchema` is used)
   */
  buildDocsSchema?: () => ZodType;
  /**
   * Override the color-scheme palette map. When omitted, the two shipped
   * schemes (`@takazudo/zudo-doc/color-schemes-defaults` — Default Light /
   * Default Dark) are used.
   * @default undefined (`defaultColorSchemes` is used)
   */
  colorSchemes?: Record<string, ColorScheme>;
  /**
   * Override the UI-string translation table. When omitted, the shipped
   * en/ja/de defaults (`@takazudo/zudo-doc/i18n-defaults`) are used.
   * @default undefined (`defaultTranslations` is used)
   */
  translations?: PresetTranslations;
  /**
   * Override the directive → JSX-component-name map (`markdown.features.directives`).
   * When omitted, the canonical seven
   * (`@takazudo/zudo-doc/directive-vocabulary-defaults`) are used.
   * @default undefined (`defaultDirectiveVocabulary` is used)
   */
  directives?: DirectiveVocabulary;
  /**
   * The tag-vocabulary ENTRIES array (distinct from the boolean `tagVocabulary`
   * gate). Threaded into the route-context virtual module and consulted by the
   * governance-aware default schema builder.
   * @default []
   */
  tagVocabularyEntries?: readonly PresetTagVocabularyEntry[];

  // ── Shell passthrough fields ─────────────────────────────────────────────

  /**
   * Dev/preview server port.
   * @default 4321
   */
  port?: number;
  /**
   * Deploy-target adapter package name (e.g.
   * `"@takazudo/zfb-adapter-cloudflare"`). Omit for a pure static build.
   * @default undefined (pure static build)
   */
  adapter?: string;
  /**
   * zfb bundler options (`exclude` / `mainFields` / `external`) — passed
   * through verbatim when set.
   * @default undefined
   */
  bundle?: BundleConfig;
}

// ---------------------------------------------------------------------------
// zudoDoc — the documented single-entry API.
// ---------------------------------------------------------------------------

/**
 * Build a complete `ZfbConfig` from user config, defaulting every field.
 *
 * ```ts
 * export default defineConfig(zudoDoc({ siteName: "My Docs" }));
 * ```
 *
 * @param user Partial config; every field has a documented default. See
 *   {@link ZudoDocConfig}.
 * @returns A complete `ZfbConfig` — spread nothing; pass it straight to
 *   `defineConfig`.
 */
export function zudoDoc(user: ZudoDocConfig = {}): ZfbConfig {
  // Peel the non-serializable / data overrides and shell fields off `user`
  // first so they never pollute the merged `settings` object (which is
  // JSON-serialized into the routes plugin's virtual module). `settingsOverrides`
  // is the remaining serializable subset merged over DEFAULT_SETTINGS.
  const {
    port,
    adapter,
    bundle,
    buildDocsSchema: userBuildDocsSchema,
    colorSchemes: userColorSchemes,
    translations: userTranslations,
    directives: userDirectives,
    tagVocabularyEntries: userTagVocabularyEntries,
    ...settingsOverrides
  } = user;

  // Shallow (top-level) merge, user wins. A supplied nested object (colorMode,
  // metaTags, footer, …) replaces the default wholesale — not deep-merged.
  // Safe because nested config types are all-required-field. `settingsOverrides`
  // is a Partial<Settings>.
  const settings: Settings = { ...DEFAULT_SETTINGS, ...settingsOverrides };

  const fragment = zudoDocPreset({
    settings,
    buildDocsSchema:
      userBuildDocsSchema ??
      (() =>
        defaultBuildDocsSchema({
          tagGovernance: settings.tagGovernance,
          tagVocabulary: userTagVocabularyEntries,
        })),
    directiveVocabulary: userDirectives ?? defaultDirectiveVocabulary,
    translations: userTranslations ?? defaultTranslations,
    colorSchemes: userColorSchemes ?? defaultColorSchemes,
    tagVocabulary: userTagVocabularyEntries ?? [],
  });

  return {
    // ── Host-owned shell fields ──────────────────────────────────────────
    framework: "preact",
    port: port ?? 4321,
    tailwind: { enabled: true },
    base: settings.base,
    ...(adapter ? { adapter } : {}),
    ...(bundle ? { bundle } : {}),

    // ── Preset-owned fields (collections, plugins, markdown, …) ──────────
    ...fragment,
    // The preset's `markdown.features` intentionally uses the loose Record
    // shape (the exact shape zfb's config shim binds against); the engine's
    // strict `MarkdownFeaturesConfig` is a structural subset of it. Every
    // other preset field type-checks against `ZfbConfig` directly, so only
    // `markdown` needs this single documented bridge — `satisfies ZfbConfig`
    // below keeps full strict checking on all the rest.
    markdown: fragment.markdown as ZfbConfig["markdown"],
  } satisfies ZfbConfig;
}
