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
// builds cost ~19s warm). Staleness is covered elsewhere: `pnpm test` and
// `pnpm build:workspace` always rebuild. This is deliberately NOT a cache —
// there is no mtime or hash comparison to get subtly wrong.
//
// ── What counts as "built" ────────────────────────────────────────────────
// Completeness is checked against each package's own `exports` map rather than
// a hand-picked sentinel file. Every literal `./dist/**` target it declares —
// JS and .d.ts alike — must exist. Two reasons this beats one sentinel:
//
//   * A single entry proves nothing about the rest. dist/config.js transitively
//     pulls in many other compiled files, and a declaration pass killed partway
//     leaves some .d.ts written and others absent — a state a lone sentinel
//     happily accepts, so the next command fails on a missing subpath instead
//     of self-healing.
//   * The exports map IS the package's public API surface, so the check stays
//     correct as exports are added or removed. Nothing to keep in sync here.
//
// Wildcard targets (e.g. "./dist/theme-packs/*") are skipped — only literal
// paths can be checked by existence.
//
// ── Interaction with `pnpm dev` ───────────────────────────────────────────
// packages/zudo-doc's tsup config runs with `clean: true, dts: false` (its
// declarations come from the separate `tsc -p tsconfig.build.json` pass), so a
// `tsup --watch` dev session wipes dist/ and never regenerates ANY .d.ts. That
// means the first `pnpm check` after a dev session does one full rebuild. This
// is necessary, not incidental: without it that same command fails outright
// with a cascade of TS2306/TS2724 errors, which is what it did before this
// guard existed. Corollary: don't run `pnpm check` while `pnpm dev` is live —
// the rebuild and the watcher would both be writing dist/.
//
// Usage:
//   node scripts/ensure-workspace-build.mjs            # build only what's missing
//   node scripts/ensure-workspace-build.mjs --force    # always rebuild, in order

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const WORKSPACE_BUILD_ORDER = [
  {
    name: "@takazudo/zudo-doc-history-server",
    dir: "packages/doc-history-server",
  },
  {
    name: "@takazudo/zudo-doc",
    dir: "packages/zudo-doc",
  },
];

/** Every literal `./dist/**` path a package's exports map declares. */
function declaredDistTargets(pkgDir) {
  const manifest = JSON.parse(
    readFileSync(join(ROOT, pkgDir, "package.json"), "utf8"),
  );
  const targets = new Set();
  (function walk(node) {
    if (typeof node === "string") {
      if (node.startsWith("./dist/") && !node.includes("*")) targets.add(node);
      return;
    }
    if (node && typeof node === "object") Object.values(node).forEach(walk);
  })(manifest.exports);
  return [...targets];
}

const force = process.argv.includes("--force");
let builtCount = 0;

for (const pkg of WORKSPACE_BUILD_ORDER) {
  let reason = "--force";

  if (!force) {
    const declared = declaredDistTargets(pkg.dir);
    const missing = declared.filter(
      (file) => !existsSync(join(ROOT, pkg.dir, file)),
    );
    if (missing.length === 0) continue;

    // Name a couple of examples — listing all 275 of zudo-doc's targets on a
    // cold tree would bury the rest of the command's output.
    const sample = missing.slice(0, 2).join(", ");
    const rest = missing.length > 2 ? `, +${missing.length - 2} more` : "";
    reason = `missing ${missing.length}/${declared.length} exports: ${sample}${rest}`;
  }

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
