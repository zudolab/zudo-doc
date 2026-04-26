import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import { settings } from "./config/settings";
import { tagVocabulary } from "./config/tag-vocabulary";

// Default content directories for blog collections
const DEFAULT_BLOG_DIR = "src/content/blog";
const DEFAULT_BLOG_LOCALE_DIR_PREFIX = "src/content/blog-";

// Build the `tags` schema based on governance mode. `"strict"` tightens to a
// z.enum of every canonical id plus every alias (content still uses aliases
// verbatim — resolution happens at the aggregation layer, after parsing).
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

const docsSchema = z
  .object({
    title: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    sidebar_position: z.number().optional(),
    sidebar_label: z.string().optional(),
    tags: buildTagsSchema(),
    search_exclude: z.boolean().optional(),
    pagination_next: z.string().nullable().optional(), // doc slug or null to hide
    pagination_prev: z.string().nullable().optional(), // doc slug or null to hide
    draft: z.boolean().optional(), // Exclude from build entirely
    unlisted: z.boolean().optional(), // Built but noindexed, hidden from sidebar/nav
    hide_sidebar: z.boolean().optional(), // Hide the left sidebar, center content
    hide_toc: z.boolean().optional(), // Hide the right-side table of contents
    standalone: z.boolean().optional(), // Hidden from sidebar nav but still indexed (unlike unlisted)
    slug: z.string().optional(), // Custom URL slug override
    generated: z.boolean().optional(), // Build-time generated content (skip translation)
  })
  .passthrough(); // Allow custom frontmatter keys (e.g. author, status) to pass through for frontmatter preview

const docs = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: `./${settings.docsDir}` }),
  schema: docsSchema,
});

// Dynamically create collections for each configured locale
const localeCollections: Record<string, ReturnType<typeof defineCollection>> = {};
for (const [code, config] of Object.entries(settings.locales)) {
  localeCollections[`docs-${code}`] = defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: `./${config.dir}` }),
    schema: docsSchema,
  });
}

// Dynamically create collections for each configured version
const versionCollections: Record<string, ReturnType<typeof defineCollection>> = {};
if (settings.versions) {
  for (const version of settings.versions) {
    // Main docs for this version (prefixed with "v-" to avoid collision with locale collections)
    versionCollections[`docs-v-${version.slug}`] = defineCollection({
      loader: glob({ pattern: "**/*.{md,mdx}", base: `./${version.docsDir}` }),
      schema: docsSchema,
    });
    // Locale variants for this version
    if (version.locales) {
      for (const [code, config] of Object.entries(version.locales)) {
        versionCollections[`docs-v-${version.slug}-${code}`] = defineCollection({
          loader: glob({ pattern: "**/*.{md,mdx}", base: `./${config.dir}` }),
          schema: docsSchema,
        });
      }
    }
  }
}

// Blog schema — declared fields only; Astro 6 only surfaces schema-declared
// keys from vfile.data.astro.frontmatter into entry.data.
const blogSchema = z
  .object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    author: z.string().optional(),
    authors: z.string().array().optional(),
    tags: buildTagsSchema(),
    /** Manual excerpt override OR populated by the <!-- more --> remark plugin. */
    excerpt: z.string().optional(),
    /** Set by the <!-- more --> remark plugin to signal that a "Continue reading" link should render. */
    hasMore: z.boolean().optional(),
    draft: z.boolean().optional(),
    unlisted: z.boolean().optional(),
    slug: z.string().optional(),
  })
  .passthrough();

// Blog collections (always registered so getCollection("blog") works unconditionally)
const blogDir = settings.blog ? (settings.blog.dir ?? DEFAULT_BLOG_DIR) : DEFAULT_BLOG_DIR;
const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: `./${blogDir}` }),
  schema: blogSchema,
});

// Locale blog collections
const blogLocaleCollections: Record<string, ReturnType<typeof defineCollection>> = {};
if (settings.blog && settings.blog.locales) {
  for (const [code, config] of Object.entries(settings.blog.locales)) {
    blogLocaleCollections[`blog-${code}`] = defineCollection({
      loader: glob({ pattern: "**/*.{md,mdx}", base: `./${config.dir}` }),
      schema: blogSchema,
    });
  }
} else {
  // Register default locale collections so TypeScript / Astro schema checks pass
  // even when the blog feature is off. We use the docs locale list as a reference
  // so that every known locale gets a blog-{code} collection with the correct dir
  // structure, falling back to the conventional default path.
  for (const [code] of Object.entries(settings.locales)) {
    blogLocaleCollections[`blog-${code}`] = defineCollection({
      loader: glob({ pattern: "**/*.{md,mdx}", base: `./${DEFAULT_BLOG_LOCALE_DIR_PREFIX}${code}` }),
      schema: blogSchema,
    });
  }
}

export const collections = { docs, ...localeCollections, ...versionCollections, blog, ...blogLocaleCollections };
