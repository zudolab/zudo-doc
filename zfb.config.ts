/**
 * zfb pin (canonical, shared with E2/E4):
 *   commit: 4b16b32 (Takazudo/zudo-front-builder main, 2026-05-01)
 *   includes fixes:
 *     - zudolab/zfb#99  (ViewTransitions runtime + meta injection)
 *     - zudolab/zfb#100 (404 convention: emit dist/404.html at root)
 *     - zudolab/zfb#101 (plugin lifecycle hooks: preBuild, postBuild, devMiddleware)
 *     - zudolab/zfb#102 (CJK-aware emphasis/strong tokenisation in MDX pipeline)
 *     - zudolab/zfb#103 (ResolveLinksPlugin: probe extensionless candidates)
 *     - zudolab/zfb#104 (rehype output parity: heading-links, code-title, mermaid, image-enlarge, strip-md-ext)
 *   pinned by: epic zudolab/zudo-doc#1334 (super-epic #1333)
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
// Plugins — declarative breadcrumbs for the v0 plugin runtime.
// ---------------------------------------------------------------------------
//
// zfb v0 accepts `plugins: PluginConfig[]` as `{ name, options }` metadata
// only — no lifecycle hooks fire today. The host wires the actual work via
// npm-script lifecycle hooks (`scripts/zfb-prebuild.mjs` for claude-resources,
// `scripts/zfb-postbuild.mjs` for doc-history / search-index / llms-txt) and
// a dev sidecar (S3) for the dev-mode middlewares.
//
// The entries below are forward-compat breadcrumbs: once zfb adopts plugin
// lifecycle hooks the script glue can be retired and these descriptors will
// pick up the matching `runClaudeResourcesPreStep` / `runDocHistoryPostBuild`
// / `emitSearchIndex` / `emitLlmsTxt` runners automatically.
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
          name: "claude-resources",
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
          name: "doc-history",
          options: {
            docsDir: settings.docsDir,
            locales: localeRecord,
          },
        },
      ]
    : []),
  {
    name: "search-index",
    options: {
      docsDir: settings.docsDir,
      locales: localeRecord,
      base: settings.base,
    },
  },
  ...(settings.llmsTxt
    ? [
        {
          name: "llms-txt",
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
