import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
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
import { sitemapIntegration } from "./src/integrations/sitemap";
import { rehypeCodeTitle } from "./src/plugins/rehype-code-title";
import { rehypeHeadingLinks } from "./src/plugins/rehype-heading-links";
import { rehypeMermaid } from "./src/plugins/rehype-mermaid";
import { rehypeStripMdExtension } from "./src/plugins/rehype-strip-md-extension";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

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
  base: settings.base,
  integrations: [
    mdx(),
    react(),
    searchIndexIntegration(),
    ...(settings.sitemap && !settings.noindex ? [sitemapIntegration()] : []),
    ...(settings.docHistory ? [docHistoryIntegration()] : []),
    ...(settings.claudeResources
      ? [claudeResourcesIntegration(settings.claudeResources)]
      : []),
  ],
  i18n: {
    defaultLocale: "en",
    locales: ["en", ...Object.keys(settings.locales)],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Astro 6 + Vite 7: the vite-plugin-astro `load` hook expects compile
      // metadata to be populated by the `transform` hook first. With Rollup's
      // default parallel file ops (20), virtual sub-modules (CSS/scripts) can
      // be loaded before their parent .astro file is transformed. Serializing
      // file operations eliminates this race condition.
      rollupOptions: {
        maxParallelFileOps: 1,
      },
    },
  },
  markdown: {
    shikiConfig,
    remarkPlugins: [
      ...(settings.math ? [remarkMath] : []),
    ],
    rehypePlugins: [
      rehypeCodeTitle,
      rehypeHeadingLinks, // Must run before Astro's built-in heading ID plugin
      rehypeStripMdExtension,
      ...(settings.mermaid ? [rehypeMermaid] : []),
      ...(settings.math ? [rehypeKatex] : []),
    ],
  },
});
