import type { RenderedContent } from "astro:content";

/**
 * Concrete entry type for blog collections.
 *
 * Astro generates collection-specific types (CollectionEntry<"blog">,
 * CollectionEntry<"blog-ja">, etc.) that are incompatible with dynamic
 * collection names like `blog-${code}`. This interface captures the
 * shared shape so utility functions can accept entries from any blog
 * collection without fighting the generic constraint.
 */
export interface BlogEntry {
  id: string;
  body?: string;
  collection: string;
  data: {
    title: string;
    description?: string;
    date: Date;
    author?: string;
    authors?: string[];
    tags?: string[];
    /** Manual excerpt override OR populated by the <!-- more --> remark plugin. */
    excerpt?: string;
    /** Set by the <!-- more --> remark plugin to signal "Continue reading" should render. */
    hasMore?: boolean;
    draft?: boolean;
    unlisted?: boolean;
    slug?: string;
  };
  rendered?: RenderedContent;
  filePath?: string;
}
