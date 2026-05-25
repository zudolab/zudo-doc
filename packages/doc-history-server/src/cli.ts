#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseCliArgs } from "./args.js";
import { collectContentFiles, getDocHistory } from "./git-history.js";
import { getContentDirEntries } from "./shared.js";

function generate(options: {
  contentDir: string;
  locales: Array<{ key: string; dir: string }>;
  outDir: string;
  maxEntries: number;
}): void {
  const { contentDir, locales, outDir, maxEntries } = options;
  const startTime = performance.now();

  const dirEntries = getContentDirEntries(contentDir, locales);

  mkdirSync(outDir, { recursive: true });
  let totalFiles = 0;
  let errorCount = 0;

  for (const [localeKey, dir] of dirEntries) {
    const files = collectContentFiles(dir);
    const label = localeKey ?? "default";
    console.log(`Processing ${label}: ${files.length} files in ${dir}`);

    for (const { filePath, slug } of files) {
      try {
        const history = getDocHistory(filePath, slug, maxEntries);
        const prefixedSlug = localeKey ? `${localeKey}/${slug}` : slug;
        const jsonPath = join(outDir, `${prefixedSlug}.json`);
        mkdirSync(dirname(jsonPath), { recursive: true });
        writeFileSync(jsonPath, JSON.stringify(history));
        totalFiles++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  Skipped ${slug}: ${msg}`);
        errorCount++;
      }
    }
  }

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\nGenerated ${totalFiles} history files in ${elapsed}s${errorCount ? ` (${errorCount} errors)` : ""}`,
  );
}

const options = parseCliArgs(process.argv.slice(2));
console.log(`doc-history-server: content-dir resolved to ${options.contentDir}`);
for (const locale of options.locales) {
  console.log(`doc-history-server: locale ${locale.key} resolved to ${locale.dir}`);
}
generate(options);
