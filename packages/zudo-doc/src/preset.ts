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
}

/**
 * The directives recipe map (`markdown.features.directives`): directive name →
 * the JSX component name it resolves to (registered in the host's
 * `pages/_mdx-components.ts`). Passed in rather than hardcoded so a project can
 * register its own directives without editing the preset; the showcase passes
 * the canonical seven (note/tip/info/warning/danger/caution/details).
 */
export type DirectiveVocabulary = Record<string, string>;

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
}: ZudoDocPresetArgs): ZudoDocPresetResult {
  // `z.toJSONSchema` is a runtime call but the result is a stable JSON
  // document. Compute it once and reuse the same object across every
  // collection definition.
  const docsSchemaJson = z.toJSONSchema(buildDocsSchema()) as Record<string, unknown>;

  return {
    collections: buildCollections(settings, docsSchemaJson),
    plugins: buildPlugins(settings),
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
// `node:*` graph into the config eval). The 5 package-shipped plugins resolve
// against `@takazudo/zudo-doc/plugins/*` (relocated in S3); copy-public stays
// project-relative (deleted in place in a later epic, not relocated).
// ---------------------------------------------------------------------------

function buildPlugins(settings: PresetSettings): PresetPlugin[] {
  const localeArray = Object.entries(settings.locales).map(([code, locale]) => ({
    code,
    dir: locale.dir,
  }));
  const localeRecord = Object.fromEntries(
    Object.entries(settings.locales).map(([code, locale]) => [code, { dir: locale.dir }]),
  );

  return [
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
    // copy-public stays a PROJECT-relative descriptor (NOT relocated in S3).
    // Native zfb copy_public_dir is not yet validated for base="/", so the
    // host plugin remains until that lands; deleted in place in a later epic.
    {
      name: "./plugins/copy-public-plugin.mjs",
      options: {
        publicDir: "public",
      },
    },
  ];
}
