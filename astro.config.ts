import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import node from "@astrojs/node";
import mdx from "@astrojs/mdx";
import preact from "@astrojs/preact";
import {
  transformerMetaHighlight,
  transformerMetaWordHighlight,
} from "@shikijs/transformers";
import tailwindcss from "@tailwindcss/vite";
import { colorSchemes } from "./src/config/color-schemes";
import { settings } from "./src/config/settings";
import { claudeResourcesIntegration } from "./src/integrations/claude-resources";
import { docHistoryIntegration } from "./src/integrations/doc-history";
import { searchIndexIntegration } from "./src/integrations/search-index";
import { llmsTxtIntegration } from "./src/integrations/llms-txt";
import { sitemapIntegration } from "./src/integrations/sitemap";
import remarkDirective from "remark-directive";
import { remarkAdmonitions } from "./src/plugins/remark-admonitions";
import { remarkExcerpt } from "./src/plugins/remark-excerpt";
import { remarkResolveMarkdownLinks } from "./src/plugins/remark-resolve-markdown-links";
import { rehypeCodeTitle } from "./src/plugins/rehype-code-title";
import { rehypeHeadingLinks } from "./src/plugins/rehype-heading-links";
import { rehypeImageEnlarge } from "./src/plugins/rehype-image-enlarge";
import { rehypeMermaid } from "./src/plugins/rehype-mermaid";
import { rehypeStripMdExtension } from "./src/plugins/rehype-strip-md-extension";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkCjkFriendly from "remark-cjk-friendly";

const activeScheme = colorSchemes[settings.colorScheme];
const shikiTheme = activeScheme?.shikiTheme ?? "dracula";

const shikiTransformers = [
  transformerMetaHighlight(),
  transformerMetaWordHighlight(),
];

const shikiConfig = settings.colorMode
  ? {
      themes: {
        light:
          colorSchemes[settings.colorMode.lightScheme]?.shikiTheme ??
          "github-light",
        dark:
          colorSchemes[settings.colorMode.darkScheme]?.shikiTheme ?? "dracula",
      },
      defaultColor: false as const,
      transformers: shikiTransformers,
    }
  : {
      theme: shikiTheme,
      transformers: shikiTransformers,
    };

export default defineConfig({
  output: "static",
  trailingSlash: settings.trailingSlash ? "always" : "never",
  ...(settings.aiAssistant ? { adapter: node({ mode: "standalone" }) } : {}),
  base: settings.base,
  integrations: [
    mdx(),
    preact({ compat: true }),
    searchIndexIntegration(),
    ...(settings.llmsTxt ? [llmsTxtIntegration()] : []),
    ...(settings.sitemap && !settings.noindex ? [sitemapIntegration()] : []),
    ...(settings.docHistory ? [docHistoryIntegration()] : []),
    ...(settings.claudeResources
      ? [claudeResourcesIntegration(settings.claudeResources)]
      : []),
  ],
  i18n: {
    defaultLocale: settings.defaultLocale,
    locales: [settings.defaultLocale, ...Object.keys(settings.locales)],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig,
    remarkPlugins: [
      remarkDirective, // Must run before remarkAdmonitions
      remarkAdmonitions,
      [remarkResolveMarkdownLinks, {
        rootDir: fileURLToPath(new URL(".", import.meta.url)),
        docsDir: settings.docsDir,
        locales: Object.fromEntries(
          Object.entries(settings.locales).map(([code, config]) => [code, { dir: config.dir }])
        ),
        versions: settings.versions
          ? settings.versions.map((v) => ({ slug: v.slug, docsDir: v.docsDir }))
          : false,
        base: settings.base,
        trailingSlash: settings.trailingSlash,
        onBrokenLinks: settings.onBrokenMarkdownLinks,
      }],
      ...(settings.math ? [remarkMath] : []),
      ...(settings.cjkFriendly ? [remarkCjkFriendly] : []),
      // Always-on; no-op when no <!-- more --> marker is present.
      remarkExcerpt,
    ],
    rehypePlugins: [
      rehypeCodeTitle,
      rehypeHeadingLinks, // Must run before Astro's built-in heading ID plugin
      rehypeStripMdExtension, // Strips .md/.mdx from raw HTML <a> tags (remark plugin handles mdast links)
      ...(settings.imageEnlarge ? [rehypeImageEnlarge] : []),
      ...(settings.mermaid ? [rehypeMermaid] : []),
      ...(settings.math ? [rehypeKatex] : []),
    ],
  },
});
