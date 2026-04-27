import type { RenderedContent } from "astro:content";
import type { z } from "astro/zod";
import type { blogSchema } from "@/content.config";

/**
 * Frontmatter shape for blog entries, derived directly from the Zod schema
 * declared in `src/content.config.ts`. Keeping this as `z.infer` ensures the
 * type and the runtime validator never drift — change the schema and the
 * type follows automatically.
 */
export type BlogData = z.infer<typeof blogSchema>;

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
  data: BlogData;
  rendered?: RenderedContent;
  filePath?: string;
}
