/**
 * Build-time emitter that writes `llms.txt` and `llms-full.txt` for the
 * default locale plus every additional locale.
 *
 * Designed as a zfb-shaped build hook: the function takes a single
 * options object, performs synchronous fs writes, and returns the list
 * of files it produced. Adapters wrap it for their build system —
 * Astro's `astro:build:done`, a future zfb plugin's `onBuildDone`,
 * a Node CLI in CI, etc.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { generateLlmsFullTxt, generateLlmsTxt } from "./generate.ts";
import { loadDocEntries } from "./load.ts";
import type { LlmsTxtEmitOptions, LlmsTxtEmitResult } from "./types.ts";

/**
 * Walk every configured content root, generate the two files per
 * locale, and write them to `outDir` (default locale) and
 * `outDir/<code>/` (additional locales). The output directory is
 * created if needed; existing files are overwritten.
 */
export function emitLlmsTxt(options: LlmsTxtEmitOptions): LlmsTxtEmitResult {
  const {
    outDir,
    base,
    siteUrl,
    siteName,
    siteDescription,
    defaultLocaleDir,
    locales = [],
    logger,
  } = options;

  const meta = { siteName, siteDescription };
  const written: string[] = [];

  // Default locale.
  const defaultEntries = loadDocEntries({
    contentDir: defaultLocaleDir,
    locale: null,
    base,
    siteUrl,
  });

  mkdirSync(outDir, { recursive: true });

  const defaultIndexPath = join(outDir, "llms.txt");
  const defaultFullPath = join(outDir, "llms-full.txt");
  writeFileSync(defaultIndexPath, generateLlmsTxt(defaultEntries, meta));
  writeFileSync(defaultFullPath, generateLlmsFullTxt(defaultEntries, meta));
  written.push(defaultIndexPath, defaultFullPath);
  logger?.info(
    `Generated llms.txt and llms-full.txt (${defaultEntries.length} pages)`,
  );

  // Additional locales.
  for (const { code, dir } of locales) {
    const localeEntries = loadDocEntries({
      contentDir: dir,
      locale: code,
      base,
      siteUrl,
    });
    const localeDir = join(outDir, code);
    mkdirSync(localeDir, { recursive: true });
    const indexPath = join(localeDir, "llms.txt");
    const fullPath = join(localeDir, "llms-full.txt");
    writeFileSync(indexPath, generateLlmsTxt(localeEntries, meta));
    writeFileSync(fullPath, generateLlmsFullTxt(localeEntries, meta));
    written.push(indexPath, fullPath);
    logger?.info(
      `Generated ${code}/llms.txt and ${code}/llms-full.txt (${localeEntries.length} pages)`,
    );
  }

  return { written };
}
