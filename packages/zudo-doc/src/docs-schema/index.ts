/**
 * Default docs-frontmatter zod schema builder.
 *
 * Ported (and parameterized) from the `create-zudo-doc` base template's
 * `src/config/docs-schema.ts` `buildDocsSchema` export (epic
 * zudolab/zudo-doc#2651, S4 #2654).
 *
 * Unlike the template original — which read the host `settings` and
 * `tag-vocabulary` singletons directly — this package default NEVER imports
 * host singletons: governance mode and the vocabulary entries are passed in
 * as `opts`. `zudoDoc()` (#2657) calls this with the project's merged
 * governance config; a project may also override `buildDocsSchema` entirely
 * via `ZudoDocConfig.buildDocsSchema`.
 */

import { z } from "zod";
import type { PresetTagVocabularyEntry } from "../preset.js";

export interface BuildDocsSchemaOptions {
  tagGovernance?: "off" | "warn" | "strict";
  tagVocabulary?: readonly PresetTagVocabularyEntry[];
}

// ---------------------------------------------------------------------------
// Tags schema builder — governance-aware.
// ---------------------------------------------------------------------------

/**
 * Build the `tags` schema based on governance mode. `"strict"` tightens to a
 * `z.enum` containing the exact canonical ids from the vocabulary.
 */
function buildTagsSchema(opts?: BuildDocsSchemaOptions) {
  const vocabulary = opts?.tagVocabulary ?? [];
  const vocabularyActive = vocabulary.length > 0 && opts?.tagGovernance === "strict";
  if (!vocabularyActive) return z.array(z.string()).optional();
  const allowed = new Set(vocabulary.map((entry) => entry.id));
  const allowedList = [...allowed];
  if (allowedList.length === 0) return z.array(z.string()).optional();
  const [first, ...rest] = allowedList;
  return z
    .array(z.enum([first, ...rest] as [string, ...string[]]))
    .optional();
}

// ---------------------------------------------------------------------------
// Schema builder — single source of truth for the default docs frontmatter
// shape.
// ---------------------------------------------------------------------------

/**
 * Build the docs frontmatter zod schema.
 *
 * Returns a single `z.object(...).passthrough()` reused for every docs
 * collection (default + per-locale + per-version + per-version-per-locale).
 * The `tags` field is governance-aware: `buildTagsSchema()` returns a plain
 * `z.array(z.string())` when governance is off (or `opts` is omitted), or a
 * restricted `z.enum` when `opts.tagGovernance: "strict"` plus a non-empty
 * `opts.tagVocabulary` is supplied.
 *
 * `.passthrough()` keeps custom frontmatter keys (e.g. `author`, `status`)
 * available downstream — the frontmatter-preview UI relies on this to
 * surface arbitrary keys without declaring each one here.
 */
export function buildDocsSchema(opts?: BuildDocsSchemaOptions) {
  return z
    .object({
      title: z.string(),
      description: z.string().optional(),
      category: z.string().optional(),
      sidebar_position: z.number().optional(),
      sidebar_label: z.string().optional(),
      tags: buildTagsSchema(opts),
      search_exclude: z.boolean().optional(),
      pagination_next: z.string().nullable().optional(),
      pagination_prev: z.string().nullable().optional(),
      draft: z.boolean().optional(),
      unlisted: z.boolean().optional(),
      hide_sidebar: z.boolean().optional(),
      hide_toc: z.boolean().optional(),
      wide: z.boolean().optional(),
      doc_history: z.boolean().optional(),
      standalone: z.boolean().optional(),
      slug: z.string().optional(),
      generated: z.boolean().optional(),
      // Category metadata expressed as a directory index.mdx's frontmatter — the
      // frontmatter form of `_category_.json`. `category_no_page` makes the index
      // a non-linked sidebar header excluded from routes/sitemap/search;
      // `category_sort_order` sets the child sort direction. Frontmatter wins
      // over the sidecar.
      category_no_page: z.boolean().optional(),
      category_sort_order: z.enum(["asc", "desc"]).optional(),
    })
    .passthrough();
}

// ---------------------------------------------------------------------------
// Inferred type — single source of truth for the default docs data shape.
// ---------------------------------------------------------------------------

/**
 * TypeScript type inferred from the default docs frontmatter zod schema.
 * A project overriding `buildDocsSchema` via `ZudoDocConfig` should derive
 * its own `DocsData` type from its own builder instead of this one.
 */
export type DocsData = z.infer<ReturnType<typeof buildDocsSchema>>;
