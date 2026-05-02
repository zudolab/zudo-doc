/**
 * zfb pin (canonical, shared with E2/E4):
 *   commit: ea8a834 (Takazudo/zudo-front-builder main, 2026-05-03)
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
 *   pinned by: epic zudolab/zudo-doc#1353 (super-epic #1333) → bumped by epic
 *              zudolab/zudo-doc#1355 (Sig F finalisation + post-#131 hash-mismatch follow-up
 *              + Sig G island-resolver/esbuild parity)
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
];

export default defineConfig({
  framework: "preact",
  tailwind: { enabled: true },
  collections,
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
