import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import { settings } from "./config/settings";

const docsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  sidebar_position: z.number().optional(),
  sidebar_label: z.string().optional(),
  tags: z.array(z.string()).optional(),
  search_exclude: z.boolean().optional(),
  pagination_next: z.string().nullable().optional(), // doc slug or null to hide
  pagination_prev: z.string().nullable().optional(), // doc slug or null to hide
  draft: z.boolean().optional(), // Exclude from build entirely
  unlisted: z.boolean().optional(), // Built but noindexed, hidden from sidebar/nav
  slug: z.string().optional(), // Custom URL slug override
});

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
    // Main docs for this version
    versionCollections[`docs-${version.slug}`] = defineCollection({
      loader: glob({ pattern: "**/*.{md,mdx}", base: `./${version.docsDir}` }),
      schema: docsSchema,
    });
    // Locale variants for this version
    if (version.locales) {
      for (const [code, config] of Object.entries(version.locales)) {
        versionCollections[`docs-${version.slug}-${code}`] = defineCollection({
          loader: glob({ pattern: "**/*.{md,mdx}", base: `./${config.dir}` }),
          schema: docsSchema,
        });
      }
    }
  }
}

export const collections = { docs, ...localeCollections, ...versionCollections };
