/**
 * `@takazudo/zudo-doc/preset` — the package-first config preset.
 *
 * `zudoDocPreset()` returns the zfb config fragment that every zudo-doc
 * project previously hand-wrote in its `zfb.config.ts` (collections loop,
 * markdown.features, class-mode codeHighlight, resolveMarkdownLinks,
 * stripMdExt, trailingSlash, minifyHtml, and the integration plugins array). The host
 * config spreads this fragment into `defineConfig` and supplies only the
 * project-specific shell fields it still owns (`framework`, `port`,
 * `tailwind`, `bundle`, `base`, `adapter`).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * NODE-BUILTIN-FREE EVAL GRAPH (non-negotiable — guarded by a unit test)
 * ──────────────────────────────────────────────────────────────────────────
 * zfb evaluates the config module through esbuild with `--platform=neutral`
 * (mirrors zfb's `loader.rs:277`); a transitive `node:*` import fails the
 * load. This preset is the central node in that eval graph, so it MUST stay
 * free of `node:*` builtins:
 *
 *   - The signature takes `buildDocsSchema` and `directiveVocabulary` as
 *     INPUTS rather than importing the project's `src/config/*` singletons.
 *     Those singletons (`settings`, `tag-vocabulary`, `docs-schema`) are
 *     already pulled into the config eval at the call site; re-importing them
 *     here would (a) double-import the singletons and (b) risk dragging a
 *     `node:*` dependency into this module's own import graph.
 *   - Plugins are emitted as **bare-specifier descriptors**
 *     (`{ name: "@takazudo/zudo-doc/plugins/<x>", options }`), NEVER imported
 *     plugin functions. zfb's plugin runtime loads each `name` as a module
 *     specifier and dispatches lifecycle hooks against it; importing the
 *     plugin modules here would pull their `node:fs` / `node:path` graph into
 *     the config eval.
 *   - The only runtime dependency is `zod` (for `z.toJSONSchema`), which
 *     bundles cleanly under `--platform=neutral` (verified: zero `node:*`).
 */

import { z } from "zod";
import type { ColorScheme } from "./color-scheme-utils.js";
import type { TagVocabularyEntry } from "./settings.js";

// ---------------------------------------------------------------------------
// Input contract — structurally typed so the preset is portable to every
// `create-zudo-doc`-generated project, not coupled to this repo's exact
// `typeof settings`. Only the fields the preset actually reads are declared.
// ---------------------------------------------------------------------------

/** A single locale's content directory (`settings.locales[code]`). */
export interface PresetLocaleConfig {
  dir: string;
}

/** A single docs version (`settings.versions[n]`). */
export interface PresetVersionConfig {
  slug: string;
  docsDir: string;
  locales?: Record<string, { dir: string }>;
}

/** The `settings.claudeResources` block (or `false` when disabled). */
export interface PresetClaudeResourcesConfig {
  claudeDir: string;
  projectRoot?: string;
  /**
   * Root for `CLAUDE.md` discovery; defaults to `projectRoot`. Decouples
   * repo-wide scanning from the output base for subdirectory doc sites (#2558).
   */
  scanRoot?: string;
}

export interface PresetChangelogConfig {
  sourceDir: string;
  outputFile: string;
  packageName?: string;
  title?: string;
}

/**
 * The subset of `settings` the preset reads. Any concrete `typeof settings`
 * (this repo's or a generated project's) is assignable to this — the preset
 * only consumes these fields.
 */
export interface PresetSettings {
  docsDir: string;
  locales: Record<string, PresetLocaleConfig>;
  versions?: PresetVersionConfig[] | false;
  base: string;
  siteName: string;
  siteDescription: string;
  siteUrl: string;
  trailingSlash: boolean;
  minifyHtml?: boolean;
  mermaid: boolean;
  onBrokenMarkdownLinks: "warn" | "error" | "ignore";
  llmsTxt?: boolean;
  changelogs?: PresetChangelogConfig[] | false;
  docHistory?: boolean;
  claudeResources?: PresetClaudeResourcesConfig | false;
  /** "owner/repo" — when set, enables `#123` / SHA autolinks in markdown. Omit to disable entirely. */
  githubAutolinksRepo?: string;
  /**
   * When `true` (the **default** when omitted — #2404), the preset adds the
   * package-owned route-injection plugin (`@takazudo/zudo-doc/plugins/routes`).
   * Set explicitly to `false` to opt out — only needed for projects shipping
   * their own `pages/*.tsx` stubs for every doc route. When `false` AND doc
   * content is configured (`docsDir` non-empty and/or locales/versions set),
   * a single `console.warn` is emitted per build as a heads-up (the build
   * succeeds). See `docs/adr/route-injection-seam.md`. (#2404)
   */
  packageOwnedRoutes?: boolean;
  /**
   * Project-root-relative path to a host module exporting a named
   * `chromeBindings: ChromeHostBindings` (from `@takazudo/zudo-doc/factory-context`).
   * Only consumed when `packageOwnedRoutes` is on — see `settings.ts` and
   * `docs/adr/route-injection-seam.md` ("Host-callables channel") for the
   * full contract. Omit to keep the injected chrome shim's bindings at their
   * package-default stubs (byte-identical to today).
   */
  chromeBindingsModule?: string;
  /**
   * Project-root-relative path to a host module exporting a named
   * `buildDesignTokenPanelConfig(mode: "light" | "dark")` (#2658). Only
   * consumed when `packageOwnedRoutes` is on and `designTokenPanel` is true
   * — see `settings.ts` for the full contract. Omit to use the package
   * default design-token-panel config (derived from the shipped token
   * manifest + bundled color schemes).
   */
  designTokenPanelConfigModule?: string;
  /** Gate for the `/docs/tags` + `/docs/tags/[tag]` injected routes. */
  docTags?: boolean;
  /** Gate for the SSR `/api/ai-chat` injected route (`prerender: false`). */
  aiAssistant?: boolean;
  /** When `false`, disables zfb's CJK-friendly line-break behaviour.
   *  Absent means "use the engine default" (currently `true`). */
  cjkFriendly?: boolean;
  /**
   * Active theme pack slug (ADR docs/adr/theme-packs.md, Decision 2/7).
   * Threaded into the `@takazudo/zudo-doc/plugins/theme-packs` descriptor's
   * options; the plugin's `setup()` validates it against the resolved
   * registry and throws loudly on an unknown slug. Omit to use the package
   * default (`"default"`).
   */
  themePack?: string;
  /**
   * Enabled pack slugs, in switcher order (ADR Decision 7). `undefined` = all
   * bundled packs. Threaded into the `@takazudo/zudo-doc/plugins/theme-packs`
   * descriptor's options alongside `themePack`.
   */
  themePacks?: string[];
}

/**
 * The directives recipe map (`markdown.features.directives`): directive name →
 * the JSX component name it resolves to (registered in the host's
 * `pages/_mdx-components.ts`). Passed in rather than hardcoded so a project can
 * register its own directives without editing the preset; the showcase passes
 * the canonical seven (note/tip/info/warning/danger/caution/details).
 */
export type DirectiveVocabulary = Record<string, string>;

/**
 * The UI-string translation table (`src/config/i18n.ts` `translations`).
 * Locale code → key → translated string. Passed (not imported) so the preset's
 * import graph stays node-builtin-free; rides into the route-context virtual
 * module verbatim when `packageOwnedRoutes` is on. Optional — only consumed by
 * the routes plugin; omitting it makes the virtual module carry `{}`.
 */
export type PresetTranslations = Record<string, Record<string, string>>;

/**
 * The tag vocabulary entries (`src/config/tag-vocabulary.ts`). Serializable
 * data, threaded into the route-context virtual module when
 * `packageOwnedRoutes` is on. Optional — only consumed by the routes plugin.
 */
export type PresetTagVocabularyEntry = TagVocabularyEntry;

/** Arguments to `zudoDocPreset`. */
export interface ZudoDocPresetArgs {
  /** The project's `settings` object (structurally `PresetSettings`). */
  settings: PresetSettings;
  /**
   * The project's `buildDocsSchema` — the zod schema builder from
   * `src/config/docs-schema.ts`. Passed (not imported) so the preset never
   * re-imports the project's `settings` / `tag-vocabulary` singletons, keeping
   * this module's import graph node-builtin-free. Called once; the result is
   * converted to JSON Schema and reused for every collection.
   */
  buildDocsSchema: () => z.ZodType;
  /**
   * The directives recipe map. See {@link DirectiveVocabulary}.
   */
  directiveVocabulary: DirectiveVocabulary;
  /**
   * The host's UI-string translation table. Only consumed when
   * `settings.packageOwnedRoutes` is true (rides into the route-context virtual
   * module). Optional — defaults to `{}`. See {@link PresetTranslations}.
   */
  translations?: PresetTranslations;
  /**
   * The host's tag vocabulary entries. Only consumed when
   * `settings.packageOwnedRoutes` is true. Optional — defaults to `[]`.
   */
  tagVocabulary?: readonly PresetTagVocabularyEntry[];
  /**
   * The host's color-scheme palette map (`src/config/color-schemes.ts`
   * `colorSchemes`). Only consumed when `settings.packageOwnedRoutes` is true
   * — rides into the route-context virtual module so the package-owned routes
   * (incl. `/404`) can emit the correct `--zd-*` CSS custom properties.
   *
   * Serializable JSON (ColorScheme has no function-valued fields), so it
   * round-trips through `JSON.stringify` losslessly.
   *
   * Optional — when absent, package-owned routes fall back to `DEFAULT_SCHEME`
   * (a neutral grey ramp). See `routes/_chrome.tsx`.
   */
  colorSchemes?: Record<string, ColorScheme>;
}

// ---------------------------------------------------------------------------
// Return-fragment shapes — mirror the relevant `ZfbConfig` fields. Kept local
// (not imported from `zfb/config`) so the preset has no value-level dependency
// on the engine package; the host's `defineConfig` enforces the real types
// when the fragment is spread in.
// ---------------------------------------------------------------------------

export interface PresetCollection {
  name: string;
  path: string;
  schema: Record<string, unknown>;
}

export interface PresetPlugin {
  name: string;
  options?: Record<string, unknown>;
}

export interface PresetResolveMarkdownLinks {
  enabled: boolean;
  dirs: Array<{ dir: string; routePrefix: string }>;
  onBrokenLinks: "warn" | "error" | "ignore";
}

export interface PresetMarkdown {
  features: Record<string, boolean | Record<string, unknown>>;
  cjkFriendly?: boolean;
}

export interface PresetCodeHighlight {
  mode: "class";
  defaultStylesheet: true;
}

/** The config fragment returned by {@link zudoDocPreset}. */
export interface ZudoDocPresetResult {
  collections: PresetCollection[];
  plugins: PresetPlugin[];
  markdown: PresetMarkdown;
  codeHighlight: PresetCodeHighlight;
  resolveMarkdownLinks: PresetResolveMarkdownLinks;
  stripMdExt: boolean;
  trailingSlash: boolean;
  minifyHtml: boolean;
}

// ---------------------------------------------------------------------------
// Preset.
// ---------------------------------------------------------------------------

/**
 * Build the zudo-doc zfb config fragment from project settings.
 *
 * Spread the result into `defineConfig`:
 *
 * ```ts
 * export default defineConfig({
 *   framework: "preact",
 *   port: 4321,
 *   tailwind: { enabled: true },
 *   bundle: { exclude: [...] },
 *   base: settings.base,
 *   adapter: "@takazudo/zfb-adapter-cloudflare",
 *   ...zudoDocPreset({ settings, buildDocsSchema, directiveVocabulary }),
 * });
 * ```
 */
export function zudoDocPreset({
  settings,
  buildDocsSchema,
  directiveVocabulary,
  translations,
  tagVocabulary,
  colorSchemes,
}: ZudoDocPresetArgs): ZudoDocPresetResult {
  // `z.toJSONSchema` is a runtime call but the result is a stable JSON
  // document. Compute it once and reuse the same object across every
  // collection definition.
  const docsSchemaJson = z.toJSONSchema(buildDocsSchema()) as Record<string, unknown>;

  return {
    collections: buildCollections(settings, docsSchemaJson),
    plugins: buildPlugins(settings, { translations, tagVocabulary, colorSchemes }),
    markdown: {
      features: buildMarkdownFeatures(settings, directiveVocabulary),
      ...(settings.cjkFriendly !== undefined ? { cjkFriendly: settings.cjkFriendly } : {}),
    },
    // zfb class mode keeps renderer output semantic and delegates color to
    // the package's --zfb-hi-* → --zd-syntax-* CSS adapter. Keep the upstream
    // layered stylesheet enabled as the fallback beneath zudo's unlayered CSS.
    codeHighlight: {
      mode: "class",
      defaultStylesheet: true,
    },
    resolveMarkdownLinks: buildResolveMarkdownLinks(settings),
    // Strip `.md` / `.mdx` from in-page `<a href>` so author-written
    // `[label](./other.mdx)` references resolve to the rendered route URL.
    stripMdExt: true,
    trailingSlash: settings.trailingSlash,
    minifyHtml: settings.minifyHtml ?? true,
  };
}

// ---------------------------------------------------------------------------
// Collections — default English + per-locale + per-version (+ version locales).
// ---------------------------------------------------------------------------

function buildCollections(
  settings: PresetSettings,
  docsSchemaJson: Record<string, unknown>,
): PresetCollection[] {
  const collections: PresetCollection[] = [];

  // Default English collection.
  collections.push({ name: "docs", path: settings.docsDir, schema: docsSchemaJson });

  // Per-locale collections (e.g. `docs-ja`).
  for (const [code, config] of Object.entries(settings.locales)) {
    collections.push({ name: `docs-${code}`, path: config.dir, schema: docsSchemaJson });
  }

  // Per-version collections (and their locale variants), if configured.
  if (settings.versions) {
    for (const version of settings.versions) {
      collections.push({
        name: `docs-v-${version.slug}`,
        path: version.docsDir,
        schema: docsSchemaJson,
      });
      if (version.locales) {
        for (const [code, config] of Object.entries(version.locales)) {
          collections.push({
            name: `docs-v-${version.slug}-${code}`,
            path: config.dir,
            schema: docsSchemaJson,
          });
        }
      }
    }
  }

  return collections;
}

// ---------------------------------------------------------------------------
// resolveMarkdownLinks — maps each source dir to its route prefix so JA
// mirrors resolve under `/ja/docs/` and versioned dirs under `/v/<slug>/...`.
// ---------------------------------------------------------------------------

function buildResolveMarkdownLinks(settings: PresetSettings): PresetResolveMarkdownLinks {
  return {
    enabled: true,
    dirs: [
      { dir: settings.docsDir, routePrefix: "/docs/" },
      ...Object.entries(settings.locales).map(([code, locale]) => ({
        dir: locale.dir,
        routePrefix: `/${code}/docs/`,
      })),
      // Versioned collections: each version's EN dir + per-locale dirs.
      ...(settings.versions
        ? settings.versions.flatMap((version) => [
            { dir: version.docsDir, routePrefix: `/v/${version.slug}/docs/` },
            ...Object.entries(version.locales ?? {}).map(([code, locale]) => ({
              dir: locale.dir,
              routePrefix: `/v/${version.slug}/${code}/docs/`,
            })),
          ])
        : []),
    ],
    onBrokenLinks: settings.onBrokenMarkdownLinks,
  };
}

// ---------------------------------------------------------------------------
// markdown.features — the full opt-in block. The two settings-driven knobs are
// `directives` (the passed-in vocabulary) and `mermaid`; everything else is a
// fixed contract for the zudo-doc markdown pipeline.
// ---------------------------------------------------------------------------

function buildMarkdownFeatures(
  settings: PresetSettings,
  directiveVocabulary: DirectiveVocabulary,
): Record<string, boolean | Record<string, unknown>> {
  return {
    // Former-Core directives (next.25 generic `directives` map). Keys are
    // directive names, values are the JSX component names they resolve to
    // (registered in the host's pages/_mdx-components.ts).
    directives: { ...directiveVocabulary },
    mermaid: settings.mermaid,
    headingMarkerToc: true,
    // Remaining opt-in features (#1804).
    githubAlerts: true,
    readingTime: true,
    // owner/repo used to build `owner/repo#123`, `#123`, and SHA autolinks.
    // Included only when settings.githubAutolinksRepo is set; omitted entirely
    // for projects that don't configure a repo (restores old generated-project
    // behaviour — zudo-doc#2321 Wave-0 correctness fix).
    ...(settings.githubAutolinksRepo
      ? { githubAutolinks: { repo: settings.githubAutolinksRepo } }
      : {}),
    codeEnrichment: {},
    // codeTabs accepts the `true` shorthand; <CodeGroup> is registered host-side.
    codeTabs: true,
    // ruby — native `<ruby>` markup from `{base}^{ruby}` caret syntax.
    ruby: true,
    // tocExport — object-typed feature; `true` shorthand is rejected by the
    // Rust loader, so pass `{}`.
    tocExport: {},
    imageDimensions: {},
    // warn-only: failOnBroken=false never fails the build.
    linkValidation: { failOnBroken: false },
    // Hierarchical heading IDs are zudo-doc's sole contract. The host TOC
    // builder mirrors the same allocator so anchors match the rendered IDs.
    headingIds: { strategy: "hierarchical" },
  };
}

// ---------------------------------------------------------------------------
// Plugins — bare-specifier descriptors. zfb's plugin runtime loads each
// `name` as a module specifier and dispatches lifecycle hooks against it;
// these are descriptors, NOT imported functions (that would drag the plugins'
// `node:*` graph into the config eval). All 5 package-shipped plugins resolve
// against `@takazudo/zudo-doc/plugins/*` (relocated in S3). The copy-public
// workaround was removed — zfb >= 0.1.0-next.62 ships native `publicDir`
// (defaults to "public") which replaces it (#2358).
// ---------------------------------------------------------------------------

function buildPlugins(
  settings: PresetSettings,
  routeContext: {
    translations?: PresetTranslations;
    tagVocabulary?: readonly PresetTagVocabularyEntry[];
    colorSchemes?: Record<string, ColorScheme>;
  },
): PresetPlugin[] {
  const localeArray = Object.entries(settings.locales).map(([code, locale]) => ({
    code,
    dir: locale.dir,
  }));
  const localeRecord = Object.fromEntries(
    Object.entries(settings.locales).map(([code, locale]) => [code, { dir: locale.dir }]),
  );

  // Effective value: default-on (#2404 — fixes the silent empty build). An
  // omitted field is treated as `true`; explicit `false` stays the opt-out.
  const effectivePackageOwnedRoutes = settings.packageOwnedRoutes ?? true;

  // Build-time diagnostic (#2405): when packageOwnedRoutes is on but
  // translations/colorSchemes were not passed, emit ONE actionable warning so
  // consumers know their package-owned routes will render with fallback i18n /
  // grey theme. Emitted only when content is configured (i.e. the routes
  // actually render) and not the false-positive case of a bare config with no
  // docs. Do NOT inspect the filesystem here.
  if (effectivePackageOwnedRoutes) {
    const contentConfiguredForWarn =
      (typeof settings.docsDir === "string" && settings.docsDir.length > 0) ||
      Object.keys(settings.locales).length > 0 ||
      (Array.isArray(settings.versions) && settings.versions.length > 0);
    const translationsMissing =
      !routeContext.translations || Object.keys(routeContext.translations).length === 0;
    const colorSchemesMissing = !routeContext.colorSchemes;
    if (contentConfiguredForWarn && (translationsMissing || colorSchemesMissing)) {
      const missing = [
        ...(translationsMissing ? ["translations"] : []),
        ...(colorSchemesMissing ? ["colorSchemes"] : []),
      ].join(" and/or ");
      console.warn(
        `zudo-doc: packageOwnedRoutes is on but ${missing} were not passed to zudoDocPreset — ` +
          "package-owned routes (incl. /404) will render with fallback i18n/theme. " +
          "Pass them to inherit host bindings.",
      );
    }
  }

  // Build-time diagnostic (#2404): when routes are explicitly turned off AND
  // doc content is configured, emit a single actionable warning. Do NOT inspect
  // the filesystem — this runs inside the config eval; the node-free guard
  // (preset.test.ts) rejects any reachable `node:*` import.
  if (!effectivePackageOwnedRoutes) {
    const contentConfigured =
      (typeof settings.docsDir === "string" && settings.docsDir.length > 0) ||
      Object.keys(settings.locales).length > 0 ||
      (Array.isArray(settings.versions) && settings.versions.length > 0);
    if (contentConfigured) {
      console.warn(
        "zudo-doc: packageOwnedRoutes is off but doc content is configured — " +
          "no doc routes will be injected; the build will produce only host pages/. " +
          "Set packageOwnedRoutes: true in settings.",
      );
    }
  }

  return [
    // Package-owned route injection — default-on (#2404). The descriptor is a
    // BARE SPECIFIER, never an imported plugin function: the preset's node-free
    // eval-graph guard (preset.test.ts) bundles this module under
    // --platform=neutral, and importing the plugin would drag its
    // `injectRoute`/`node:*` graph into the config eval. The plugin's `setup`
    // hook reads `options` to (a) emit the route-context virtual module
    // (serializable settings/translations/tagVocabulary only) and (b) derive
    // the route catalog from `settings.locales` / `settings.versions`. Listed
    // FIRST so an injected route is registered before the other plugins'
    // preBuild work runs (ordering is cosmetic — injection happens in `setup`).
    ...(effectivePackageOwnedRoutes
      ? [
          {
            name: "@takazudo/zudo-doc/plugins/routes",
            options: {
              // Serializable project settings — JSON.stringify-d verbatim into
              // the virtual module. No function-valued fields (verified in
              // src/config/settings.ts), so it round-trips losslessly.
              settings: settings as unknown as Record<string, unknown>,
              translations: routeContext.translations ?? {},
              tagVocabulary: routeContext.tagVocabulary ?? [],
              colorSchemes: routeContext.colorSchemes ?? null,
            },
          },
        ]
      : []),
    ...(settings.claudeResources
      ? [
          {
            name: "@takazudo/zudo-doc/plugins/claude-resources",
            options: {
              claudeDir: settings.claudeResources.claudeDir,
              projectRoot: settings.claudeResources.projectRoot,
              scanRoot: settings.claudeResources.scanRoot,
              docsDir: settings.docsDir,
            },
          },
        ]
      : []),
    ...(settings.docHistory
      ? [
          {
            name: "@takazudo/zudo-doc/plugins/doc-history",
            options: {
              docsDir: settings.docsDir,
              locales: localeRecord,
              base: settings.base,
            },
          },
        ]
      : []),
    {
      name: "@takazudo/zudo-doc/plugins/search-index",
      options: {
        docsDir: settings.docsDir,
        locales: localeRecord,
        base: settings.base,
      },
    },
    // Theme packs (ADR docs/adr/theme-packs.md, Decision 2, #2820) — a
    // bare-specifier descriptor, added UNCONDITIONALLY like search-index
    // above (never an imported plugin function, keeping this preset's
    // node-free eval-graph guard green). The plugin internally no-ops
    // (postBuild/devMiddleware write/serve nothing) when the resolved
    // enabled set has no CSS-bearing pack (i.e. only "default" is enabled),
    // so an unconfigured project pays no asset cost beyond the bundled
    // registry scan at plugin setup.
    {
      name: "@takazudo/zudo-doc/plugins/theme-packs",
      options: {
        base: settings.base,
        themePack: settings.themePack,
        themePacks: settings.themePacks,
      },
    },
    ...(settings.llmsTxt
      ? [
          {
            name: "@takazudo/zudo-doc/plugins/llms-txt",
            options: {
              siteName: settings.siteName,
              siteDescription: settings.siteDescription,
              base: settings.base,
              siteUrl: settings.siteUrl,
              defaultLocaleDir: settings.docsDir,
              locales: localeArray,
            },
          },
        ]
      : []),
    ...(Array.isArray(settings.changelogs) && settings.changelogs.length > 0
      ? [
          {
            name: "@takazudo/zudo-doc/plugins/changelog",
            options: {
              changelogs: settings.changelogs.map((changelog) => ({ ...changelog })),
            },
          },
        ]
      : []),
  ];
}
