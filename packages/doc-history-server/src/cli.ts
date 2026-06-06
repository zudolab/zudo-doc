#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { cpus } from "node:os";
import { parseCliArgs } from "./args.js";
import { collectContentFiles, getDocHistory } from "./git-history.js";
import { getContentDirEntries } from "./shared.js";

/**
 * Tiny in-file semaphore for bounded parallelism — avoids a p-limit dependency.
 * Limits concurrent async tasks to `concurrency` at a time.
 */
function makeSemaphore(concurrency: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  function next(): void {
    if (queue.length > 0 && running < concurrency) {
      // Do not increment running here — the dequeued tryRun call handles it.
      queue.shift()!();
    }
  }

  return function acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      function tryRun() {
        if (running < concurrency) {
          running++;
          resolve(() => {
            running--;
            next();
          });
        } else {
          queue.push(tryRun);
        }
      }
      tryRun();
    });
  };
}

async function generate(options: {
  contentDir: string;
  locales: Array<{ key: string; dir: string }>;
  outDir: string;
  maxEntries: number;
}): Promise<number> {
  const { contentDir, locales, outDir, maxEntries } = options;
  const startTime = performance.now();

  const dirEntries = getContentDirEntries(contentDir, locales);

  mkdirSync(outDir, { recursive: true });
  let totalFiles = 0;
  let errorCount = 0;

  // Bounded parallelism: default to CPU count (min 2, max 8) to saturate git
  // without spawning excessively — each getDocHistory issues ~2 git processes.
  const concurrency = Math.min(8, Math.max(2, cpus().length));
  const acquire = makeSemaphore(concurrency);

  const tasks: Promise<void>[] = [];

  for (const [localeKey, dir] of dirEntries) {
    const files = collectContentFiles(dir);
    const label = localeKey ?? "default";
    console.log(`Processing ${label}: ${files.length} files in ${dir}`);

    for (const { filePath, slug } of files) {
      const task = (async () => {
        const release = await acquire();
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
        } finally {
          release();
        }
      })();
      tasks.push(task);
    }
  }

  await Promise.all(tasks);

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\nGenerated ${totalFiles} history files in ${elapsed}s${errorCount ? ` (${errorCount} errors)` : ""}`,
  );

  return errorCount;
}

const options = parseCliArgs(process.argv.slice(2));
console.log(`doc-history-server: content-dir resolved to ${options.contentDir}`);
for (const locale of options.locales) {
  console.log(`doc-history-server: locale ${locale.key} resolved to ${locale.dir}`);
}
generate(options)
  .then((errorCount) => {
    // Fail loud, not silent: a partial git failure must not ship incomplete
    // doc-history JSON behind a green CI (same fail-loud intent as args.ts /
    // #1907 / #1913).
    if (errorCount > 0) {
      console.error(
        `doc-history-server: ${errorCount} file(s) failed to generate — exiting non-zero so CI does not ship incomplete doc-history.`,
      );
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error(
      `doc-history-server: generation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  });
