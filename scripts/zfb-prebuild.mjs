#!/usr/bin/env node
// zfb-prebuild — runs before `zfb build` via the npm `prebuild` lifecycle.
//
// Invokes two pre-steps before `zfb build`:
//
//   1. claude-resources — scans the project's `.claude/` tree and emits
//      generated MDX into the docs content collection so the subsequent
//      `zfb build` picks it up like any other doc.
//
//   2. doc-history-meta — walks every content directory, runs `git log`
//      with maxEntries=2 per file, and emits `.zfb/doc-history-meta.json`
//      (schema: { [composedSlug]: { author, createdDate, updatedDate } }).
//      `pages/lib/_doc-history-area.tsx` imports this JSON statically at
//      bundle time so the DocHistoryIsland SSR fallback contains the author
//      marker without pulling Node-only `fs` utilities into the page tree.
//      When SKIP_DOC_HISTORY=1 is set (shallow CI clone), an empty manifest
//      is emitted immediately to avoid slow/empty git calls.
//
// We wire it through an npm-script hook instead of a zfb plugin lifecycle
// because zfb v0's plugins array is metadata-only — see #500 S2 for the
// migration plan once zfb adopts lifecycle hooks.
//
// Settings are loaded via dynamic import so this script doesn't carry a
// top-level dependency on TypeScript module resolution at parse time
// (tsx handles the .ts boundary at runtime).

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ── Step 1: claude-resources ─────────────────────────────────────────────────

async function runClaudeResourcesStep(settings, projectRoot) {
  if (!settings.claudeResources) {
    return;
  }

  const { runClaudeResourcesPreStep } = await import(
    "@zudo-doc/zudo-doc-v2/integrations/claude-resources"
  );

  await runClaudeResourcesPreStep({
    claudeDir: settings.claudeResources.claudeDir,
    projectRoot: settings.claudeResources.projectRoot ?? projectRoot,
    docsDir: settings.docsDir,
  });
}

// ── Step 2: doc-history-meta ─────────────────────────────────────────────────

/**
 * Emit `.zfb/doc-history-meta.json` from git history.
 *
 * composedSlug is the bare slug for the default locale (e.g.
 * "getting-started/intro") and "<localeKey>/<slug>" for non-default
 * locales (e.g. "ja/getting-started/intro") — matching the fetch-path
 * branching used by the DocHistoryIsland client fetch.
 *
 * Skips files with no git history (new/untracked files) by omitting them
 * from the manifest. The host wrapper treats undefined manifest entries as
 * "no SSR data".
 */
async function runDocHistoryMetaStep(settings, projectRoot) {
  if (!settings.docHistory) {
    return;
  }

  const zfbDir = path.resolve(projectRoot, ".zfb");
  const outPath = path.join(zfbDir, "doc-history-meta.json");

  // Shallow CI clones have no useful git history — skip git calls and
  // emit an empty manifest so the static import in the page tree resolves.
  if (process.env.SKIP_DOC_HISTORY === "1") {
    console.log("[zfb-prebuild] SKIP_DOC_HISTORY=1 — emitting empty doc-history-meta.json");
    fs.mkdirSync(zfbDir, { recursive: true });
    fs.writeFileSync(outPath, "{}\n", "utf-8");
    return;
  }

  const { collectContentFiles, getFileCommits, getCommitInfo } = await import(
    path.resolve(projectRoot, "packages/doc-history-server/src/git-history.ts")
  );

  // Collect [localeKey | null, absoluteDir] pairs.
  // null = default locale (bare slug); string = prefixed slug.
  /** @type {Array<[string | null, string]>} */
  const dirEntries = [
    [null, path.resolve(projectRoot, settings.docsDir)],
  ];
  if (settings.locales) {
    for (const [code, locale] of Object.entries(settings.locales)) {
      dirEntries.push([code, path.resolve(projectRoot, locale.dir)]);
    }
  }

  /** @type {Record<string, { author: string; createdDate: string; updatedDate: string }>} */
  const meta = {};

  for (const [localeKey, contentDir] of dirEntries) {
    const files = collectContentFiles(contentDir);
    for (const { filePath, slug } of files) {
      // maxEntries=2: we only need the newest (entries[0]) and oldest
      // (entries[1]) commits to get updatedDate + createdDate + author.
      const commits = getFileCommits(filePath, 2);
      if (commits.length === 0) {
        // No git history yet (untracked / not yet committed) — skip.
        continue;
      }

      const newestInfo = getCommitInfo(commits[0], filePath);
      // When there is only one commit, oldest === newest.
      const oldestInfo = commits.length > 1
        ? getCommitInfo(commits[commits.length - 1], filePath)
        : newestInfo;

      const composedSlug = localeKey ? `${localeKey}/${slug}` : slug;
      meta[composedSlug] = {
        // Author comes from the FIRST (oldest) commit.
        author: oldestInfo.author,
        // createdDate = oldest commit date; updatedDate = newest commit date.
        createdDate: oldestInfo.date,
        updatedDate: newestInfo.date,
      };
    }
  }

  fs.mkdirSync(zfbDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(meta, null, 2) + "\n", "utf-8");
  console.log(
    `[zfb-prebuild] doc-history-meta: wrote ${Object.keys(meta).length} entries → .zfb/doc-history-meta.json`,
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const projectRoot = process.cwd();

  const { settings } = await import(
    path.resolve(projectRoot, "src/config/settings.ts")
  );

  await runClaudeResourcesStep(settings, projectRoot);
  await runDocHistoryMetaStep(settings, projectRoot);
}

main().catch((err) => {
  console.error("[zfb-prebuild] failed:", err);
  process.exit(1);
});
