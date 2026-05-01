// `@zudo-doc/zudo-doc-v2/integrations/doc-history` — preBuild runner.
//
// Emits `<projectRoot>/.zfb/doc-history-meta.json`, the per-page git
// metadata manifest consumed at bundle time by
// `pages/lib/_doc-history-area.tsx` (via the `#doc-history-meta`
// tsconfig path alias). The page imports the JSON statically so esbuild
// inlines it; this avoids pulling Node-only `fs` / `child_process` code
// into the client bundle.
//
// Schema: `{ [composedSlug]: { author, createdDate, updatedDate } }`,
// where `composedSlug` is the bare slug for the default locale
// (e.g. `getting-started/intro`) and `<localeKey>/<slug>` for non-default
// locales (e.g. `ja/getting-started/intro`). Pages with no manifest entry
// fall through to the SSR-empty branch in `_doc-history-area.tsx`.
//
// ### CRITICAL: SKIP_DOC_HISTORY=1 contract
//
// CI's `build-site` job runs with a shallow `fetch-depth: 1` clone, so
// `git log --follow` would either fail or return useless data. The
// build-site pipeline therefore sets `SKIP_DOC_HISTORY=1`, and this
// runner MUST short-circuit by writing literal `{}\n` and returning
// immediately — without invoking git. The page-side static import
// resolves to that empty object, the SSR fallback is omitted, and the
// dedicated `build-history` CI job (full clone) merges real history
// into the deploy artifact in parallel.
//
// Breaking this contract breaks CI in a non-obvious way: the shallow
// clone makes `git log --follow` slow / empty / error-prone, and the
// page bundle ends up with stale or missing manifest data. Do not
// remove the env-var short-circuit without coordinating a CI change.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

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
}

/** Manifest shape — keyed by composedSlug. */
export type DocHistoryMetaManifest = Record<string, DocHistoryMetaEntry>;

const META_OUT_RELATIVE_DIR = ".zfb";
const META_OUT_FILENAME = "doc-history-meta.json";

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

  // The git-history helpers live in the sibling
  // `@zudo-doc/doc-history-server` package's source tree. The compiled
  // dist re-exports `getDocHistory` (full content) but not the lighter
  // `getFileCommits` / `getCommitInfo` pair we need here, so we go
  // directly to the .ts source. Resolving via `package.json` keeps this
  // independent of the workspace layout.
  const { collectContentFiles, getFileCommits, getCommitInfo } =
    await loadGitHistoryHelpers(projectRoot);

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

  const meta: DocHistoryMetaManifest = {};

  for (const [localeKey, contentDir] of dirEntries) {
    const files = collectContentFiles(contentDir);
    for (const { filePath, slug } of files) {
      // maxEntries=2: we only need the newest (entries[0]) and oldest
      // (entries[1]) commits to derive updatedDate + createdDate + author.
      const commits = getFileCommits(filePath, 2);
      if (commits.length === 0) continue; // untracked / not yet committed

      const newestInfo = getCommitInfo(commits[0], filePath);
      // When there is only one commit, oldest === newest.
      const oldestInfo =
        commits.length > 1
          ? getCommitInfo(commits[commits.length - 1], filePath)
          : newestInfo;

      const composedSlug = localeKey ? `${localeKey}/${slug}` : slug;
      meta[composedSlug] = {
        // Author comes from the FIRST (oldest) commit.
        author: oldestInfo.author,
        // createdDate = oldest commit; updatedDate = newest commit.
        createdDate: oldestInfo.date,
        updatedDate: newestInfo.date,
      };
    }
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

/** Shape of the helpers we need from doc-history-server's git-history module. */
type GitHistoryHelpers = {
  collectContentFiles(dir: string): Array<{ filePath: string; slug: string }>;
  getFileCommits(filePath: string, maxEntries?: number): string[];
  getCommitInfo(
    hash: string,
    filePath: string,
  ): { hash: string; date: string; author: string; message: string };
};

/**
 * Resolve `git-history.ts` inside `@zudo-doc/doc-history-server`'s source
 * tree. We import the .ts file directly (not the built dist) because the
 * lower-level helpers `getFileCommits` / `getCommitInfo` aren't part of
 * the package's public dist exports — only the higher-level
 * `getDocHistory` is. Going through `require.resolve` on the package's
 * `package.json` keeps this resilient to workspace layout changes.
 */
async function loadGitHistoryHelpers(
  projectRoot: string,
): Promise<GitHistoryHelpers> {
  // TODO: factor `getFileCommits` / `getCommitInfo` into the public
  // dist exports of `@zudo-doc/doc-history-server` so this can become
  // a plain `import` from the package's main entry.
  const localRequire = createRequire(
    pathToFileURL(path.join(projectRoot, "noop.js")).href,
  );
  let pkgJsonPath: string;
  try {
    pkgJsonPath = localRequire.resolve("@zudo-doc/doc-history-server/package.json");
  } catch {
    // Fall back to the workspace-relative path used by the legacy
    // `scripts/zfb-prebuild.mjs`. Keeps behaviour byte-identical when
    // the package is laid out under `packages/doc-history-server/`.
    pkgJsonPath = path.resolve(
      projectRoot,
      "packages/doc-history-server/package.json",
    );
  }
  const gitHistoryPath = path.resolve(
    path.dirname(pkgJsonPath),
    "src/git-history.ts",
  );
  const mod = (await import(pathToFileURL(gitHistoryPath).href)) as GitHistoryHelpers;
  return {
    collectContentFiles: mod.collectContentFiles,
    getFileCommits: mod.getFileCommits,
    getCommitInfo: mod.getCommitInfo,
  };
}
