// Barrel for the metainfo topic — JSX ports of:
//   src/components/doc-metainfo.astro
//   src/components/doc-tags.astro
//   src/components/frontmatter-preview.astro

export {
  DocMetainfo,
  DEFAULT_CREATED_LABEL,
  DEFAULT_UPDATED_LABEL,
} from "./doc-metainfo.js";
export type { DocMetainfoProps } from "./doc-metainfo.js";

export {
  DocTags,
  DEFAULT_TAGS_LABEL,
  DEFAULT_TAGGED_WITH_LABEL,
} from "./doc-tags.js";
export type { DocTagsProps, ResolvedTag, TagPlacement } from "./doc-tags.js";

export {
  FrontmatterPreview,
  DEFAULT_FRONTMATTER_PREVIEW_TITLE,
  DEFAULT_KEY_COL_LABEL,
  DEFAULT_VALUE_COL_LABEL,
} from "./frontmatter-preview.js";
export type { FrontmatterPreviewProps } from "./frontmatter-preview.js";
