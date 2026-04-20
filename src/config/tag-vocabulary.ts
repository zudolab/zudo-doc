import type { TagVocabularyEntry } from "./tag-vocabulary-types";

/**
 * Canonical tag vocabulary for this documentation base.
 *
 * Seeded to cover every tag that currently appears in `src/content/docs/**`
 * and `src/content/docs-ja/**` so no existing page breaks when
 * `settings.tagGovernance` is set to `"strict"`.
 *
 * Grouping convention:
 * - `topic`  — subject-matter tags (ai, search, i18n, …)
 * - `type`   — content-type tags (guide, reference, tutorial)
 * - `level`  — reader-level tags (beginner, advanced)
 *
 * To phase out a tag: set `deprecated: { redirect: "<new-id>" }` (content
 * using the old id will resolve to the new one) or `deprecated: true` to
 * drop it from aggregation entirely. Do not silently remove entries — other
 * docs may still reference them.
 */
export const tagVocabulary: readonly TagVocabularyEntry[] = [
  // ── topic ─────────────────────────────────────────────────────────
  {
    id: "ai",
    label: "AI",
    description: "AI assistant, chat worker, LLM integration.",
    group: "topic",
  },
  {
    id: "cloudflare-worker",
    label: "Cloudflare Worker",
    description: "Cloudflare Workers used by zudo-doc features.",
    group: "topic",
    aliases: ["cf-worker"],
  },
  {
    id: "content",
    description: "Authoring content, frontmatter, MDX conventions.",
    group: "topic",
  },
  {
    id: "customization",
    description: "Theme, layout, and navigation customization.",
    group: "topic",
  },
  {
    id: "design-system",
    label: "Design System",
    description: "Design tokens, color schemes, typography rules.",
    group: "topic",
  },
  {
    id: "doc-history",
    label: "Doc History",
    description: "Per-document git history tracking.",
    group: "topic",
  },
  {
    id: "i18n",
    label: "i18n",
    description: "Internationalization and locale routing.",
    group: "topic",
  },
  {
    id: "search",
    description: "Search UI, indexing, and worker API.",
    group: "topic",
  },

  // ── type ──────────────────────────────────────────────────────────
  {
    id: "type:guide",
    label: "Guide",
    description: "Task-oriented walkthrough of a feature.",
    group: "type",
    aliases: ["guide", "guides"],
  },
  {
    id: "type:reference",
    label: "Reference",
    description: "Exhaustive reference material for a subsystem.",
    group: "type",
    aliases: ["reference"],
  },
  {
    id: "type:tutorial",
    label: "Tutorial",
    description: "Step-by-step learn-by-doing content.",
    group: "type",
    aliases: ["tutorial", "tutorials"],
  },

  // ── level ─────────────────────────────────────────────────────────
  {
    id: "level:beginner",
    label: "Beginner",
    description: "Introductory material; no prior knowledge assumed.",
    group: "level",
    aliases: ["beginner"],
  },
  {
    id: "level:advanced",
    label: "Advanced",
    description: "Assumes familiarity with the underlying concepts.",
    group: "level",
    aliases: ["advanced"],
  },
];
