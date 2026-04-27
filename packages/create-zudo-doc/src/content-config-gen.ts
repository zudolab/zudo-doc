import type { UserChoices } from "./prompts.js";

/**
 * Programmatically generate content.config.ts from user choices.
 *
 * The content config defines Astro content collections. The base `docs`
 * collection is always present. Locale and version collections are added
 * conditionally based on selected features.
 */
export function generateContentConfig(choices: UserChoices): string {
  const hasI18n = choices.features.includes("i18n");
  const hasVersioning = choices.features.includes("versioning");
  const hasBlog = choices.features.includes("blog");

  const lines: string[] = [];

  // --- Imports ---
  lines.push(`import { defineCollection } from "astro:content";`);
  lines.push(`import { z } from "astro/zod";`);
  lines.push(`import { glob } from "astro/loaders";`);
  lines.push(`import { settings } from "./config/settings";`);
  lines.push(``);

  // --- Schema ---
  lines.push(`const docsSchema = z.object({`);
  lines.push(`  title: z.string(),`);
  lines.push(`  description: z.string().optional(),`);
  lines.push(`  category: z.string().optional(),`);
  lines.push(`  sidebar_position: z.number().optional(),`);
  lines.push(`  sidebar_label: z.string().optional(),`);
  lines.push(`  tags: z.array(z.string()).optional(),`);
  lines.push(`  search_exclude: z.boolean().optional(),`);
  lines.push(
    `  pagination_next: z.string().nullable().optional(),`,
  );
  lines.push(
    `  pagination_prev: z.string().nullable().optional(),`,
  );
  lines.push(`  draft: z.boolean().optional(),`);
  lines.push(`  unlisted: z.boolean().optional(),`);
  lines.push(`  hide_sidebar: z.boolean().optional(),`);
  lines.push(`  hide_toc: z.boolean().optional(),`);
  lines.push(`  standalone: z.boolean().optional(),`);
  lines.push(`  slug: z.string().optional(),`);
  lines.push(`  generated: z.boolean().optional(),`);
  lines.push(`}).passthrough();`);
  lines.push(``);

  // --- Base docs collection ---
  lines.push(`const docs = defineCollection({`);
  lines.push(
    `  loader: glob({ pattern: "**/*.{md,mdx}", base: \`./$\{settings.docsDir}\` }),`,
  );
  lines.push(`  schema: docsSchema,`);
  lines.push(`});`);
  lines.push(``);

  // --- Locale collections ---
  if (hasI18n) {
    lines.push(
      `const localeCollections: Record<string, ReturnType<typeof defineCollection>> = {};`,
    );
    lines.push(
      `for (const [code, config] of Object.entries(settings.locales)) {`,
    );
    lines.push(
      `  localeCollections[\`docs-$\{code}\`] = defineCollection({`,
    );
    lines.push(
      `    loader: glob({ pattern: "**/*.{md,mdx}", base: \`./$\{config.dir}\` }),`,
    );
    lines.push(`    schema: docsSchema,`);
    lines.push(`  });`);
    lines.push(`}`);
    lines.push(``);
  }

  // --- Version collections ---
  if (hasVersioning) {
    lines.push(
      `const versionCollections: Record<string, ReturnType<typeof defineCollection>> = {};`,
    );
    lines.push(`if (settings.versions) {`);
    lines.push(`  for (const version of settings.versions) {`);
    lines.push(
      `    versionCollections[\`docs-v-$\{version.slug}\`] = defineCollection({`,
    );
    lines.push(
      `      loader: glob({ pattern: "**/*.{md,mdx}", base: \`./$\{version.docsDir}\` }),`,
    );
    lines.push(`      schema: docsSchema,`);
    lines.push(`    });`);
    lines.push(`    if (version.locales) {`);
    lines.push(
      `      for (const [code, config] of Object.entries(version.locales)) {`,
    );
    lines.push(
      `        versionCollections[\`docs-v-$\{version.slug}-$\{code}\`] = defineCollection({`,
    );
    lines.push(
      `          loader: glob({ pattern: "**/*.{md,mdx}", base: \`./$\{config.dir}\` }),`,
    );
    lines.push(`          schema: docsSchema,`);
    lines.push(`        });`);
    lines.push(`      }`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push(``);
  }

  // --- Blog collections ---
  if (hasBlog) {
    // Exported so `src/types/blog-entry.ts` can derive `BlogData` via
    // `z.infer<typeof blogSchema>` (single source of truth for the
    // frontmatter shape — keep schema and type in sync automatically).
    lines.push(`export const blogSchema = z.object({`);
    lines.push(`  title: z.string(),`);
    lines.push(`  description: z.string().optional(),`);
    lines.push(`  date: z.coerce.date(),`);
    lines.push(`  author: z.string().optional(),`);
    lines.push(`  authors: z.string().array().optional(),`);
    lines.push(`  tags: z.array(z.string()).optional(),`);
    lines.push(`  excerpt: z.string().optional(),`);
    lines.push(`  hasMore: z.boolean().optional(),`);
    lines.push(`  draft: z.boolean().optional(),`);
    lines.push(`  unlisted: z.boolean().optional(),`);
    lines.push(`  slug: z.string().optional(),`);
    lines.push(`}).passthrough();`);
    lines.push(``);

    lines.push(`const blogBaseDir = settings.blog ? settings.blog.dir : "src/content/blog";`);
    lines.push(`const blog = defineCollection({`);
    lines.push(
      `  loader: glob({ pattern: "**/*.{md,mdx}", base: \`./$\{blogBaseDir}\` }),`,
    );
    lines.push(`  schema: blogSchema,`);
    lines.push(`});`);
    lines.push(``);

    if (hasI18n) {
      lines.push(
        `const blogLocaleCollections: Record<string, ReturnType<typeof defineCollection>> = {};`,
      );
      lines.push(`if (settings.blog && settings.blog.locales) {`);
      lines.push(
        `  for (const [code, config] of Object.entries(settings.blog.locales)) {`,
      );
      lines.push(
        `    blogLocaleCollections[\`blog-$\{code}\`] = defineCollection({`,
      );
      lines.push(
        `      loader: glob({ pattern: "**/*.{md,mdx}", base: \`./$\{config.dir}\` }),`,
      );
      lines.push(`      schema: blogSchema,`);
      lines.push(`    });`);
      lines.push(`  }`);
      lines.push(`}`);
      lines.push(``);
    }
  }

  // --- Export collections ---
  const collectionParts = ["docs"];
  if (hasI18n) collectionParts.push("...localeCollections");
  if (hasVersioning) collectionParts.push("...versionCollections");
  if (hasBlog) {
    collectionParts.push("blog");
    if (hasI18n) collectionParts.push("...blogLocaleCollections");
  }
  lines.push(
    `export const collections = { ${collectionParts.join(", ")} };`,
  );

  return lines.join("\n") + "\n";
}
