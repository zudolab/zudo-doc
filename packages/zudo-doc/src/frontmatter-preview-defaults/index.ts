/**
 * Default frontmatter-preview ignore-key list.
 *
 * Ported verbatim from the `create-zudo-doc` base template's
 * `src/config/frontmatter-preview-defaults.ts`
 * `DEFAULT_FRONTMATTER_IGNORE_KEYS` export (epic zudolab/zudo-doc#2651,
 * S4 #2654).
 *
 * These are the schema-managed frontmatter keys handled by the framework
 * that should be hidden from the frontmatter preview by default. Every
 * entry corresponds to a field declared in the default docs schema
 * (`@takazudo/zudo-doc/docs-schema`'s `buildDocsSchema`). A project adding
 * custom frontmatter fields via its own schema should extend this list via
 * `ZudoDocConfig`, not edit it in place.
 */

export const defaultFrontmatterPreviewIgnoreKeys: readonly string[] = [
  "title",
  "description",
  "category",
  "sidebar_position",
  "sidebar_label",
  "tags",
  "search_exclude",
  "pagination_next",
  "pagination_prev",
  "draft",
  "unlisted",
  "hide_sidebar",
  "hide_toc",
  "wide",
  "doc_history",
  "standalone",
  "slug",
  "generated",
  "category_no_page",
  "category_sort_order",
];
