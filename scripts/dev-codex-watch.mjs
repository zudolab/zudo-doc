#!/usr/bin/env node

/**
 * dev-codex-watch.mjs — Chokidar watcher for Codex live regeneration
 *
 * Watches the explicit Codex input set and re-invokes
 * runCodexResourcesPreStep so edits to Codex configuration, repository
 * instructions, and linked skills reflect in the zfb dev server without a
 * full restart. The output under docsDir is deliberately never watched: a
 * docs/docs-ja symlink would otherwise create the #2042 infinite-regeneration
 * loop.
 *
 * Input discovery happens once at startup. A newly created AGENTS.md or
 * AGENTS.override.md at an unwatched depth therefore needs a dev restart before
 * it can trigger regeneration, matching the watcher's startup-scoped input set.
 *
 * Defaults for codexDir / docsDir match src/config/settings.ts — update here if
 * those settings change.
 */

import fs from "node:fs";
import { watch } from "chokidar";
import { runCodexResourcesPreStep } from "@takazudo/zudo-doc/plugins/codex-resources";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, "..");

// Defaults from src/config/settings.ts (codexResources.codexDir and docsDir).
// Update here if those settings drift.
const CODEX_DIR = resolve(PROJECT_ROOT, ".codex");
const CODEX_SKILLS_DIR = resolve(CODEX_DIR, "skills");
const DOCS_DIR = "src/content/docs";
const DOCS_DIR_ABS = resolve(PROJECT_ROOT, DOCS_DIR);

const DEBOUNCE_MS = 300;
const SKIPPED_DIR_NAMES = new Set([
  "node_modules",
  "worktrees",
  "dist",
  "out",
  "public",
  "__inbox",
  "test-results",
]);
const INSTRUCTION_NAMES = new Set(["AGENTS.md", "AGENTS.override.md"]);

let debounceTimer = null;
let inFlight = null;
let rerunQueued = false;
let shuttingDown = false;
let watchReady = false;

function discoverInstructionFiles(dir, files = []) {
  if (resolve(dir) === DOCS_DIR_ABS) return files;
  if (!fs.existsSync(dir)) return files;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isFile() && INSTRUCTION_NAMES.has(entry.name)) {
      files.push(resolve(dir, entry.name));
      continue;
    }
    if (!entry.isDirectory() || SKIPPED_DIR_NAMES.has(entry.name)) continue;
    discoverInstructionFiles(resolve(dir, entry.name), files);
  }
  return files;
}

function resolveSkillSymlinkTargets() {
  if (!fs.existsSync(CODEX_SKILLS_DIR)) return [];

  let entries;
  try {
    entries = fs.readdirSync(CODEX_SKILLS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const targets = [];
  for (const entry of entries) {
    if (!entry.isSymbolicLink()) continue;
    const linkPath = resolve(CODEX_SKILLS_DIR, entry.name);
    try {
      targets.push(fs.realpathSync(linkPath));
    } catch {
      // A dangling skill link cannot produce an event; the generator itself
      // will report its normal warning when another input triggers a run.
    }
  }
  return targets;
}

function buildWatchInputs() {
  const inputs = [CODEX_DIR];
  const repoSkillsDir = resolve(PROJECT_ROOT, ".agents/skills");
  if (fs.existsSync(repoSkillsDir)) inputs.push(repoSkillsDir);
  inputs.push(...discoverInstructionFiles(PROJECT_ROOT));
  inputs.push(...resolveSkillSymlinkTargets());

  return [...new Set(inputs)];
}

// ---------------------------------------------------------------------------
// Runner — direct import keeps regeneration in-process and visible.
// ---------------------------------------------------------------------------

async function runRunner() {
  const result = runCodexResourcesPreStep({
    codexDir: CODEX_DIR,
    projectRoot: PROJECT_ROOT,
    docsDir: DOCS_DIR,
  });
  console.log(
    `[codex-watch] done: ${result.agentsMd} AGENTS.md, ${result.config} config, ${result.agents} agents, ${result.hooks} hooks, ${result.rules} rules, ${result.skills} skills`,
  );
}

// ---------------------------------------------------------------------------
// Debounced schedule
// ---------------------------------------------------------------------------

// Runs the generator serialized. If changes arrive while a run is in flight,
// they coalesce into exactly one follow-up run (rerunQueued) — never two
// concurrent regeneration calls writing the same MDX output.
async function regenerate() {
  if (shuttingDown) return;
  if (inFlight) {
    rerunQueued = true;
    return;
  }
  do {
    rerunQueued = false;
    const run = runRunner().catch((err) => {
      // Non-fatal: a malformed Codex input should not kill the whole dev session.
      console.error("[codex-watch] runner error:", err instanceof Error ? err.message : String(err));
    });
    inFlight = run;
    try {
      await run;
    } finally {
      if (inFlight === run) inFlight = null;
    }
  } while (rerunQueued && !shuttingDown);
}

function scheduleRegen(changedPath) {
  if (shuttingDown || !watchReady) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (shuttingDown) return;

    console.log(`[codex-watch] change: ${relative(PROJECT_ROOT, changedPath)} — regenerating…`);
    regenerate();
  }, DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// Watcher
// ---------------------------------------------------------------------------

const watchInputs = buildWatchInputs();
const watcher = watch(watchInputs, {
  ignoreInitial: true,
  persistent: true,
  awaitWriteFinish: false,
  // Linked .codex/skills entries are added as resolved targets above. Not
  // following the links from the .codex tree prevents output-link loops.
  followSymlinks: false,
});

watcher
  .on("add", scheduleRegen)
  .on("change", scheduleRegen)
  .on("unlink", scheduleRegen)
  .on("addDir", scheduleRegen)
  .on("unlinkDir", scheduleRegen)
  .on("error", (err) => {
    console.error("[codex-watch] watcher error:", err);
  })
  .on("ready", () => {
    watchReady = true;
  });

console.log(`[codex-watch] watching ${watchInputs.join(", ")}`);

// ---------------------------------------------------------------------------
// Signal handling — exit cleanly so run-p does not leave orphans.
// ---------------------------------------------------------------------------

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[codex-watch] ${signal} received — shutting down`);

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  // Wait for any in-flight regen to finish before closing (avoid half-written MDX).
  if (inFlight) {
    try {
      await inFlight;
    } catch {
      // already logged inside regenerate
    }
  }

  await watcher.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
