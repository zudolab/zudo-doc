import type { TagCliConfig } from "@takazudo/zudo-doc/tags-audit";
import type { TagVocabularyEntry } from "@takazudo/zudo-doc/settings";
import { settings } from "./settings";

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
 * Content must use these ids exactly. A renamed or removed id becomes unknown,
 * so update every referencing page in the same change.
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
  },
  {
    id: "type:reference",
    label: "Reference",
    description: "Exhaustive reference material for a subsystem.",
    group: "type",
  },
  {
    id: "type:tutorial",
    label: "Tutorial",
    description: "Step-by-step learn-by-doing content.",
    group: "type",
  },

  // ── level ─────────────────────────────────────────────────────────
  {
    id: "level:beginner",
    label: "Beginner",
    description: "Introductory material; no prior knowledge assumed.",
    group: "level",
  },
  {
    id: "level:advanced",
    label: "Advanced",
    description: "Assumes familiarity with the underlying concepts.",
    group: "level",
  },
];

const tagCliConfig = {
  contentDirs: [
    settings.docsDir,
    ...Object.values(settings.locales).map((locale) => locale.dir),
  ],
  vocabulary: tagVocabulary,
  governance: settings.tagGovernance,
  vocabularyActive:
    settings.tagVocabulary && settings.tagGovernance !== "off",
} satisfies TagCliConfig;

export default tagCliConfig;
