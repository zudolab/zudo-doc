/**
 * Public entry for `@takazudo/zudo-doc/integrations/llms-txt`.
 *
 * Framework-agnostic build emitter that produces `dist/llms.txt` and
 * `dist/llms-full.txt` (plus per-locale variants) with byte-identical
 * format vs the legacy Astro integration in
 * `src/integrations/llms-txt.ts`.
 *
 * Typical zfb registration (see ./README.md for the full snippet):
 *
 *   import { emitLlmsTxt } from "@takazudo/zudo-doc/integrations/llms-txt";
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

export { createLlmsTxtDevMiddleware } from "./dev-middleware.js";
export type {
  LlmsTxtDevMiddlewareOptions,
  LlmsTxtMiddleware,
  LlmsTxtMiddlewareLogger,
  LlmsTxtNextFn,
} from "./dev-middleware.js";
export { emitLlmsTxt } from "./emit.js";
export {
  generateLlmsFullTxt,
  generateLlmsTxt,
} from "./generate.js";
export {
  collectMdFiles,
  isExcluded,
  loadDocEntries,
  parseMarkdownFile,
  slugToUrl,
} from "./load.js";
export { stripImportsAndJsx, stripMarkdown } from "./strip.js";
export type {
  LlmsDocEntry,
  LlmsTxtEmitOptions,
  LlmsTxtEmitResult,
  LlmsTxtFrontmatter,
  LlmsTxtLoadOptions,
  LlmsTxtLocaleConfig,
  LlmsTxtLogger,
  LlmsTxtSiteMeta,
} from "./types.js";
