#!/usr/bin/env node
/**
 * build-snapshots.mjs — orchestrate snapshot A (from-ref) and B (to-ref) builds.
 *
 * Usage:
 *   node scripts/migration-check/build-snapshots.mjs [options]
 *
 * Options:
 *   --no-build          Skip build if snapshot already exists in workspace
 *   --baseline-only     Build only snapshot A (from-ref); skip B
 *   --current-only      Build only snapshot B (to-ref); skip A
 *   --from-ref=<ref>    Override from-ref (default: config.fromRef = "origin/main")
 *   --to-ref=<ref>      Override to-ref (default: config.toRef = "HEAD")
 *
 * Outputs to .l-zfb-migration-check/snapshots/:
 *   a/              — built dist/ from from-ref
 *   a/_artifacts/   — non-HTML artifacts from snapshot A
 *   b/              — built dist/ from to-ref
 *   b/_artifacts/   — non-HTML artifacts from snapshot B
 *   manifest.json   — ref, commit, duration, framework, rewrite log for each
 */

import { existsSync, readFileSync } from "node:fs";
import {
  readFile,
  writeFile,
  cp,
  mkdir,
  rm,
  stat,
  readdir,
} from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import * as config from "./config.mjs";
import { rewriteFileDeps } from "./lib/rewrite-file-deps.mjs";

// ── Paths ─────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the repo root (two levels up from scripts/migration-check/). */
const REPO_ROOT = resolve(__dirname, "../..");

/** Absolute path to the snapshots/ directory inside the workspace. */
const SNAPSHOTS_DIR = join(REPO_ROOT, config.workspaceDir, "snapshots");
const SNAPSHOT_A_DIR = join(SNAPSHOTS_DIR, "a");
const SNAPSHOT_B_DIR = join(SNAPSHOTS_DIR, "b");
const MANIFEST_PATH = join(SNAPSHOTS_DIR, "manifest.json");

// ── Non-HTML artifacts ────────────────────────────────────────────────────────

/**
 * Relative paths (inside dist/) that should be copied to _artifacts/.
 * Files that do not exist in a particular snapshot's dist/ are silently skipped.
 */
const ARTIFACT_PATHS = [
  "robots.txt",
  "favicon.ico",
  "favicon.svg",
  "manifest.webmanifest",
  "search-index.json",
  "llms.txt",
  "llms-full.txt",
  "doc-history/index.json",
  "_redirects",
  "_headers",
  "sitemap.xml",
];

// ── CLI arg parsing ───────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    noBuild: false,
    baselineOnly: false,
    currentOnly: false,
    fromRef: config.fromRef,
    toRef: config.toRef,
  };

  for (const arg of argv) {
    if (arg === "--no-build") {
      args.noBuild = true;
    } else if (arg === "--baseline-only") {
      args.baselineOnly = true;
    } else if (arg === "--current-only") {
      args.currentOnly = true;
    } else if (arg.startsWith("--from-ref=")) {
      args.fromRef = arg.slice("--from-ref=".length);
    } else if (arg.startsWith("--to-ref=")) {
      args.toRef = arg.slice("--to-ref=".length);
    }
  }

  return args;
}

// ── Small utilities ───────────────────────────────────────────────────────────

/**
 * Sanitize a git ref string for use in a directory name.
 * e.g. "origin/main" → "origin-main", "feature/foo" → "feature-foo"
 */
function refToSlug(ref) {
  return ref
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Run a subprocess, streaming output to the terminal.
 * Throws if the process exits with a non-zero code.
 */
function runCmd(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${cmd} ${args.join(" ")} (exit ${result.status ?? "?"})`,
    );
  }
}

/**
 * Resolve a git ref to its full commit SHA.
 */
function resolveRef(repoRoot, ref) {
  return execSync(`git rev-parse ${ref}`, {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

/**
 * Detect the framework used in a directory by looking for config files.
 * Returns "astro", "zfb", or "unknown".
 */
function detectFramework(dir) {
  if (
    existsSync(join(dir, "astro.config.ts")) ||
    existsSync(join(dir, "astro.config.mjs")) ||
    existsSync(join(dir, "astro.config.js"))
  ) {
    return "astro";
  }
  if (existsSync(join(dir, "zfb.config.ts"))) {
    return "zfb";
  }
  return "unknown";
}

/**
 * Detect the build output directory from the framework config.
 * Attempts a simple text grep for `outDir`; defaults to "dist".
 */
function detectOutputDir(dir, framework) {
  const configFile =
    framework === "astro"
      ? join(dir, "astro.config.ts")
      : framework === "zfb"
        ? join(dir, "zfb.config.ts")
        : null;

  if (configFile && existsSync(configFile)) {
    try {
      const content = readFileSync(configFile, "utf8");
      const match = content.match(/outDir:\s*["']([^"']+)["']/);
      if (match) return match[1];
    } catch {
      // fall through to default
    }
  }

  return "dist";
}

// ── Worktree management ───────────────────────────────────────────────────────

/**
 * Create a git worktree at `worktreePath` checked out at `ref`.
 * Removes any existing worktree at that path first for a clean start.
 */
async function createWorktree(repoRoot, worktreePath, ref) {
  if (existsSync(worktreePath)) {
    console.log(`[S2] removing stale worktree at ${worktreePath} ...`);
    try {
      runCmd("git", ["worktree", "remove", "--force", worktreePath], repoRoot);
    } catch {
      // git worktree remove may fail if already deregistered; force-delete the dir
      await rm(worktreePath, { recursive: true, force: true });
      runCmd("git", ["worktree", "prune"], repoRoot);
    }
  }
  console.log(`[S2] git worktree add ${worktreePath} ${ref}`);
  runCmd("git", ["worktree", "add", worktreePath, ref], repoRoot);
}

/**
 * Remove a git worktree (best-effort; warns on failure).
 */
async function removeWorktree(repoRoot, worktreePath) {
  if (!existsSync(worktreePath)) return;
  try {
    runCmd("git", ["worktree", "remove", "--force", worktreePath], repoRoot);
  } catch (err) {
    console.warn(
      `[S2] warning: could not remove worktree at ${worktreePath}: ${err.message}`,
    );
  }
}

// ── Dist freshness check ──────────────────────────────────────────────────────

/**
 * Walk a directory tree and return the newest mtime (in ms).
 */
async function getNewestMtime(rootDir, subdirs) {
  let newestMs = 0;

  async function walkDir(dirPath) {
    let entries;
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch {
      return; // directory might not exist
    }
    for (const entry of entries) {
      const entryPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await walkDir(entryPath);
      } else {
        try {
          const s = await stat(entryPath);
          if (s.mtimeMs > newestMs) newestMs = s.mtimeMs;
        } catch {
          // ignore stat errors on transient files
        }
      }
    }
  }

  for (const subdir of subdirs) {
    await walkDir(join(rootDir, subdir));
  }

  return newestMs;
}

/**
 * @typedef {{ fresh: boolean, reason: string }} FreshnessResult
 *
 * Check whether `dist/` in `repoRoot` is fresh enough to reuse as snapshot B.
 *
 * "Fresh" means ALL of:
 *   (a) dist/.build-stamp.json exists
 *   (b) its `commit` field matches `git rev-parse HEAD`
 *   (c) its mtime is newer than the newest mtime under src/ and pages/
 *
 * If the stamp is missing entirely (user ran `pnpm build` directly), we
 * cannot verify the commit and fall back to treating as not fresh with
 * a warning (to avoid silently reusing a stale build).
 *
 * @param {string} repoRoot
 * @returns {Promise<FreshnessResult>}
 */
async function checkDistFreshness(repoRoot) {
  const distDir = join(repoRoot, "dist");
  const stampPath = join(distDir, ".build-stamp.json");

  // (a) stamp exists?
  let stamp;
  try {
    stamp = JSON.parse(await readFile(stampPath, "utf8"));
  } catch {
    console.warn(
      "[S2] dist/.build-stamp.json not found — dist/ was likely built without this script.\n" +
        "[S2] Treating as not fresh (commit-SHA-only fallback not possible without stamp).",
    );
    return { fresh: false, reason: "stamp-missing" };
  }

  // (b) commit matches HEAD?
  const headCommit = resolveRef(repoRoot, "HEAD");
  if (stamp.commit !== headCommit) {
    return {
      fresh: false,
      reason: `commit-mismatch (stamp: ${stamp.commit?.slice(0, 8)}, HEAD: ${headCommit.slice(0, 8)})`,
    };
  }

  // (c) stamp mtime newer than newest source file mtime?
  const stampStat = await stat(stampPath);
  const newestSourceMtime = await getNewestMtime(repoRoot, ["src", "pages"]);

  if (stampStat.mtimeMs <= newestSourceMtime) {
    return { fresh: false, reason: "source-files-newer-than-stamp" };
  }

  return { fresh: true, reason: "all-checks-passed" };
}

// ── Build stamp ───────────────────────────────────────────────────────────────

/**
 * Write a .build-stamp.json into `distDir` after a successful build.
 * The stamp is used by subsequent runs to detect whether dist/ is still fresh.
 */
async function writeStamp(distDir, commit) {
  const stamp = {
    commit,
    builtAt: new Date().toISOString(),
    builtBy: "scripts/migration-check/build-snapshots.mjs",
  };
  await writeFile(
    join(distDir, ".build-stamp.json"),
    JSON.stringify(stamp, null, 2) + "\n",
  );
}

// ── Artifact copying ──────────────────────────────────────────────────────────

/**
 * Copy the non-HTML artifacts listed in ARTIFACT_PATHS from `distDir` into
 * `artifactsDir`. Files that don't exist in the snapshot's dist/ are skipped
 * with a debug-level log so unexpected absences surface clearly.
 */
async function copyArtifacts(distDir, artifactsDir) {
  await mkdir(artifactsDir, { recursive: true });
  const copied = [];
  const skipped = [];

  for (const relPath of ARTIFACT_PATHS) {
    const src = join(distDir, relPath);
    if (!existsSync(src)) {
      skipped.push(relPath);
      continue;
    }

    const dest = join(artifactsDir, relPath);
    await mkdir(dirname(dest), { recursive: true });
    await cp(src, dest, { recursive: true });
    copied.push(relPath);
  }

  console.log(
    `[S2] artifacts: copied ${copied.length}/${ARTIFACT_PATHS.length} file(s) → ${artifactsDir}`,
  );
  if (skipped.length > 0) {
    console.log(`[S2] artifacts: skipped (not in dist/): ${skipped.join(", ")}`);
  }
}

// ── Shared worktree build logic ───────────────────────────────────────────────

/**
 * Build a snapshot inside a throwaway git worktree at `ref` and copy the
 * output into `destDir`. Used by both snapshot A and worktree-based snapshot B.
 *
 * @param {{ ref: string, destDir: string, worktreeNamePrefix: string, label: string }} opts
 * @returns {Promise<object>} manifest entry
 */
async function buildSnapshotInWorktree({ ref, destDir, worktreeNamePrefix, label }) {
  const refSlug = refToSlug(ref);
  const worktreePath = join(REPO_ROOT, "worktrees", `${worktreeNamePrefix}-${refSlug}`);
  const startTime = Date.now();

  try {
    await createWorktree(REPO_ROOT, worktreePath, ref);

    const commitSha = resolveRef(REPO_ROOT, ref);
    const framework = detectFramework(worktreePath);
    console.log(`[S2] framework detected: ${framework}`);

    // Rewrite file:../ deps if present — relative paths break when pnpm install
    // runs from inside worktrees/<name>/ instead of the original repo root.
    const pkgJsonPath = join(worktreePath, "package.json");
    const pkgJson = JSON.parse(await readFile(pkgJsonPath, "utf8"));
    const {
      rewritten,
      log: rewriteLog,
      pkgJson: rewrittenPkg,
    } = rewriteFileDeps(pkgJson, REPO_ROOT);

    if (rewritten) {
      console.log(`[S2] rewriting ${rewriteLog.length} file:../ dep(s) to absolute paths:`);
      for (const entry of rewriteLog) console.log(`  ${entry}`);
      await writeFile(pkgJsonPath, JSON.stringify(rewrittenPkg, null, 2) + "\n");
    } else {
      console.log("[S2] no file:../ deps to rewrite");
    }

    // Skip --frozen-lockfile when file: specs were rewritten: the lockfile
    // still records the old relative paths and would fail hash verification.
    const installArgs = rewritten ? ["install"] : ["install", "--frozen-lockfile"];
    console.log("[S2] running pnpm install ...");
    runCmd("pnpm", installArgs, worktreePath);

    console.log("[S2] running pnpm build ...");
    runCmd("pnpm", ["build"], worktreePath);

    const buildDurationMs = Date.now() - startTime;
    const outputDir = detectOutputDir(worktreePath, framework);
    const distPath = join(worktreePath, outputDir);

    console.log(`[S2] copying ${outputDir}/ → ${label} snapshot ...`);
    await mkdir(destDir, { recursive: true });
    await cp(distPath, destDir, { recursive: true });
    await copyArtifacts(distPath, join(destDir, "_artifacts"));

    console.log(`[S2] ${label} done in ${(buildDurationMs / 1000).toFixed(1)}s`);

    return {
      ref,
      commit: commitSha,
      outputDirRelative: outputDir,
      buildDurationMs,
      framework,
      fileDepRewriteLog: rewriteLog,
    };
  } finally {
    console.log(`[S2] cleaning up ${label} worktree ...`);
    await removeWorktree(REPO_ROOT, worktreePath);
  }
}

// ── Snapshot A (from-ref) ─────────────────────────────────────────────────────

/**
 * Build snapshot A using a throwaway git worktree at fromRef.
 *
 * @param {{ fromRef: string, noBuild: boolean }} opts
 * @returns {Promise<object|null>} manifest entry, or null if skipped
 */
async function buildSnapshotA(opts) {
  const { fromRef, noBuild } = opts;

  if (noBuild && existsSync(join(SNAPSHOT_A_DIR, "index.html"))) {
    console.log("[S2] snapshot A already exists, skipping (--no-build)");
    return null;
  }

  console.log(`\n[S2] ── Building snapshot A (${fromRef}) ──────────────────`);

  return buildSnapshotInWorktree({
    ref: fromRef,
    destDir: SNAPSHOT_A_DIR,
    worktreeNamePrefix: "migration-check-baseline",
    label: "snapshot A",
  });
}

// ── Snapshot B (to-ref) ───────────────────────────────────────────────────────

/**
 * Build (or reuse) snapshot B.
 *
 * When toRef resolves to HEAD:
 *   - If dist/ is fresh (strict 3-condition check): copy dist/ directly.
 *   - Otherwise: rebuild in the current repo (pnpm build), write stamp, then copy.
 *
 * When toRef is not HEAD: build in a separate git worktree (same approach as A).
 *
 * @param {{ toRef: string, noBuild: boolean }} opts
 * @returns {Promise<object|null>} manifest entry, or null if skipped
 */
async function buildSnapshotB(opts) {
  const { toRef, noBuild } = opts;

  if (noBuild && existsSync(join(SNAPSHOT_B_DIR, "index.html"))) {
    console.log("[S2] snapshot B already exists, skipping (--no-build)");
    return null;
  }

  console.log(`\n[S2] ── Building snapshot B (${toRef}) ───────────────────`);

  const headCommit = resolveRef(REPO_ROOT, "HEAD");
  const toRefCommit = resolveRef(REPO_ROOT, toRef);
  const isHead = headCommit === toRefCommit;

  if (isHead) {
    return buildSnapshotBFromCurrentDist({ toRef, headCommit });
  }

  return buildSnapshotInWorktree({
    ref: toRef,
    destDir: SNAPSHOT_B_DIR,
    worktreeNamePrefix: "migration-check-current",
    label: "snapshot B",
  });
}

/**
 * Snapshot B from the current repo's dist/ (toRef === HEAD).
 * Reuses dist/ if fresh; otherwise rebuilds and writes a stamp.
 */
async function buildSnapshotBFromCurrentDist({ toRef, headCommit }) {
  const distPath = join(REPO_ROOT, "dist");
  const startTime = Date.now();

  const freshResult = await checkDistFreshness(REPO_ROOT);

  if (freshResult.fresh) {
    console.log("[S2] dist/ is fresh — reusing for snapshot B (no rebuild)");
    const framework = detectFramework(REPO_ROOT);

    await mkdir(SNAPSHOT_B_DIR, { recursive: true });
    await cp(distPath, SNAPSHOT_B_DIR, { recursive: true });
    await copyArtifacts(distPath, join(SNAPSHOT_B_DIR, "_artifacts"));

    return {
      ref: toRef,
      commit: headCommit,
      outputDirRelative: "dist",
      buildDurationMs: 0,
      reused: true,
      framework,
      fileDepRewriteLog: [],
    };
  }

  console.log(`[S2] dist/ is not fresh (${freshResult.reason}) — rebuilding ...`);
  runCmd("pnpm", ["build"], REPO_ROOT);

  const buildDurationMs = Date.now() - startTime;
  await writeStamp(distPath, headCommit);

  const framework = detectFramework(REPO_ROOT);

  await mkdir(SNAPSHOT_B_DIR, { recursive: true });
  await cp(distPath, SNAPSHOT_B_DIR, { recursive: true });
  await copyArtifacts(distPath, join(SNAPSHOT_B_DIR, "_artifacts"));

  console.log(`[S2] snapshot B done in ${(buildDurationMs / 1000).toFixed(1)}s`);

  return {
    ref: toRef,
    commit: headCommit,
    outputDirRelative: "dist",
    buildDurationMs,
    framework,
    fileDepRewriteLog: [],
  };
}

// ── Manifest ──────────────────────────────────────────────────────────────────

/**
 * Write the snapshot manifest to MANIFEST_PATH.
 *
 * @param {{ a: object|null, b: object|null }} snapshots
 */
async function writeManifest(snapshots) {
  const manifest = {
    generatedAt: new Date().toISOString(),
    snapshots: {
      ...(snapshots.a ? { a: snapshots.a } : {}),
      ...(snapshots.b ? { b: snapshots.b } : {}),
    },
  };
  await mkdir(SNAPSHOTS_DIR, { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\n[S2] manifest written to ${MANIFEST_PATH}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("[S2] build-snapshots.mjs starting");
  console.log(
    `[S2] from-ref: ${args.fromRef}  to-ref: ${args.toRef}` +
      (args.noBuild ? "  --no-build" : "") +
      (args.baselineOnly ? "  --baseline-only" : "") +
      (args.currentOnly ? "  --current-only" : ""),
  );

  await mkdir(SNAPSHOTS_DIR, { recursive: true });

  let manifestA = null;
  let manifestB = null;

  if (!args.currentOnly) {
    manifestA = await buildSnapshotA({
      fromRef: args.fromRef,
      noBuild: args.noBuild,
    });
  }

  if (!args.baselineOnly) {
    manifestB = await buildSnapshotB({
      toRef: args.toRef,
      noBuild: args.noBuild,
    });
  }

  await writeManifest({ a: manifestA, b: manifestB });

  console.log("\n[S2] build-snapshots.mjs complete.");
}

main().catch((err) => {
  console.error("[S2] fatal:", err.message ?? err);
  process.exit(1);
});
