/**
 * `@takazudo/zudo-doc/preset` — the package-first config preset.
 *
 * `zudoDocPreset()` returns the zfb config fragment that every zudo-doc
 * project previously hand-wrote in its `zfb.config.ts` (collections loop,
 * markdown.features, dual-theme codeHighlight, resolveMarkdownLinks,
 * stripMdExt, trailingSlash, and the integration plugins array). The host
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
  mermaid: boolean;
  onBrokenMarkdownLinks: "warn" | "error" | "ignore";
  headingIdStrategy: "flat" | "hierarchical";
  llmsTxt?: boolean;
  docHistory?: boolean;
  claudeResources?: PresetClaudeResourcesConfig | false;
  /** "owner/repo" — when set, enables `#123` / SHA autolinks in markdown. Omit to disable entirely. */
  githubAutolinksRepo?: string;
  /** When `true`, the preset adds the package-owned route-injection plugin
   *  (`@takazudo/zudo-doc/plugins/routes`). On by default since the fast-follow
   *  (#2372): the showcase and create-zudo-doc both EMIT `packageOwnedRoutes: true`
   *  into their generated `settings.ts`. `buildPlugins` reads this value truthily
   *  and does NO central defaulting — a hand-written settings object that OMITS the
   *  field is treated as off; set it explicitly to control injection.
   *  See `docs/adr/route-injection-seam.md`. */
  packageOwnedRoutes?: boolean;
  /** Gate for the `/docs/tags` + `/docs/tags/[tag]` injected routes. */
  docTags?: boolean;
  /** Gate for the SSR `/api/ai-chat` injected route (`prerender: false`). */
  aiAssistant?: boolean;
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
export type PresetTagVocabularyEntry = {
  id: string;
  label?: string;
  description?: string;
  group?: string;
  aliases?: readonly string[];
  deprecated?: boolean | { redirect?: string };
};

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
}

export interface PresetCodeHighlight {
  themeLight: string;
  themeDark: string;
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
}: ZudoDocPresetArgs): ZudoDocPresetResult {
  // `z.toJSONSchema` is a runtime call but the result is a stable JSON
  // document. Compute it once and reuse the same object across every
  // collection definition.
  const docsSchemaJson = z.toJSONSchema(buildDocsSchema()) as Record<string, unknown>;

  return {
    collections: buildCollections(settings, docsSchemaJson),
    plugins: buildPlugins(settings, { translations, tagVocabulary }),
    markdown: { features: buildMarkdownFeatures(settings, directiveVocabulary) },
    // Dual-theme syntect (zfb >= 0.1.0-next.45). Theme names are SYNTECT
    // built-ins, NOT Shiki names. Tokens emit `--shiki-light`/`--shiki-dark`
    // CSS custom properties resolved by the host CSS via `light-dark()`, so
    // code follows the in-page light/dark switch with zero client JS.
    codeHighlight: {
      themeLight: "base16-ocean.light",
      themeDark: "base16-ocean.dark",
    },
    resolveMarkdownLinks: buildResolveMarkdownLinks(settings),
    // Strip `.md` / `.mdx` from in-page `<a href>` so author-written
    // `[label](./other.mdx)` references resolve to the rendered route URL.
    stripMdExt: true,
    trailingSlash: settings.trailingSlash,
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
    // Heading-ID strategy is the single source of truth in settings, mirrored
    // by the host TOC builder so anchors match the rendered IDs.
    headingIds: { strategy: settings.headingIdStrategy },
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
  },
): PresetPlugin[] {
  const localeArray = Object.entries(settings.locales).map(([code, locale]) => ({
    code,
    dir: locale.dir,
  }));
  const localeRecord = Object.fromEntries(
    Object.entries(settings.locales).map(([code, locale]) => [code, { dir: locale.dir }]),
  );

  return [
    // Package-owned route injection — dormant by default (Decision 4). The
    // descriptor is a BARE SPECIFIER, never an imported plugin function: the
    // preset's node-free eval-graph guard (preset.test.ts) bundles this module
    // under --platform=neutral, and importing the plugin would drag its
    // `injectRoute`/`node:*` graph into the config eval. The plugin's `setup`
    // hook reads `options` to (a) emit the route-context virtual module
    // (serializable settings/translations/tagVocabulary only) and (b) derive
    // the route catalog from `settings.locales` / `settings.versions`. Listed
    // FIRST so an injected route is registered before the other plugins'
    // preBuild work runs (ordering is cosmetic — injection happens in `setup`).
    ...(settings.packageOwnedRoutes
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
  ];
}
