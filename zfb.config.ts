/**
 * zfb pin (canonical, shared with E2/E4):
 *   commit: bdbfbfb (Takazudo/zudo-front-builder main, post-#170 hotfix:
 *           add node:async_hooks stub to embedded V8 v1 node:* list so
 *           consumer bundles that import @takazudo/zfb-adapter-cloudflare
 *           (AsyncLocalStorage) evaluate during SSG paths() step; on top of
 *           PR #170 fix/dev-cold-start-rebuild + PR #168 embed-v8 + PR #157
 *           basic-blog end-to-end fix; 2026-05-04)
 *   includes fixes:
 *     - zudolab/zfb#99  (ViewTransitions runtime + meta injection)
 *     - zudolab/zfb#100 (404 convention: emit dist/404.html at root)
 *     - zudolab/zfb#101 (plugin lifecycle hooks: preBuild, postBuild, devMiddleware)
 *     - zudolab/zfb#102 (CJK-aware emphasis/strong tokenisation in MDX pipeline)
 *     - zudolab/zfb#103 (ResolveLinksPlugin: probe extensionless candidates)
 *     - zudolab/zfb#104 (rehype output parity: heading-links, code-title, mermaid, image-enlarge, strip-md-ext)
 *     - zudolab/zfb#113 (tailwindcss v4 binary fetch script + ZFB_TAILWIND_BIN env var)
 *     - zudolab/zfb#118 (mdast-phase MDX pipeline wiring)
 *     - zudolab/zfb#121 (hast-phase MDX→JSX wiring)
 *     - zudolab/zfb#122 (islands prod-bundle workspace-probe fix)
 *     - zudolab/zfb#123 (doctest fence stabilization)
 *     - zudolab/zfb#124 (watcher test stabilization)
 *     - zudolab/zfb#126 / #131 (bundler threads Pipeline::with_defaults() through MDX pre-compile;
 *                               unblocks Sig F in zudolab/zudo-doc#1355)
 *     - zudolab/zfb#131 (opt-in `stripMdExt` config option through bundler + dev loader)
 *     - zudolab/zfb#132 / #133 (build_snapshot drives walk_collection with the default Pipeline so
 *                               snapshot module_specifier hashes match bridge map keys; closes the
 *                               post-#131 fallback-render regression)
 *     - Takazudo/zudo-front-builder#130 / PR #134 (Gap A: FsResolver::probe_package_entry consults
 *                               package.json `exports` for subpath bare imports so workspace island
 *                               modules under @zudo-doc/zudo-doc-v2/{toc,sidebar,theme,...} resolve
 *                               to their src/.../index.ts entries; Gap B: EXPECTED_ESBUILD_VERSION
 *                               bumped 0.24.0 → 0.25.12 to match the host's installed esbuild —
 *                               unblocks Sig G island hydration in zudolab/zudo-doc#1355)
 *     - Takazudo/zudo-front-builder PR #137 (post-#134 follow-up: defer node:* imports in
 *                               zfb root barrel content.ts to inside function bodies so the islands
 *                               per-island bundler can tree-shake content collection helpers out of
 *                               browser-targeted bundles; defensive --platform=browser +
 *                               --external:node:* flags on the islands esbuild invocation)
 *     - Takazudo/zudo-front-builder#138 / #139 / PR #140 (#138: produce_bundle_js renders one
 *                               synthesized entry that imports every island so esbuild only ever
 *                               sees a single input + --outfile, fixing "Must use outdir when
 *                               there are multiple input files"; #139: FsResolver walks up to the
 *                               nearest tsconfig.json and resolves compilerOptions.paths aliases
 *                               (e.g. "@/*": ["src/*"]) with extends-chain support, so the
 *                               islands scanner can follow @/-aliased imports from host pages
 *                               into "use client" components — unblocks Sig G island hydration on
 *                               this consumer)
 *     - Takazudo/zudo-front-builder#141 / PR #142 (post-#140 follow-up: islands scanner walk now
 *                               whitelists .ts/.tsx/.js/.jsx/.mjs/.cjs and skips .json/CSS/asset
 *                               files before SWC parse, fixing the ExpectedSemiForExprStmt crash
 *                               when a tsconfig path alias resolves to a non-trivial JSON file —
 *                               e.g. the host's #doc-history-meta alias mapped to populated
 *                               .zfb/doc-history-meta.json in the smoke E2E fixture)
 *     - Takazudo/zudo-front-builder PR #143 (TS Bundler / NodeNext moduleResolution shape: when a
 *                               source writes import "./foo.js" against on-disk foo.tsx (the
 *                               canonical convention used by the @zudo-doc/zudo-doc-v2 workspace
 *                               package), the resolver now probes the .ts/.tsx/.mts/.cts sibling
 *                               first and falls back to .js only when no TS sibling exists. Pre-
 *                               #143 the islands scanner walked one chain into v2 and immediately
 *                               dead-ended at every ./foo.js, so only the directly-imported
 *                               Sidebar reached the bundle. With #143 the smoke fixture build
 *                               registers 13 islands and emits a complete client runtime — finally
 *                               unblocking Sig G island hydration on this consumer)
 *     - Takazudo/zudo-front-builder#144 / PR #145 (synthesised shared-bundle entry survives
 *                               esbuild tree-shaking when an island has no top-level side effect:
 *                               render_shared_bundle_entry_source now namespace-imports each
 *                               island and references the namespaces from a top-level
 *                               globalThis.__zfb_islands ??= [...] assignment. Pre-#145, host-side
 *                               islands authored as bare `export default function ComponentName`
 *                               with no top-level effect were tree-shaken out of the bundle, so
 *                               every data-zfb-island="ComponentName" SSR marker for a host-shape
 *                               island had no client runtime to mount. With #145 every island's
 *                               exports survive — closes the final Sig G hydration gap on this
 *                               consumer)
 *     - Takazudo/zudo-front-builder#146 / PR #147 (mountIslands invoked on shared-bundle
 *                               production path: post-#144 the bundle byte-content carried every
 *                               island's compiled source but the synthesised entry never called
 *                               mountIslands — so SSR'd data-zfb-island markers stayed un-hydrated
 *                               in production. IslandManifest widened from Record<string, string>
 *                               to Record<string, string | IslandModule>, render_shared_bundle_entry_source
 *                               now imports mountIslands and registers each island as an inline
 *                               IslandModule entry, finally wiring SSR markers to runtime
 *                               constructors and closing the Sig G hydration cascade on this
 *                               consumer)
 *     - Takazudo/zudo-front-builder PR #148 (post-#147 follow-up: shared-bundle synthesised
 *                               entry now derives manifest keys from each component's
 *                               displayName ?? name at module-init time so multiple host-shape
 *                               `export default function ComponentName()` islands no longer
 *                               collide on a static "default" key. Synthesised entry tempfile
 *                               relocated from $TMPDIR into EsbuildSubprocessConfig::working_dir
 *                               so esbuild's upward node_modules walk resolves "preact" and
 *                               "@takazudo/zfb/runtime" — fixes the smoke fixture build crash
 *                               introduced by #147 on this consumer)
 *     - Takazudo/zudo-front-builder#149 / PR #150 (shared-bundle manifest uses static SSR-marker
 *                               names from the scanner, not runtime introspection: scanner now
 *                               derives a marker_name per island (default-export identifier OR
 *                               literal first arg of renderSsrSkipPlaceholder("X", ...)), and
 *                               the bundler bakes that name as a static literal third argument
 *                               to __zfb_register. Drops __zfb_keyFor runtime introspection
 *                               entirely so esbuild minification and ssr-skip "Island" suffix
 *                               wrappers can no longer break manifest-key alignment with SSR
 *                               markers — closes the final Sig G hydration alignment gap on
 *                               this consumer)
 *     - Takazudo/zudo-front-builder#151 / PR #152 (zfb-islands esbuild step now passes
 *                               --jsx=automatic --jsx-import-source=preact; fixes
 *                               ReferenceError: React is not defined at island mount when
 *                               host components use preact/compat for hooks; unblocks Sig G
 *                               hydration in zudolab/zudo-doc#1355)
 *     - Takazudo/zudo-front-builder PR #153 (CF adapter wrapper now probes env.ASSETS first
 *                               on GET/HEAD, falling through to the inner zfb worker only on
 *                               404; this restores SSG head injection — <link rel="stylesheet">
 *                               and <script type="module" src="/assets/islands-…"> — for
 *                               no-trailing-slash URLs like /docs/getting-started under
 *                               `zfb preview` and Cloudflare Pages, fixing Wave 10 Sig G e2e
 *                               failures in zudolab/zudo-doc#1355)
 *     - Takazudo/zudo-front-builder base/island-data-props-serialization (Island JSX wrapper now
 *                               JSON.stringifies the wrapped child's own props onto a `data-props`
 *                               attribute on the SSR marker div — the runtime hydration path has
 *                               always read that attribute via getAttribute("data-props") + JSON.parse
 *                               but no SSR site ever wrote it, so every caller-supplied prop bag
 *                               silently vanished across the SSR → hydrate boundary and every
 *                               island re-rendered with {} on the client; closes the prop-
 *                               serialisation gap that wave 12 of zudolab/zudo-doc#1355 traced as
 *                               the root cause of the remaining 20 failing e2e specs — i18n
 *                               sidebar fallback, mobile-toc, mobile-sidebar, smoke-pages)
 *     - Takazudo/zudo-front-builder wave13-css-path-probe (build_default_css_payload now probes
 *                               BOTH `<root>/styles/global.css` AND `<root>/src/styles/global.css`
 *                               for the Tailwind v4 input CSS, first match wins. Pre-fix the
 *                               probe hardcoded the legacy `<root>/styles/global.css` location and
 *                               missed the conventional Vite/Astro/Next-style `src/styles/` layout
 *                               this consumer uses, so the host's `:root` block defining
 *                               `--zd-sidebar-w` and the entire `@theme` semantic-token mapping
 *                               (`--color-bg → --zd-bg` and friends) never reached Tailwind's
 *                               entry CSS. Result: the dist CSS shipped only Tailwind v4 stock
 *                               palette plus generated arbitrary-value classes, and host-defined
 *                               custom properties resolved to defaults at runtime — directly
 *                               causing the wave 12 desktop-sidebar fallback width regression
 *                               that Wave 12 Topic A patched with an inline <style> in
 *                               doc-layout.tsx. With this pin the host's authored @theme block
 *                               flows through Tailwind as designed and the inline workaround
 *                               can be dropped — closes wave 13 topic 5 of zudolab/zudo-doc#1355)
 *     - Takazudo/zudo-front-builder PR #154 (config: support `base` for HTML asset URLs.
 *                               ZfbConfig grew a `base?: string` field (TS + Rust serde), and
 *                               commands::build now mounts each emitter slot's `stable_url`
 *                               under the configured prefix BEFORE handing it to the renderer
 *                               and to ProductionAssetPipeline::boundary_replace. Result: with
 *                               base = "/pj/zudo-doc/" the dist HTML emits
 *                               `<link rel="stylesheet" href="/pj/zudo-doc/assets/styles-<hash>.css">`
 *                               instead of the unprefixed `/assets/styles-<hash>.css` that
 *                               404'd under the sub-path mount on PR #669 preview. Closes the
 *                               BLOCKER sub-issue zudolab/zudo-doc#1361 of feature-audit
 *                               epic zudolab/zudo-doc#1360)
 *     - Takazudo/zudo-front-builder#155 (renderer-emission unit test for islands slot —
 *                               asserts the built dist HTML emits the configured `base`
 *                               prefix on `<script type="module">` tags for the islands
 *                               slot; guards against regression of the #154 wiring on the
 *                               Rust-side renderer. Pure test addition, no runtime change)
 *     - Takazudo/zudo-front-builder#156 (wave13 rebase: brings two commits onto main that
 *                               had previously lived only on the wave13-css-path-probe branch
 *                               and were never PR'd. (a) feat(island): SSR `<Island>` wrapper
 *                               serialises the wrapped child's props onto a `data-props`
 *                               attribute so the runtime hydration path can JSON.parse them
 *                               back; without this, every hydrated island sees `{}` and
 *                               findActiveSlug throws "e is not iterable" on every doc page.
 *                               (b) fix(build): build_default_css_payload probes
 *                               `<root>/src/styles/global.css` as a Tailwind v4 input fallback;
 *                               without this, the host's `@theme` block under `src/` never
 *                               reaches the Tailwind run and design tokens default. The
 *                               previous pin c2cff95 was HEAD of wave13-css-path-probe — when
 *                               PR #1388 of zudolab/zudo-doc#1386 bumped to PR-#155 main
 *                               (0f6f8c4), 73 of 145 e2e tests went red because both wave13
 *                               carries were silently lost. PR #156 brings them onto main
 *                               cleanly (textual rebase) so the bump path stays additive)
 *     - Takazudo/zudo-front-builder PR #157 (fix examples/basic-blog build
 *                               end-to-end — 6 bugs fixed; no consumer API
 *                               change)
 *     - Takazudo/zudo-front-builder PR #168 / sub-161 (ADR-007: author
 *                               embedded deno_core ADR, superseding ADR-005
 *                               miniflare subprocess)
 *     - Takazudo/zudo-front-builder PR #168 / sub-162 (implement
 *                               EmbeddedV8RenderHost: deno_core + node:*
 *                               runtime stubs + deno_fetch/web/url/console
 *                               Web API extensions)
 *     - Takazudo/zudo-front-builder PR #168 / sub-163 (CI: wire
 *                               Swatinem/rust-cache@v2; document 15-30 min
 *                               V8 first-build cost in CONTRIBUTING.md)
 *     - Takazudo/zudo-front-builder PR #168 / sub-164 (renderer: add
 *                               Backend::EmbeddedV8 + Backend::Stub,
 *                               WorkerDispatch enum; swap dispatch path)
 *     - Takazudo/zudo-front-builder PR #168 / sub-165 (test: ContentSnapshot
 *                               e2e verification tests)
 *     - Takazudo/zudo-front-builder PR #168 / sub-166 (cli: flip default
 *                               Backend from SpawnMiniflare → EmbeddedV8
 *                               in build/dev pipelines)
 *     - Takazudo/zudo-front-builder PR #168 / sub-167 (cleanup: delete
 *                               miniflare-bootstrap.mjs, strip
 *                               SpawnMiniflare backend, scrub all miniflare
 *                               references from code/docs/config)
 *     - Takazudo/zudo-front-builder PR #170 (fix(dev): cold-start rebuild
 *                               empty dirty set (DependencyGraph seeded with
 *                               all page IDs on startup; empty dirty escalates
 *                               to PageSelection::All) + PageCache disk
 *                               fallback (serve_page() reads from dist/ on
 *                               cache miss instead of returning 500))
 *     - Takazudo/zudo-front-builder bdbfbfb (fix(embedded-v8): add
 *                               node:async_hooks stub to v1 node:* list;
 *                               consumer bundles that import
 *                               @takazudo/zfb-adapter-cloudflare do a
 *                               top-level import of AsyncLocalStorage from
 *                               node:async_hooks — without this stub the
 *                               embedded V8 host fails at bundle-load time
 *                               with "no in-memory source for node:async_hooks")
 *   pinned by: epic zudolab/zudo-doc#1353 (super-epic #1333) → bumped by epic
 *              zudolab/zudo-doc#1355 (Sig F finalisation + post-#131 hash-mismatch follow-up
 *              + Sig G island-resolver/esbuild parity + shared-bundle hydration glue
 *              + manifest-key alignment + wave 12 hydration prop serialisation
 *              + wave 13 Tailwind input-CSS path-probe gap) → bumped by epic
 *              zudolab/zudo-doc#1360 sub-issue #1361 (S1 BLOCKER: HTML asset URLs respect
 *              site `base`) → bumped by epic zudolab/zudo-doc#1386 sub-issue #1388
 *              (atomic three-point pin bump + e2e fixture roll-forward; closes #1384)
 *              → bumped by epic zudolab/zudo-doc#1407 (zfb-pin-bump-embed-v8: pick up
 *              PR #168 embedded deno_core + PR #170 cold-start-rebuild fix; hotfix
 *              bdbfbfb adds node:async_hooks stub surfaced during W3 build verification)
 */

// zfb.config.ts — entry-point config consumed by the zfb engine.
//
// This file replaces the Astro-flavoured `src/content.config.ts` while the
// migration is in progress. Both files coexist until every content site,
// integration, and page in this repo has been ported over to zfb. Once the
// switch-over is complete, `src/content.config.ts` is removed in a later
// topic.
//
// Authoring conventions inherited from `src/content.config.ts`:
//
// - Schemas live as vanilla zod definitions so we keep the type-inference
//   ergonomics editors expect. The schemas are converted to JSON Schema via
//   `z.toJSONSchema()` at the boundary because zfb's `CollectionDef.schema`
//   takes a JSON-Schema-shaped object (mirrored one-for-one in the Rust
//   `Config` struct — see `crates/zfb/src/config.rs` in the zfb repo).
// - Collection paths derive from `src/config/settings.ts` so per-locale and
//   per-version directories stay a single source of truth.
// - The `plugins` array starts empty here. Sibling integration topics
//   (doc-history, search, llms-txt, sitemap, claude-resources, …) each add
//   one entry under their own import line so this file stays additive on
//   merge.
//
// Typed schema reflection: zfb's content engine emits `.zfb/types.d.ts`
// from the per-collection schemas (see `emit_types_dts_with_schemas` in
// `crates/zfb-content/src/collection.rs`). Once zfb is wired in, that file
// is the source of truth for `getCollection("docs")[0].data.sidebar_position`
// being typed `number | undefined` rather than `unknown`.

import { z } from "zod";
import { defineConfig } from "zfb/config";
import { settings } from "./src/config/settings";
import { tagVocabulary } from "./src/config/tag-vocabulary";

// ---------------------------------------------------------------------------
// Schema definitions (vanilla zod — no astro/zod dependency).
// ---------------------------------------------------------------------------

/**
 * Build the `tags` schema based on governance mode. `"strict"` tightens to a
 * `z.enum` of every canonical id plus every alias (content still uses
 * aliases verbatim — resolution happens at the aggregation layer, after
 * parsing). Mirrors the equivalent helper in `src/content.config.ts`.
 */
function buildTagsSchema() {
  const vocabularyActive = settings.tagVocabulary && settings.tagGovernance === "strict";
  if (!vocabularyActive) return z.array(z.string()).optional();
  const allowed = new Set<string>();
  for (const entry of tagVocabulary) {
    allowed.add(entry.id);
    for (const alias of entry.aliases ?? []) allowed.add(alias);
  }
  const allowedList = [...allowed];
  if (allowedList.length === 0) return z.array(z.string()).optional();
  const [first, ...rest] = allowedList;
  return z.array(z.enum([first, ...rest] as [string, ...string[]])).optional();
}

/**
 * Single zod schema reused for every docs collection (default + per-locale
 * + per-version + per-version-per-locale). Field set is byte-for-byte
 * identical to `src/content.config.ts`'s `docsSchema`.
 *
 * `.passthrough()` keeps custom frontmatter keys (e.g. `author`, `status`)
 * available downstream — the frontmatter-preview UI relies on this to
 * surface arbitrary keys without us having to declare each one here.
 */
const docsSchema = z
  .object({
    title: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    sidebar_position: z.number().optional(),
    sidebar_label: z.string().optional(),
    tags: buildTagsSchema(),
    search_exclude: z.boolean().optional(),
    pagination_next: z.string().nullable().optional(),
    pagination_prev: z.string().nullable().optional(),
    draft: z.boolean().optional(),
    unlisted: z.boolean().optional(),
    hide_sidebar: z.boolean().optional(),
    hide_toc: z.boolean().optional(),
    doc_history: z.boolean().optional(),
    standalone: z.boolean().optional(),
    slug: z.string().optional(),
    generated: z.boolean().optional(),
  })
  .passthrough();

// `z.toJSONSchema` is a runtime call but the result is a stable JSON
// document. We compute it once and reuse the same object across every
// collection definition.
const docsSchemaJson = z.toJSONSchema(docsSchema) as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Collection list — derived from settings.
// ---------------------------------------------------------------------------

interface CollectionEntryShape {
  name: string;
  path: string;
  schema: Record<string, unknown>;
}

const collections: CollectionEntryShape[] = [];

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

// ---------------------------------------------------------------------------
// Default export — the zfb config object.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Plugins — wired through zfb's plugin lifecycle (issue #101).
// ---------------------------------------------------------------------------
//
// zfb's plugin runtime loads each entry's `name` as a module specifier
// (npm bare or `./`-relative path) and dispatches lifecycle hooks
// (`preBuild`, `postBuild`, `devMiddleware`) on the module's default
// export. Inline function hooks on this config are NOT supported — the
// config goes through a JSON round-trip to the Rust side and any
// function value would be silently dropped (see `@takazudo/zfb/plugins`
// source comment for the rationale). Each entry below therefore
// references a small wrapper module under `./plugins/` whose default
// export is a `ZfbPlugin`.
//
// All three lifecycle hooks are now wired via the wrapper modules:
//
//   preBuild    — claude-resources writes its pre-step output;
//                 doc-history writes `.zfb/doc-history-meta.json`.
//   postBuild   — doc-history / search-index / llms-txt emit their
//                 dist-time artifacts.
//   devMiddleware — doc-history / search-index / llms-txt register
//                 Connect-style middleware via the shared
//                 `plugins/connect-adapter.mjs` so the dev sidecar
//                 (`scripts/dev-sidecar.mjs`) can be retired.
//
// The legacy npm-script glue (`scripts/zfb-{pre,post}build.mjs`,
// `scripts/dev-sidecar.mjs`) stays in place during the merge window;
// T6 retires it once all lifecycle epics land.
//
// Sitemap is NOT in this list — it is served as a `pages/sitemap.xml.tsx`
// zfb route (per ADR-005's "non-HTML page" pattern) introduced in epic E8.

const localeArray = Object.entries(settings.locales).map(([code, locale]) => ({
  code,
  dir: locale.dir,
}));
const localeRecord = Object.fromEntries(
  Object.entries(settings.locales).map(([code, locale]) => [code, { dir: locale.dir }]),
);

const integrationPlugins = [
  ...(settings.claudeResources
    ? [
        {
          name: "./plugins/claude-resources-plugin.mjs",
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
          name: "./plugins/doc-history-plugin.mjs",
          options: {
            docsDir: settings.docsDir,
            locales: localeRecord,
          },
        },
      ]
    : []),
  {
    name: "./plugins/search-index-plugin.mjs",
    options: {
      docsDir: settings.docsDir,
      locales: localeRecord,
      base: settings.base,
    },
  },
  ...(settings.llmsTxt
    ? [
        {
          name: "./plugins/llms-txt-plugin.mjs",
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
  // Workaround for upstream zfb gap (zudolab/zudo-doc#1394; upstream issue: https://github.com/Takazudo/zudo-front-builder/issues/158) — zfb build does not copy publicDir to outDir; remove once upstream ships and pin is bumped.
  {
    name: "./plugins/copy-public-plugin.mjs",
    options: {
      publicDir: "public",
    },
  },
];

export default defineConfig({
  framework: "preact",
  tailwind: { enabled: true },
  collections,
  // Strip `.md` / `.mdx` from in-page `<a href>` and append a trailing
  // slash so author-written `[label](./other.mdx)` references resolve
  // to the rendered route URL. Mirrors `rehypeStripMdExtension` from
  // packages/md-plugins. Without this, dist HTML carries unrouted
  // `href="./other.mdx"` links — the deep-review #1338 finding 12
  // verification surfaced this on roughly two dozen pages.
  stripMdExt: true,
  // Public URL prefix for `<link rel="stylesheet">` and `<script
  // type="module">` tags emitted into dist HTML. Without this, the
  // unprefixed `/assets/styles-<hash>.css` 404s under the sub-path
  // mount at https://<deployment>.zudo-doc.pages.dev/pj/zudo-doc/
  // (closes BLOCKER #1361 of feature-audit epic #1360). The same
  // value already drives the search-index / llms-txt plugins below.
  base: settings.base,
  // ----------------------------------------------------------------------
  // Cloudflare Pages adapter — wraps the SSR bundle into `dist/_worker.js`
  // (advanced-mode entry) plus a sidecar `dist/_zfb_inner.mjs`. The adapter
  // is a hard requirement for any route exporting `prerender = false`
  // (currently `pages/api/ai-chat.tsx`); without it `zfb build` rejects
  // those routes at build time. Bindings (ANTHROPIC_API_KEY, DOCS_SITE_URL,
  // RATE_LIMIT KV, RATE_LIMIT_PER_MINUTE, RATE_LIMIT_PER_DAY) are wired via
  // wrangler.toml and reach user code via `getCloudflareContext()` from the
  // same package.
  // ----------------------------------------------------------------------
  adapter: "@takazudo/zfb-adapter-cloudflare",
  plugins: integrationPlugins,
});
