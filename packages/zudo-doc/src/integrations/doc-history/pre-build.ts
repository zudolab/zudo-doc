// `@takazudo/zudo-doc/integrations/doc-history` — preBuild runner.
//
// Emits `<projectRoot>/.zfb/doc-history-meta.json`, the per-page git
// metadata manifest consumed at bundle time by
// `pages/lib/_doc-history-area.tsx` (via the `#doc-history-meta`
// tsconfig path alias). The page imports the JSON statically so esbuild
// inlines it; this avoids pulling Node-only `fs` / `child_process` code
// into the client bundle.
//
// Schema: `{ [composedSlug]: { author, createdDate, updatedDate, ext } }`,
// where `composedSlug` is the bare slug for the default locale
// (e.g. `getting-started/intro`) and `<localeKey>/<slug>` for non-default
// locales (e.g. `ja/getting-started/intro`). Pages with no manifest entry
// fall through to the SSR-empty branch in `_doc-history-area.tsx`.
//
// ### SKIP_DOC_HISTORY=1 contract
//
// When `SKIP_DOC_HISTORY=1` is set this runner short-circuits by writing
// literal `{}\n` and returning immediately, without invoking git. The
// page-side static import resolves to an empty object, so DocMetainfoArea
// returns null on every page (no Created/Updated/Author block rendered).
//
// ### CI usage (as of #1479 SSG-meta-gap fix)
//
// All three CI workflows (pr-checks.yml, main-deploy.yml,
// preview-deploy.yml) use `fetch-depth: 0` in their build-site job and
// do NOT set SKIP_DOC_HISTORY. This allows the preBuild step to run
// `git log --follow` on each content file and produce a populated
// manifest, so the SSG HTML contains real Created/Updated/Author values.
// The parallel `build-history` job (also `fetch-depth: 0`) still
// generates the per-page dropdown JSON files for the DocHistory island.
//
// The SKIP_DOC_HISTORY=1 short-circuit is retained for cases where the
// caller explicitly wants to skip git-based meta generation (e.g. a
// truly shallow clone with no git history, a custom CI variant, or a
// future optimisation that passes a pre-computed manifest via a different
// mechanism).

import fs from "node:fs";
import path from "node:path";
import { cpus } from "node:os";
import {
  collectContentFiles,
  getFileCommitsMetaAsync,
} from "@takazudo/zudo-doc-history-server/git-history";

/** A single non-default locale entry; mirrors `settings.locales[*]`. */
export interface DocHistoryMetaLocaleConfig {
  /** Absolute or project-relative directory holding this locale's MDX content. */
  dir: string;
}

/** A versioned docs entry; mirrors `settings.versions[*]`. */
export interface DocHistoryMetaVersionConfig {
  /** Slug used to namespace the version (e.g. `"1.0"`). */
  slug: string;
  /** Default-locale content directory for this version. */
  docsDir: string;
  /** Optional non-default locales, keyed by locale code. */
  locales?: Record<string, DocHistoryMetaLocaleConfig>;
}

/** Options accepted by the preBuild runner. */
export interface RunDocHistoryMetaOptions {
  /** Project root — directory containing `zfb.config.ts`. Resolves all relative paths. */
  projectRoot: string;
  /** Default-locale content directory (e.g. `"src/content/docs"`). */
  docsDir: string;
  /** Optional non-default locales, keyed by locale code. */
  locales?: Record<string, DocHistoryMetaLocaleConfig>;
  /**
   * Optional versioned docs (e.g. legacy `1.0`). Each version produces
   * its own default-locale collection plus per-locale variants.
   * Currently unused by the host's emitted manifest (parity with
   * `scripts/zfb-prebuild.mjs`) — accepted here so callers can pass
   * versions through without ad-hoc filtering.
   */
  versions?: DocHistoryMetaVersionConfig[];
  /** Optional logger. Falls back to `console`. */
  logger?: { info(msg: string): void; warn?(msg: string): void };
}

/** A single manifest entry. */
export interface DocHistoryMetaEntry {
  author: string;
  createdDate: string;
  updatedDate: string;
  /**
   * Source file extension (".mdx" or ".md") — the content walkers accept
   * both (`collectContentFiles` matches `\.mdx?$`), so the view-source URL
   * builder in the host's `_doc-history-area.tsx` reads this instead of
   * hardcoding ".mdx". Optional in older manifests; readers fall back to
   * ".mdx" when absent.
   */
  ext?: ".mdx" | ".md";
}

/** Manifest shape — keyed by composedSlug. */
export type DocHistoryMetaManifest = Record<string, DocHistoryMetaEntry>;

const META_OUT_RELATIVE_DIR = ".zfb";
const META_OUT_FILENAME = "doc-history-meta.json";

/**
 * Derive the manifest `ext` value from a content file path. The walkers
 * only collect `.md` / `.mdx` files (`collectContentFiles` matches
 * `\.mdx?$`), so anything not ending in ".md" is ".mdx".
 */
export function deriveSourceExt(filePath: string): ".mdx" | ".md" {
  return filePath.endsWith(".md") ? ".md" : ".mdx";
}

/**
 * Tiny in-file semaphore for bounded parallelism — avoids a p-limit dependency.
 * Limits concurrent async tasks to `concurrency` at a time.
 * Ported from packages/doc-history-server/src/cli.ts.
 */
export function makeSemaphore(concurrency: number) {
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

/**
 * Emit `<projectRoot>/.zfb/doc-history-meta.json` from git history.
 *
 * Honours the `SKIP_DOC_HISTORY=1` env-var short-circuit (see header
 * comment for the CI contract). Writes a byte-identical empty manifest
 * (`{}\n`) when set; writes a sorted-key JSON document otherwise.
 *
 * Skips files with no git history (untracked / not yet committed) by
 * omitting them from the manifest — the page-side wrapper treats
 * undefined entries as "no SSR data".
 */
export async function runDocHistoryMetaStep(
  options: RunDocHistoryMetaOptions,
): Promise<void> {
  const projectRoot = path.resolve(options.projectRoot);
  const zfbDir = path.join(projectRoot, META_OUT_RELATIVE_DIR);
  const outPath = path.join(zfbDir, META_OUT_FILENAME);
  const logger = options.logger ?? defaultLogger;

  // CI shallow-clone short-circuit. MUST stay byte-equivalent to the
  // legacy `scripts/zfb-prebuild.mjs` path: literal `{}\n` so the
  // tsconfig `#doc-history-meta` alias resolves to an empty object at
  // bundle time without triggering a slow / failing `git log` call.
  if (process.env.SKIP_DOC_HISTORY === "1") {
    logger.info(
      "[doc-history-meta] SKIP_DOC_HISTORY=1 — emitting empty doc-history-meta.json",
    );
    fs.mkdirSync(zfbDir, { recursive: true });
    fs.writeFileSync(outPath, "{}\n", "utf-8");
    return;
  }

  // git-history helpers are imported statically at the top of the file
  // from `@takazudo/zudo-doc-history-server/git-history` — the published
  // package's `./git-history` subpath export.

  // Collect [localeKey | null, absoluteDir] pairs. `null` = default
  // locale (bare slug); a string locale key produces a prefixed slug.
  const dirEntries: Array<[string | null, string]> = [
    [null, path.resolve(projectRoot, options.docsDir)],
  ];
  if (options.locales) {
    for (const [code, locale] of Object.entries(options.locales)) {
      dirEntries.push([code, path.resolve(projectRoot, locale.dir)]);
    }
  }

  // Bounded parallelism: default to CPU count (min 2, max 8) to saturate git
  // without spawning excessively — each getFileCommitsMetaAsync issues one
  // git process. Ported from packages/doc-history-server/src/cli.ts.
  const concurrency = Math.min(8, Math.max(2, cpus().length));
  const acquire = makeSemaphore(concurrency);

  // Build the flat job list in deterministic order (locale-then-file). Ordering
  // is critical for byte-identical JSON output: we assemble the manifest in
  // this same index order AFTER all async git calls resolve, regardless of
  // which tasks finish first.
  const jobs: Array<{ composedSlug: string; filePath: string }> = [];
  for (const [localeKey, contentDir] of dirEntries) {
    const files = collectContentFiles(contentDir);
    for (const { filePath, slug } of files) {
      const composedSlug = localeKey ? `${localeKey}/${slug}` : slug;
      jobs.push({ composedSlug, filePath });
    }
  }

  // Run all git calls concurrently up to the semaphore cap. Results are stored
  // in a pre-allocated array keyed by the original job index so that insertion
  // order into `meta` is always the deterministic iteration order, not
  // completion order. This preserves JSON key order (= byte-identical output).
  type CommitMeta = { author: string; date: string };
  const results: Array<
    { newest: CommitMeta; oldest: CommitMeta } | null
  > = new Array(jobs.length).fill(null);

  await Promise.all(
    jobs.map(async ({ filePath }, i) => {
      const release = await acquire();
      try {
        // Single spawn: walk the full history with --follow, take first (newest)
        // and last (oldest) records. Avoids the 3-4 spawns of the previous
        // getFileCommits(1) + getCommitInfo + getFirstCommit + getCommitInfo
        // pattern, and eliminates the unbounded --reverse walk in getFirstCommit.
        // See issue #1875 for spawn-count analysis.
        const allCommits = await getFileCommitsMetaAsync(filePath);
        if (allCommits.length === 0) return; // untracked / not yet committed

        const newestInfo = allCommits[0]!;
        const oldestInfo = allCommits[allCommits.length - 1] ?? newestInfo;
        results[i] = {
          newest: { author: newestInfo.author, date: newestInfo.date },
          oldest: { author: oldestInfo.author, date: oldestInfo.date },
        };
      } finally {
        release();
      }
    }),
  );

  // Assemble manifest in deterministic job order (preserves key insertion order
  // for byte-identical JSON.stringify output).
  const meta: DocHistoryMetaManifest = {};
  for (let i = 0; i < jobs.length; i++) {
    const result = results[i];
    if (result == null) continue; // untracked / not yet committed

    meta[jobs[i]!.composedSlug] = {
      // Author comes from the FIRST (oldest) commit.
      author: result.oldest.author,
      // createdDate = oldest commit; updatedDate = newest commit.
      createdDate: result.oldest.date,
      updatedDate: result.newest.date,
      // Source extension for the view-source URL (".md" walkers accepted).
      ext: deriveSourceExt(jobs[i]!.filePath),
    };
  }

  fs.mkdirSync(zfbDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(meta, null, 2) + "\n", "utf-8");
  logger.info(
    `[doc-history-meta] wrote ${Object.keys(meta).length} entries → .zfb/doc-history-meta.json`,
  );
}

const defaultLogger = {
  info(msg: string) {
    console.log(msg);
  },
  warn(msg: string) {
    console.warn(msg);
  },
};

