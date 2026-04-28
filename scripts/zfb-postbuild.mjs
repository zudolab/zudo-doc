#!/usr/bin/env node
// zfb-postbuild — runs after `zfb build` via the npm `postbuild` lifecycle.
//
// Invokes the three filesystem-emitting integrations that previously hung
// off Astro's `astro:build:done` hook:
//
//   1. doc-history  — generates per-page git history JSON. Gated on
//                     settings.docHistory; honours SKIP_DOC_HISTORY=1 (CI
//                     uses a separate parallel build-history job).
//   2. search-index — emits dist/search-index.json consumed by the
//                     in-browser search island and the Cloudflare
//                     search-worker.
//   3. llms-txt     — emits dist/llms.txt and dist/llms-full.txt for the
//                     default locale plus per-locale variants. Gated on
//                     settings.llmsTxt.
//
// zfb v0's plugin runtime is metadata-only, so the order here is the
// authoritative source of truth. Sitemap is not in this list — it is
// served as a pages/sitemap.xml.tsx zfb route from epic E8.

import path from "node:path";
import process from "node:process";

const consoleLogger = {
  info: (msg) => console.log(`[zfb-postbuild] ${msg}`),
  warn: (msg) => console.warn(`[zfb-postbuild] ${msg}`),
};

function buildLocaleArray(locales) {
  if (!locales) return [];
  return Object.entries(locales).map(([code, locale]) => ({
    code,
    dir: locale.dir,
  }));
}

function buildLocaleRecord(locales) {
  if (!locales) return undefined;
  return Object.fromEntries(
    Object.entries(locales).map(([code, locale]) => [code, { dir: locale.dir }]),
  );
}

async function main() {
  const projectRoot = process.cwd();
  // zfb's default outDir is `dist/`; zfb.config.ts does not override it.
  const outDir = path.resolve(projectRoot, "dist");

  const { settings } = await import(
    path.resolve(projectRoot, "src/config/settings.ts")
  );

  // 1. doc-history
  if (settings.docHistory) {
    if (process.env.SKIP_DOC_HISTORY === "1") {
      consoleLogger.info("Skipping doc history generation (SKIP_DOC_HISTORY=1)");
    } else {
      const { runDocHistoryPostBuild } = await import(
        "@zudo-doc/zudo-doc-v2/integrations/doc-history"
      );
      await runDocHistoryPostBuild(
        {
          docsDir: settings.docsDir,
          locales: buildLocaleRecord(settings.locales),
        },
        { outDir, logger: consoleLogger },
      );
    }
  }

  // 2. search-index — no settings gate (matches legacy Astro behaviour).
  {
    const { emitSearchIndex } = await import(
      "@zudo-doc/zudo-doc-v2/integrations/search-index"
    );
    emitSearchIndex({
      outDir,
      docsDir: settings.docsDir,
      locales: buildLocaleRecord(settings.locales),
      base: settings.base,
      logger: consoleLogger,
    });
  }

  // 3. llms-txt
  if (settings.llmsTxt) {
    const { emitLlmsTxt } = await import(
      "@zudo-doc/zudo-doc-v2/integrations/llms-txt"
    );
    emitLlmsTxt({
      outDir,
      siteName: settings.siteName,
      siteDescription: settings.siteDescription,
      base: settings.base,
      siteUrl: settings.siteUrl || undefined,
      defaultLocaleDir: settings.docsDir,
      locales: buildLocaleArray(settings.locales),
      logger: consoleLogger,
    });
  }
}

main().catch((err) => {
  console.error("[zfb-postbuild] failed:", err);
  process.exit(1);
});
