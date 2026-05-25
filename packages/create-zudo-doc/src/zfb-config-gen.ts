import type { UserChoices } from "./prompts.js";

/**
 * Programmatically generate zfb.config.ts from user choices.
 *
 * Replaces the former astro-config-gen.ts + content-config-gen.ts pair.
 * In the zfb world, content-collection schemas live inside zfb.config.ts
 * itself — there is no separate content.config.ts.
 */
export function generateZfbConfig(choices: UserChoices): string {
  const hasSearch = choices.features.includes("search");
  const hasDocHistory = choices.features.includes("docHistory");
  const hasLlmsTxt = choices.features.includes("llmsTxt");
  const hasClaudeResources = choices.features.includes("claudeResources");
  const hasTagGovernance = choices.features.includes("tagGovernance");

  const lines: string[] = [];

  // --- Imports ---
  lines.push(`import { z } from "zod";`);
  lines.push(`import { defineConfig } from "zfb/config";`);
  lines.push(`import { settings } from "./src/config/settings";`);

  if (hasTagGovernance) {
    lines.push(
      `import { tagVocabulary } from "./src/config/tag-vocabulary";`,
    );
  }
  if (hasSearch) {
    lines.push(
      `import { searchIndexPlugin } from "./src/integrations/search-index";`,
    );
  }
  if (hasDocHistory) {
    lines.push(
      `import { docHistoryPlugin } from "./src/integrations/doc-history";`,
    );
  }
  if (hasLlmsTxt) {
    lines.push(
      `import { llmsTxtPlugin } from "./src/integrations/llms-txt";`,
    );
  }
  if (hasClaudeResources) {
    lines.push(
      `import { claudeResourcesPlugin } from "./src/integrations/claude-resources";`,
    );
  }

  lines.push(``);

  // --- Tags schema builder (only when tagGovernance is selected) ---
  if (hasTagGovernance) {
    lines.push(`function buildTagsSchema() {`);
    lines.push(
      `  const vocabularyActive = settings.tagVocabulary && settings.tagGovernance === "strict";`,
    );
    lines.push(
      `  if (!vocabularyActive) return z.array(z.string()).optional();`,
    );
    lines.push(`  const allowed = new Set<string>();`);
    lines.push(`  for (const entry of tagVocabulary) {`);
    lines.push(`    allowed.add(entry.id);`);
    lines.push(
      `    for (const alias of entry.aliases ?? []) allowed.add(alias);`,
    );
    lines.push(`  }`);
    lines.push(`  const allowedList = [...allowed];`);
    lines.push(
      `  if (allowedList.length === 0) return z.array(z.string()).optional();`,
    );
    lines.push(`  const [first, ...rest] = allowedList;`);
    lines.push(
      `  return z.array(z.enum([first, ...rest] as [string, ...string[]])).optional();`,
    );
    lines.push(`}`);
    lines.push(``);
  }

  // --- Schema definition ---
  lines.push(`const docsSchema = z`);
  lines.push(`  .object({`);
  lines.push(`    title: z.string(),`);
  lines.push(`    description: z.string().optional(),`);
  lines.push(`    category: z.string().optional(),`);
  lines.push(`    sidebar_position: z.number().optional(),`);
  lines.push(`    sidebar_label: z.string().optional(),`);
  if (hasTagGovernance) {
    lines.push(`    tags: buildTagsSchema(),`);
  } else {
    lines.push(`    tags: z.array(z.string()).optional(),`);
  }
  lines.push(`    search_exclude: z.boolean().optional(),`);
  lines.push(`    pagination_next: z.string().nullable().optional(),`);
  lines.push(`    pagination_prev: z.string().nullable().optional(),`);
  lines.push(`    draft: z.boolean().optional(),`);
  lines.push(`    unlisted: z.boolean().optional(),`);
  lines.push(`    hide_sidebar: z.boolean().optional(),`);
  lines.push(`    hide_toc: z.boolean().optional(),`);
  lines.push(`    doc_history: z.boolean().optional(),`);
  lines.push(`    standalone: z.boolean().optional(),`);
  lines.push(`    slug: z.string().optional(),`);
  lines.push(`    generated: z.boolean().optional(),`);
  lines.push(`  })`);
  lines.push(`  .passthrough();`);
  lines.push(``);
  lines.push(
    `const docsSchemaJson = z.toJSONSchema(docsSchema) as Record<string, unknown>;`,
  );
  lines.push(``);

  // --- Collection type ---
  lines.push(`interface CollectionEntryShape {`);
  lines.push(`  name: string;`);
  lines.push(`  path: string;`);
  lines.push(`  schema: Record<string, unknown>;`);
  lines.push(`}`);
  lines.push(``);

  // --- Collections array ---
  lines.push(`const collections: CollectionEntryShape[] = [];`);
  lines.push(``);
  lines.push(
    `collections.push({ name: "docs", path: settings.docsDir, schema: docsSchemaJson });`,
  );
  lines.push(``);
  // Locale collections — empty loop when locales is {} (i18n disabled).
  lines.push(
    `for (const [code, config] of Object.entries(settings.locales)) {`,
  );
  lines.push(
    `  collections.push({ name: \`docs-\${code}\`, path: config.dir, schema: docsSchemaJson });`,
  );
  lines.push(`}`);
  lines.push(``);
  // Version collections — outer `if` short-circuits when versions is false.
  lines.push(`if (settings.versions) {`);
  lines.push(`  for (const version of settings.versions) {`);
  lines.push(`    collections.push({`);
  lines.push(`      name: \`docs-v-\${version.slug}\`,`);
  lines.push(`      path: version.docsDir,`);
  lines.push(`      schema: docsSchemaJson,`);
  lines.push(`    });`);
  lines.push(`    if (version.locales) {`);
  lines.push(
    `      for (const [code, config] of Object.entries(version.locales)) {`,
  );
  lines.push(`        collections.push({`);
  lines.push(`          name: \`docs-v-\${version.slug}-\${code}\`,`);
  lines.push(`          path: config.dir,`);
  lines.push(`          schema: docsSchemaJson,`);
  lines.push(`        });`);
  lines.push(`      }`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push(``);

  // --- Plugins ---
  const plugins: string[] = [];
  if (hasSearch) {
    plugins.push(`    searchIndexPlugin()`);
  }
  if (hasDocHistory) {
    plugins.push(
      `    ...(settings.docHistory\n` +
        `      ? [docHistoryPlugin({ docsDir: settings.docsDir, locales: settings.locales })]\n` +
        `      : [])`,
    );
  }
  if (hasLlmsTxt) {
    plugins.push(`    ...(settings.llmsTxt ? [llmsTxtPlugin()] : [])`);
  }
  if (hasClaudeResources) {
    plugins.push(
      `    ...(settings.claudeResources\n` +
        `      ? [claudeResourcesPlugin(settings.claudeResources)]\n` +
        `      : [])`,
    );
  }

  // --- Export ---
  lines.push(`export default defineConfig({`);
  lines.push(`  framework: "preact",`);
  lines.push(`  tailwind: { enabled: true },`);
  lines.push(`  collections,`);
  lines.push(`  plugins: [`);
  if (plugins.length > 0) {
    lines.push(plugins.join(",\n") + ",");
  }
  lines.push(`  ],`);
  lines.push(`});`);

  return lines.join("\n") + "\n";
}
