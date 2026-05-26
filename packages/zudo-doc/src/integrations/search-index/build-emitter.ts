// Build-time emitter: walk loaded content and write `search-index.json`
// next to the rest of the static assets. Designed to be called from a
// zfb post-build hook (or any equivalent runtime) — the function is
// runtime-agnostic so the same code works under `zfb build`, a Node CLI,
// or a unit test.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectSearchEntries } from "./collect.ts";
import type { SearchIndexConfig, SearchIndexEntry } from "./types.ts";

export interface SearchIndexBuildResult {
  /** Absolute path of the JSON file that was written. */
  jsonPath: string;
  /** Number of entries serialised. */
  entryCount: number;
  /** The raw entries — exposed so callers can pipe the same data into a Worker bundle if needed. */
  entries: SearchIndexEntry[];
}

export interface SearchIndexBuildOptions extends SearchIndexConfig {
  /** Absolute path of the build output directory (e.g. zfb's `outDir`). */
  outDir: string;
  /** Optional logger; defaults to a no-op so builds stay quiet by default. */
  logger?: { info: (msg: string) => void };
}

/**
 * Walk the configured content directories, build the flat search index,
 * and write `search-index.json` to `outDir`. Returns the entries so
 * callers (e.g. a downstream `search-worker` bundler) can reuse the
 * same data without re-walking the filesystem.
 *
 * Schema is byte-identical to today's Astro integration — see
 * `types.ts` for the locked-in shape.
 */
export function emitSearchIndex(
  options: SearchIndexBuildOptions,
): SearchIndexBuildResult {
  const { outDir, logger, ...config } = options;
  const entries = collectSearchEntries(config);

  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, "search-index.json");
  writeFileSync(jsonPath, JSON.stringify(entries));

  logger?.info(`Generated search index with ${entries.length} entries`);

  return { jsonPath, entryCount: entries.length, entries };
}
