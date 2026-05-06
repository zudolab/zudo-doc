/**
 * Public entry for `@zudo-doc/zudo-doc-v2/integrations/llms-txt`.
 *
 * Framework-agnostic build emitter that produces `dist/llms.txt` and
 * `dist/llms-full.txt` (plus per-locale variants) with byte-identical
 * format vs the legacy Astro integration in
 * `src/integrations/llms-txt.ts`.
 *
 * Typical zfb registration (see ./README.md for the full snippet):
 *
 *   import { emitLlmsTxt } from "@zudo-doc/zudo-doc-v2/integrations/llms-txt";
 *
 *   // inside a zfb plugin's onBuildDone hook
 *   emitLlmsTxt({
 *     outDir,
 *     siteName: "...",
 *     siteDescription: "...",
 *     base: "/",
 *     defaultLocaleDir: "src/content/docs",
 *     locales: [{ code: "ja", dir: "src/content/docs-ja" }],
 *   });
 *
 * The pure `generate*` and `loadDocEntries` helpers are exported as well
 * so a zfb non-HTML page (`pages/llms.txt.tsx`) or a unit test can build
 * the strings directly without touching the filesystem twice.
 */

export { createLlmsTxtDevMiddleware } from "./dev-middleware.ts";
export type {
  LlmsTxtDevMiddlewareOptions,
  LlmsTxtMiddleware,
  LlmsTxtMiddlewareLogger,
  LlmsTxtNextFn,
} from "./dev-middleware.ts";
export { emitLlmsTxt } from "./emit.ts";
export {
  generateLlmsFullTxt,
  generateLlmsTxt,
} from "./generate.ts";
export {
  collectMdFiles,
  isExcluded,
  loadDocEntries,
  parseMarkdownFile,
  slugToUrl,
} from "./load.ts";
export { stripImportsAndJsx, stripMarkdown } from "./strip.ts";
export type {
  LlmsDocEntry,
  LlmsTxtEmitOptions,
  LlmsTxtEmitResult,
  LlmsTxtFrontmatter,
  LlmsTxtLoadOptions,
  LlmsTxtLocaleConfig,
  LlmsTxtLogger,
  LlmsTxtSiteMeta,
} from "./types.ts";
