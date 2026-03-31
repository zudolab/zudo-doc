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
import { remarkResolveMarkdownLinks } from "./src/plugins/remark-resolve-markdown-links";
import { rehypeCodeTitle } from "./src/plugins/rehype-code-title";
import { rehypeHeadingLinks } from "./src/plugins/rehype-heading-links";
import { rehypeMermaid } from "./src/plugins/rehype-mermaid";
import { rehypeStripMdExtension } from "./src/plugins/rehype-strip-md-extension";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { rehypeD2 } from "./src/plugins/rehype-d2";
import { remarkD2Client } from "./src/plugins/remark-d2-client";
import { remarkD2ThemeInject } from "./src/plugins/remark-d2-theme-inject";

const isDev = import.meta.env?.DEV ?? process.argv.includes("dev");

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

// astro-d2 is conditionally imported only for build mode
const astroD2Integration = settings.d2 && !isDev
  ? [(await import("astro-d2")).default({
      theme: { default: "0", dark: "200" },
      layout: "elk",
      pad: 20,
      skipGeneration: !!process.env.CI,
      ...(settings.d2BuildMode === "wasm" ? { experimental: { useD2js: true } } : {}),
    })]
  : [];

export default defineConfig({
  output: "static",
  trailingSlash: settings.trailingSlash ? "always" : "never",
  ...(settings.aiAssistant ? { adapter: node({ mode: "standalone" }) } : {}),
  base: settings.base,
  integrations: [
    ...astroD2Integration,
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
    defaultLocale: "en",
    locales: ["en", ...Object.keys(settings.locales)],
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
      // D2: In dev mode, transform code blocks for client-side WASM rendering (before Shiki)
      // In build mode, inject theme overrides before astro-d2 processes blocks
      ...(settings.d2 && isDev ? [remarkD2Client] : []),
      ...(settings.d2 && !isDev ? [remarkD2ThemeInject] : []),
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
    ],
    rehypePlugins: [
      rehypeCodeTitle,
      rehypeHeadingLinks, // Must run before Astro's built-in heading ID plugin
      rehypeStripMdExtension, // Strips .md/.mdx from raw HTML <a> tags (remark plugin handles mdast links)
      ...(settings.mermaid ? [rehypeMermaid] : []),
      ...(settings.d2 ? [rehypeD2] : []),
      ...(settings.math ? [rehypeKatex] : []),
    ],
  },
});
