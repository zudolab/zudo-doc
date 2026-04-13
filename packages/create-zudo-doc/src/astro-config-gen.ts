import type { UserChoices } from "./prompts.js";

/**
 * Programmatically generate astro.config.ts from user choices.
 *
 * This replaces the old approach of copying the monorepo's astro.config.ts
 * and stripping features with regex. By generating from scratch, we only
 * include imports, integrations, and config blocks for selected features.
 */
export function generateAstroConfig(choices: UserChoices): string {
  const hasSearch = choices.features.includes("search");
  const hasI18n = choices.features.includes("i18n");
  const hasDocHistory = choices.features.includes("docHistory");
  const hasLlmsTxt = choices.features.includes("llmsTxt");
  const hasClaudeResources = choices.features.includes("claudeResources");

  const lines: string[] = [];

  // --- Imports ---
  lines.push(`import { defineConfig } from "astro/config";`);
  lines.push(`import { fileURLToPath } from "node:url";`);
  lines.push(`import mdx from "@astrojs/mdx";`);
  lines.push(`import preact from "@astrojs/preact";`);
  lines.push(`import {`);
  lines.push(`  transformerMetaHighlight,`);
  lines.push(`  transformerMetaWordHighlight,`);
  lines.push(`} from "@shikijs/transformers";`);
  lines.push(`import tailwindcss from "@tailwindcss/vite";`);
  lines.push(`import { colorSchemes } from "./src/config/color-schemes";`);
  lines.push(`import { settings } from "./src/config/settings";`);

  if (hasSearch) {
    lines.push(
      `import { searchIndexIntegration } from "./src/integrations/search-index";`,
    );
  }
  if (hasDocHistory) {
    lines.push(
      `import { docHistoryIntegration } from "./src/integrations/doc-history";`,
    );
  }
  if (hasLlmsTxt) {
    lines.push(
      `import { llmsTxtIntegration } from "./src/integrations/llms-txt";`,
    );
  }
  if (hasClaudeResources) {
    lines.push(
      `import { claudeResourcesIntegration } from "./src/integrations/claude-resources";`,
    );
  }

  lines.push(`import remarkCjkFriendly from "remark-cjk-friendly";`);
  lines.push(`import remarkDirective from "remark-directive";`);
  lines.push(
    `import { remarkAdmonitions } from "./src/plugins/remark-admonitions";`,
  );
  lines.push(
    `import { remarkResolveMarkdownLinks } from "./src/plugins/remark-resolve-markdown-links";`,
  );
  lines.push(
    `import { rehypeCodeTitle } from "./src/plugins/rehype-code-title";`,
  );
  lines.push(
    `import { rehypeHeadingLinks } from "./src/plugins/rehype-heading-links";`,
  );
  lines.push(`import { rehypeMermaid } from "./src/plugins/rehype-mermaid";`);
  lines.push(
    `import { rehypeStripMdExtension } from "./src/plugins/rehype-strip-md-extension";`,
  );

  lines.push(``);

  // --- Shiki config ---
  lines.push(
    `const activeScheme = colorSchemes[settings.colorScheme];`,
  );
  lines.push(
    `const shikiTheme = activeScheme?.shikiTheme ?? "dracula";`,
  );
  lines.push(``);
  lines.push(`const shikiTransformers = [`);
  lines.push(`  transformerMetaHighlight(),`);
  lines.push(`  transformerMetaWordHighlight(),`);
  lines.push(`];`);
  lines.push(``);

  if (choices.colorSchemeMode === "light-dark") {
    lines.push(`const shikiConfig = settings.colorMode`);
    lines.push(`  ? {`);
    lines.push(`      themes: {`);
    lines.push(`        light:`);
    lines.push(
      `          colorSchemes[settings.colorMode.lightScheme]?.shikiTheme ??`,
    );
    lines.push(`          "github-light",`);
    lines.push(
      `        dark:`
    );
    lines.push(
      `          colorSchemes[settings.colorMode.darkScheme]?.shikiTheme ?? "dracula",`,
    );
    lines.push(`      },`);
    lines.push(`      defaultColor: false as const,`);
    lines.push(`      transformers: shikiTransformers,`);
    lines.push(`    }`);
    lines.push(`  : {`);
    lines.push(`      theme: shikiTheme,`);
    lines.push(`      transformers: shikiTransformers,`);
    lines.push(`    };`);
  } else {
    lines.push(`const shikiConfig = {`);
    lines.push(`  theme: shikiTheme,`);
    lines.push(`  transformers: shikiTransformers,`);
    lines.push(`};`);
  }

  lines.push(``);

  // --- Config object ---
  lines.push(`export default defineConfig({`);
  lines.push(`  output: "static",`);
  lines.push(`  base: settings.base,`);

  // Integrations
  const integrations: string[] = [];
  integrations.push(`    mdx()`);
  integrations.push(`    preact({ compat: true })`);
  if (hasSearch) integrations.push(`    searchIndexIntegration()`);
  if (hasLlmsTxt)
    integrations.push(`    ...(settings.llmsTxt ? [llmsTxtIntegration()] : [])`);
  if (hasDocHistory)
    integrations.push(
      `    ...(settings.docHistory ? [docHistoryIntegration()] : [])`,
    );
  if (hasClaudeResources)
    integrations.push(
      `    ...(settings.claudeResources\n      ? [claudeResourcesIntegration(settings.claudeResources)]\n      : [])`,
    );

  lines.push(`  integrations: [`);
  lines.push(integrations.join(",\n") + ",");
  lines.push(`  ],`);

  // i18n block
  if (hasI18n) {
    lines.push(`  i18n: {`);
    lines.push(`    defaultLocale: ${JSON.stringify(choices.defaultLang)},`);
    lines.push(
      `    locales: [${JSON.stringify(choices.defaultLang)}, ...Object.keys(settings.locales)],`,
    );
    lines.push(`    routing: {`);
    lines.push(`      prefixDefaultLocale: false,`);
    lines.push(`    },`);
    lines.push(`  },`);
  }

  // Vite
  lines.push(`  vite: {`);
  lines.push(`    plugins: [tailwindcss()],`);
  lines.push(`  },`);

  // Markdown
  lines.push(`  markdown: {`);
  lines.push(`    shikiConfig,`);
  lines.push(`    remarkPlugins: [`);
  lines.push(`      remarkDirective,`);
  lines.push(`      remarkAdmonitions,`);
  lines.push(`      [remarkResolveMarkdownLinks, {`);
  lines.push(
    `        rootDir: fileURLToPath(new URL(".", import.meta.url)),`,
  );
  lines.push(`        docsDir: settings.docsDir,`);
  lines.push(`        locales: Object.fromEntries(`);
  lines.push(
    `          Object.entries(settings.locales).map(([code, config]) => [code, { dir: config.dir }])`,
  );
  lines.push(`        ),`);
  lines.push(`        versions: settings.versions`);
  lines.push(
    `          ? settings.versions.map((v) => ({ slug: v.slug, docsDir: v.docsDir }))`,
  );
  lines.push(`          : false,`);
  lines.push(`        base: settings.base,`);
  lines.push(`        trailingSlash: settings.trailingSlash,`);
  lines.push(`        onBrokenLinks: settings.onBrokenMarkdownLinks,`);
  lines.push(`      }],`);
  lines.push(`      ...(settings.cjkFriendly ? [remarkCjkFriendly] : []),`);
  lines.push(`    ],`);
  lines.push(`    rehypePlugins: [`);
  lines.push(`      rehypeCodeTitle,`);
  lines.push(`      rehypeHeadingLinks,`);
  lines.push(`      rehypeStripMdExtension,`);
  lines.push(`      ...(settings.mermaid ? [rehypeMermaid] : []),`);
  lines.push(`    ],`);
  lines.push(`  },`);

  lines.push(`});`);

  return lines.join("\n") + "\n";
}
