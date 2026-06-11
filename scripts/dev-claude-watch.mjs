#!/usr/bin/env node

/**
 * dev-claude-watch.mjs — Chokidar watcher for .claude/ live regeneration
 *
 * Watches .claude/ for file changes and re-invokes runClaudeResourcesPreStep
 * so that edits to CLAUDE.md, skills/*, commands/*, agents/* reflect in the
 * zfb dev server without a full restart.
 *
 * Imports runClaudeResourcesPreStep directly — the package now ships compiled
 * dist/ so the tsx subprocess workaround is no longer needed. See the
 * updated plugins/claude-resources-plugin.mjs header for the history.
 *
 * Defaults for claudeDir / docsDir match src/config/settings.ts —
 * update here if those settings change.
 */

import { watch } from "chokidar";
import { runClaudeResourcesPreStep } from "@takazudo/zudo-doc/integrations/claude-resources";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, "..");

// Defaults from src/config/settings.ts (claudeResources.claudeDir and docsDir).
// Update here if those settings drift.
const CLAUDE_DIR = resolve(PROJECT_ROOT, ".claude");
const DOCS_DIR = "src/content/docs";

const DEBOUNCE_MS = 300;

let debounceTimer = null;
let inFlight = null;
let rerunQueued = false;
let shuttingDown = false;

// ---------------------------------------------------------------------------
// Runner — direct import replaces the old tsx -e subprocess approach
// Runs synchronously in-process for faster regen and visible errors.
// ---------------------------------------------------------------------------

async function runRunner() {
  const result = await runClaudeResourcesPreStep({
    claudeDir: CLAUDE_DIR,
    projectRoot: PROJECT_ROOT,
    docsDir: DOCS_DIR,
  });
  console.log(
    `[claude-watch] done: ${result.claudemd} CLAUDE.md, ${result.commands} commands, ${result.skills} skills, ${result.agents} agents`,
  );
}

// ---------------------------------------------------------------------------
// Debounced schedule
// ---------------------------------------------------------------------------

// Runs the generator, serialized. If changes arrive while a run is in flight,
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
      // Non-fatal: a syntax error in a CLAUDE.md shouldn't kill the whole dev session.
      console.error("[claude-watch] runner error:", err instanceof Error ? err.message : String(err));
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
  if (shuttingDown) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (shuttingDown) return;

    console.log(`[claude-watch] change: ${changedPath} — regenerating…`);
    regenerate();
  }, DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// Watcher
// ---------------------------------------------------------------------------

const watcher = watch(CLAUDE_DIR, {
  ignoreInitial: true, // preBuild already ran at zfb startup
  persistent: true,
  awaitWriteFinish: false,
  // The doc-skill (.claude/skills/*/docs/) symlinks INTO src/content/docs —
  // i.e. into this watcher's own regeneration OUTPUT. Following symlinks made
  // every regen write re-appear as a .claude change, looping regeneration
  // forever and starving zfb's content snapshot (#2042). Real .claude sources
  // are regular files, so not following symlinks loses nothing.
  followSymlinks: false,
});

watcher
  .on("add", scheduleRegen)
  .on("change", scheduleRegen)
  .on("unlink", scheduleRegen)
  .on("addDir", scheduleRegen)
  .on("unlinkDir", scheduleRegen)
  .on("error", (err) => {
    console.error("[claude-watch] watcher error:", err);
  });

console.log(`[claude-watch] watching ${CLAUDE_DIR}`);

// ---------------------------------------------------------------------------
// Signal handling — exit cleanly so run-p doesn't leave orphans
// ---------------------------------------------------------------------------

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[claude-watch] ${signal} received — shutting down`);

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
