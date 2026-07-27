#!/usr/bin/env node
// scripts/ensure-workspace-build.mjs
//
// Makes a cold checkout self-healing: workspace packages whose compiled dist/
// is missing get built before the command that needs them runs.
//
// ── Why this exists (zudolab/zudo-doc#3053) ────────────────────────────────
// A tree installed with `pnpm install --ignore-scripts` has no dist/ for the
// workspace packages, because that flag skips their `prepare` builds. (A plain
// `pnpm install` DOES run them, in the right order — the bug is specific to
// --ignore-scripts installs and to trees whose dist/ was cleaned.) Without
// dist/, `zfb check` and `zfb build` cannot even load zfb.config.ts: it imports
// `@takazudo/zudo-doc/config`, which resolves through dist/config.js. Every
// fresh worktree therefore looked like a broken branch before a single line
// was edited.
//
// ── The order is mandatory, not cosmetic ──────────────────────────────────
// @takazudo/zudo-doc's build ends in `tsc -p tsconfig.build.json`, and
// src/plugins/internal/doc-history/pre-build.ts imports
// `@takazudo/zudo-doc-history-server/git-history` for its types. Building
// zudo-doc first fails with TS2307. The history-server must be built first.
// WORKSPACE_BUILD_ORDER below is the single source of truth for that ordering
// — `pnpm build:workspace` is this same script with --force, so the guarded
// and the unconditional path can never disagree.
//
// ── Existence, not freshness ──────────────────────────────────────────────
// The guard only asks "is the compiled output there?", never "is it current?".
// Rebuilding on every `pnpm check` would turn an 8s command into ~27s (the two
// builds cost ~19s warm). Staleness is already covered elsewhere: `pnpm dev`
// runs tsup --watch, and `pnpm test` / `pnpm build:workspace` always rebuild.
// This is deliberately NOT a cache — there is no mtime or hash comparison to
// get subtly wrong.
//
// Each package lists both its .js and its .d.ts sentinel so an interrupted
// build that got through tsup but not the declaration pass is still repaired.
//
// Usage:
//   node scripts/ensure-workspace-build.mjs            # build only what's missing
//   node scripts/ensure-workspace-build.mjs --force    # always rebuild, in order

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const WORKSPACE_BUILD_ORDER = [
  {
    name: "@takazudo/zudo-doc-history-server",
    dir: "packages/doc-history-server",
    // pre-build.ts imports this subpath for its types — needed before
    // @takazudo/zudo-doc can complete its own tsc pass.
    sentinels: ["dist/git-history.js", "dist/git-history.d.ts"],
  },
  {
    name: "@takazudo/zudo-doc",
    dir: "packages/zudo-doc",
    // zfb.config.ts imports @takazudo/zudo-doc/config — without this, no zfb
    // command can even load the project config.
    sentinels: ["dist/config.js", "dist/config.d.ts"],
  },
];

const force = process.argv.includes("--force");
let builtCount = 0;

for (const pkg of WORKSPACE_BUILD_ORDER) {
  const missing = pkg.sentinels.filter(
    (file) => !existsSync(join(ROOT, pkg.dir, file)),
  );
  if (!force && missing.length === 0) continue;

  const reason = force ? "--force" : `missing ${missing.join(", ")}`;
  console.log(`[ensure-workspace-build] building ${pkg.name} (${reason})`);

  const result = spawnSync("pnpm", ["--filter", pkg.name, "build"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(
      `[ensure-workspace-build] ${pkg.name} build failed (exit ${result.status ?? "signal"})`,
    );
    process.exit(result.status || 1);
  }
  builtCount++;
}

// Stay silent on the hot path: this runs ahead of nearly every dev command, and
// a "nothing to do" line on each one is pure noise.
if (builtCount > 0) {
  console.log(`[ensure-workspace-build] done (${builtCount} package(s) built)`);
}
