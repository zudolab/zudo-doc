import type { UserChoices } from "./prompts.js";

/**
 * Programmatically generate zfb.config.ts from user choices.
 *
 * W7A (#1736): emits zfb plugins in the host's INLINE-OBJECT shape —
 * `{ name: "./plugins/<plugin>.mjs", options: {...} }` — not the
 * pre-cutover factory-import pattern (`import { fooPlugin } from
 * "./src/integrations/foo"`). Inline functions are not supported by zfb's
 * plugin runtime (see `@takazudo/zfb/plugins` source); plugins MUST be
 * authored as standalone `.mjs` modules referenced from `zfb.config.ts`
 * by `name`. The plugin source files are shipped by the base/feature
 * templates under `plugins/<plugin>.mjs` and `templates/features/<feature>/
 * files/plugins/<plugin>.mjs`.
 *
 * Replaces the former astro-config-gen.ts + content-config-gen.ts pair.
 * In the zfb world, content-collection schemas live inside zfb.config.ts
 * itself — there is no separate content.config.ts.
 */
export function generateZfbConfig(choices: UserChoices): string {
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

  // --- Locale helpers used by integrationPlugins (always emitted because
  //     search-index + copy-public are always-on; locale-shaped data is
  //     consumed by search-index even when there's only the default locale).
  lines.push(
    `const localeArray = Object.entries(settings.locales).map(([code, locale]) => ({`,
  );
  lines.push(`  code,`);
  lines.push(`  dir: locale.dir,`);
  lines.push(`}));`);
  lines.push(`const localeRecord = Object.fromEntries(`);
  lines.push(
    `  Object.entries(settings.locales).map(([code, locale]) => [code, { dir: locale.dir }]),`,
  );
  lines.push(`);`);
  lines.push(``);

  // --- Plugins — inline-object shape matches host. Each entry's `name`
  //     is a relative path to a `.mjs` plugin module shipped by the
  //     base/feature templates. zfb's plugin runtime resolves the module
  //     and dispatches lifecycle hooks (preBuild / postBuild / devMiddleware)
  //     on its default export. ---
  lines.push(`const integrationPlugins = [`);
  if (hasClaudeResources) {
    lines.push(`  ...(settings.claudeResources`);
    lines.push(`    ? [`);
    lines.push(`        {`);
    lines.push(`          name: "./plugins/claude-resources-plugin.mjs",`);
    lines.push(`          options: {`);
    lines.push(`            claudeDir: settings.claudeResources.claudeDir,`);
    lines.push(`            projectRoot: settings.claudeResources.projectRoot,`);
    lines.push(`            docsDir: settings.docsDir,`);
    lines.push(`          },`);
    lines.push(`        },`);
    lines.push(`      ]`);
    lines.push(`    : []),`);
  }
  if (hasDocHistory) {
    lines.push(`  ...(settings.docHistory`);
    lines.push(`    ? [`);
    lines.push(`        {`);
    lines.push(`          name: "./plugins/doc-history-plugin.mjs",`);
    lines.push(`          options: {`);
    lines.push(`            docsDir: settings.docsDir,`);
    lines.push(`            locales: localeRecord,`);
    lines.push(`          },`);
    lines.push(`        },`);
    lines.push(`      ]`);
    lines.push(`    : []),`);
  }
  // search-index is always-on (matches host) — emits dist/search-index.json
  // even when no <Search /> widget mounts; ~few-KB cost is acceptable and
  // keeps the dev-middleware route registered for the always-mounted
  // search widget in pages/lib/_header-with-defaults.tsx.
  lines.push(`  {`);
  lines.push(`    name: "./plugins/search-index-plugin.mjs",`);
  lines.push(`    options: {`);
  lines.push(`      docsDir: settings.docsDir,`);
  lines.push(`      locales: localeRecord,`);
  lines.push(`      base: settings.base,`);
  lines.push(`    },`);
  lines.push(`  },`);
  if (hasLlmsTxt) {
    lines.push(`  ...(settings.llmsTxt`);
    lines.push(`    ? [`);
    lines.push(`        {`);
    lines.push(`          name: "./plugins/llms-txt-plugin.mjs",`);
    lines.push(`          options: {`);
    lines.push(`            siteName: settings.siteName,`);
    lines.push(`            siteDescription: settings.siteDescription,`);
    lines.push(`            base: settings.base,`);
    lines.push(`            siteUrl: settings.siteUrl,`);
    lines.push(`            defaultLocaleDir: settings.docsDir,`);
    lines.push(`            locales: localeArray,`);
    lines.push(`          },`);
    lines.push(`        },`);
    lines.push(`      ]`);
    lines.push(`    : []),`);
  }
  // copy-public is always-on (matches host) — workaround for upstream zfb
  // gap where `zfb build` does not copy `public/` to dist/. Empty/missing
  // public/ is a no-op, so the cost to projects without public/ is zero.
  lines.push(`  {`);
  lines.push(`    name: "./plugins/copy-public-plugin.mjs",`);
  lines.push(`    options: {`);
  lines.push(`      publicDir: "public",`);
  lines.push(`    },`);
  lines.push(`  },`);
  lines.push(`];`);
  lines.push(``);

  // --- Export ---
  lines.push(`export default defineConfig({`);
  lines.push(`  framework: "preact",`);
  lines.push(`  tailwind: { enabled: true },`);
  lines.push(`  collections,`);
  lines.push(`  stripMdExt: true,`);
  lines.push(`  resolveMarkdownLinks: {`);
  lines.push(`    enabled: true,`);
  lines.push(`    dirs: [`);
  lines.push(`      { dir: settings.docsDir, routePrefix: "/docs/" },`);
  lines.push(
    `      ...Object.entries(settings.locales).map(([code, locale]) => ({`,
  );
  lines.push(`        dir: locale.dir,`);
  lines.push(`        routePrefix: \`/\${code}/docs/\`,`);
  lines.push(`      })),`);
  lines.push(`    ],`);
  lines.push(`    onBrokenLinks: "warn",`);
  lines.push(`  },`);
  lines.push(`  base: settings.base,`);
  lines.push(`  trailingSlash: settings.trailingSlash,`);
  // markdown.features block — mirrors the zfb next.13 opt-in model.
  //
  // Value-shape rule (empirically verified against the next.13 Rust loader):
  // object-typed features (githubAutolinks, codeEnrichment, imageDimensions,
  // linkValidation) REJECT the `true` shorthand and must be given an options
  // object (`{}` or fields). Boolean-OR-object features (githubAlerts,
  // readingTime, codeTabs, admonitionsPreset, mermaid, headingMarkerToc)
  // accept `true`.
  // Note: imageEnlarge was formerly a Boolean-OR-object feature here, but
  // next.18 hard-removed it from the Rust config schema — it is now
  // re-implemented in userland via an MDX p-override in pages/_mdx-components.ts
  // (gated on settings.imageEnlarge). Do NOT add imageEnlarge back here.
  //
  // Intentionally omitted features (known-blocked at zfb next.13):
  //   - tocExport: injects indented `export const toc = [...]` that MDX
  //     parses as content, breaking esbuild with "Expected }" across the
  //     whole corpus. Re-enable when the upstream Rust pass emits the
  //     export at column 0. (Filed as zudolab/zudo-doc#1814.)
  //   - ruby: the `^{...}` annotation syntax 500s the SSR render at next.13.
  //     A registered stub cannot fix it — the error is inside zfb's Rust
  //     ruby pass. Re-enable when the upstream crate is fixed. (#1815.)
  //   - transclude: `:::include{file="..."}` 500s SSR (no registered
  //     <include> renderer); `![[...]]` wikilink form is a no-op.
  //     Re-enable when a transclude renderer is wired.
  //
  // githubAutolinks is omitted intentionally: the showcase hardcodes
  // `repo: "zudolab/zudo-doc"` but a scaffolded project belongs to a
  // different repo. Users can add `githubAutolinks: { repo: "owner/repo" }`
  // to their zfb.config.ts after scaffolding.
  lines.push(`  markdown: {`);
  lines.push(`    features: {`);
  lines.push(`      // Former-Core features (were always-on before zfb next.12).`);
  lines.push(`      // imageEnlarge was a former-Core feature but was hard-removed in zfb`);
  lines.push(`      // next.18 — it is now re-implemented via an MDX p-override.`);
  lines.push(`      admonitionsPreset: true,`);
  lines.push(`      mermaid: true,`);
  lines.push(`      headingMarkerToc: true,`);
  lines.push(`      // Safe opt-in features.`);
  lines.push(`      githubAlerts: true,`);
  lines.push(`      readingTime: true,`);
  lines.push(`      codeEnrichment: {},`);
  lines.push(`      codeTabs: true,`);
  lines.push(`      imageDimensions: {},`);
  lines.push(`      // warn-only link validation — failOnBroken: false never fails the build.`);
  lines.push(`      linkValidation: { failOnBroken: false },`);
  lines.push(`    },`);
  lines.push(`  },`);
  lines.push(`  plugins: integrationPlugins,`);
  lines.push(`});`);

  return lines.join("\n") + "\n";
}
