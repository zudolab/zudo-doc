#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { collectContentFiles, getDocHistory } from "./git-history.js";

function parseArgs(args: string[]): {
  contentDir: string;
  locales: Array<{ key: string; dir: string }>;
  outDir: string;
  maxEntries: number;
} {
  let contentDir = "";
  const locales: Array<{ key: string; dir: string }> = [];
  let outDir = "";
  let maxEntries = 50;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--content-dir":
        contentDir = args[++i];
        break;
      case "--locale": {
        const val = args[++i];
        const colonIdx = val.indexOf(":");
        if (colonIdx === -1) {
          console.error(`Invalid --locale format: ${val} (expected key:dir)`);
          process.exit(1);
        }
        locales.push({
          key: val.slice(0, colonIdx),
          dir: val.slice(colonIdx + 1),
        });
        break;
      }
      case "--out-dir":
        outDir = args[++i];
        break;
      case "--max-entries":
        maxEntries = Number(args[++i]);
        break;
      default:
        if (args[i].startsWith("--")) {
          console.error(`Unknown option: ${args[i]}`);
          process.exit(1);
        }
    }
  }

  if (!contentDir) {
    console.error("Missing required --content-dir option");
    process.exit(1);
  }
  if (!outDir) {
    console.error("Missing required --out-dir option");
    process.exit(1);
  }

  return { contentDir, locales, outDir, maxEntries };
}

function generate(options: {
  contentDir: string;
  locales: Array<{ key: string; dir: string }>;
  outDir: string;
  maxEntries: number;
}): void {
  const { contentDir, locales, outDir, maxEntries } = options;
  const startTime = performance.now();

  // Build list of [localeKey | null, absoluteDir] pairs
  const dirEntries: Array<[string | null, string]> = [
    [null, resolve(contentDir)],
  ];
  for (const locale of locales) {
    dirEntries.push([locale.key, resolve(locale.dir)]);
  }

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

const options = parseArgs(process.argv.slice(2));
generate(options);
