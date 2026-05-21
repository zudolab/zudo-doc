#!/usr/bin/env node

/**
 * dev-claude-watch.mjs — Chokidar watcher for .claude/ live regeneration
 *
 * Watches .claude/ for file changes and re-invokes runClaudeResourcesPreStep
 * so that edits to CLAUDE.md, skills/*, commands/*, agents/* reflect in the
 * zfb dev server without a full restart.
 *
 * Invocation pattern mirrors plugins/claude-resources-plugin.mjs exactly
 * (tsx -e subprocess) — keep in sync. The gray-matter CJS/ESM issue forces
 * the subprocess approach; see the plugin's top-level comment for details.
 *
 * Defaults for claudeDir / docsDir match src/config/settings.ts —
 * update here if those settings change.
 */

import { watch } from "chokidar";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, "..");

// Mirrors plugins/claude-resources-plugin.mjs — same binary resolution strategy
// so the watcher doesn't depend on PATH.
const TSX_BIN = resolve(PROJECT_ROOT, "node_modules", ".bin", "tsx");

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
// Runner — mirrors runRunnerUnderTsx from plugins/claude-resources-plugin.mjs
// Inherits stdio rather than parsing JSON so the user sees runner logs live.
// ---------------------------------------------------------------------------

function runRunner() {
  const childScript = `
    (async () => {
      const { runClaudeResourcesPreStep } = await import("@zudo-doc/zudo-doc-v2/integrations/claude-resources");
      const result = await runClaudeResourcesPreStep({
        claudeDir: ${JSON.stringify(CLAUDE_DIR)},
        projectRoot: ${JSON.stringify(PROJECT_ROOT)},
        docsDir: ${JSON.stringify(DOCS_DIR)},
      });
      console.log(
        \`[claude-watch] done: \${result.claudemd} CLAUDE.md, \${result.commands} commands, \${result.skills} skills, \${result.agents} agents\`
      );
    })().catch((err) => {
      process.stderr.write((err && err.stack ? err.stack : String(err)) + "\\n");
      process.exit(1);
    });
  `;

  return new Promise((resolve, reject) => {
    const child = spawn(TSX_BIN, ["-e", childScript], {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        // Non-zero exit: log but don't crash the watcher — a syntax error in
        // a CLAUDE.md shouldn't kill the whole dev session.
        console.error(`[claude-watch] runner exited with code ${code}`);
        resolve();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Debounced schedule
// ---------------------------------------------------------------------------

// Runs the generator, serialized. If changes arrive while a run is in flight,
// they coalesce into exactly one follow-up run (rerunQueued) — never two
// concurrent `tsx -e` subprocesses writing the same MDX output.
async function regenerate() {
  if (shuttingDown) return;
  if (inFlight) {
    rerunQueued = true;
    return;
  }
  do {
    rerunQueued = false;
    const run = runRunner();
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
      // already logged inside runRunner
    }
  }

  await watcher.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
