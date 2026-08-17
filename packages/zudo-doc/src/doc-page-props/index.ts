// The current zfb entry type and the discriminated-union props types for all
// four doc-route variants.
//
// The SHAPES live in `../site-schema/types.js`, which is browser-safe and
// carries no zfb edge (#3395). This module is the one place that binds them to
// zfb's real `CollectionEntry`, so route and renderer code keeps reading
// `entry.Content` / `entry.module_specifier` exactly as before while the pure
// domain stays publishable on its own.

export type { HeadingItem } from "../extract-headings/index.js";
import type { CollectionEntry } from "@takazudo/zfb/content";
import type {
  AutoIndexNode,
  DocNavNode,
  DocPageAutoIndexProps as DocPageAutoIndexPropsBase,
  DocPageBaseProps as DocPageBasePropsGeneric,
  DocPageEntryProps as DocPageEntryPropsGeneric,
  DocPageFrontmatter,
} from "../site-schema/types.js";

export type { AutoIndexNode, DocNavNode, DocPageFrontmatter };

// ---------------------------------------------------------------------------
// DocPageEntry — entry shape for all 4 doc-route paths()
// ---------------------------------------------------------------------------

/**
 * The native zfb collection entry with docs frontmatter. Route consumers
 * derive canonical route slugs from `entry.data.slug ?? toRouteSlug(entry.slug)`.
 */
export type DocPageEntry = CollectionEntry<DocPageFrontmatter>;

// ---------------------------------------------------------------------------
// Doc-page props — the site-schema shapes bound to the zfb entry
// ---------------------------------------------------------------------------

/** Branch: a real content entry. `autoIndex` is absent. */
export type DocPageEntryProps = DocPageEntryPropsGeneric<DocPageEntry>;

/** Branch: an auto-generated category index. `entry` is absent. */
export type DocPageAutoIndexProps = DocPageAutoIndexPropsBase;

/** Discriminated union for the `kind` prop. Narrow via `props.kind === "entry"`. */
export type DocPageBaseProps = DocPageBasePropsGeneric<DocPageEntry>;
