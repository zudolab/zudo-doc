#!/usr/bin/env node
// @takazudo/zudo-doc/bin/tags-audit.mjs
//
// Package bin: vocabulary-aware audit of frontmatter tags.
//
// Spawns tsx (from the project's node_modules) to run the TypeScript runner
// (bin/tags-audit-runner.ts) which imports the compiled core logic from this
// package plus the project's TypeScript config files (settings.ts,
// tag-vocabulary.ts) via dynamic import.
//
// Requires tsx in the project's devDependencies. pnpm puts ./node_modules/.bin
// in PATH for npm scripts, so `pnpm run tags:audit` always finds tsx.
//
// Usage (via package.json scripts):
//   tags-audit          # report only (exit 0 in warn mode)
//   tags-audit --ci     # force exit 1 on any hard issue
//   tags-audit --json   # emit JSON report

import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// The TypeScript runner lives alongside this bin, published in the package.
// tsx treats it as a TypeScript file and handles the import graph.
const RUNNER_PATH = resolve(__dirname, "tags-audit-runner.ts");

// Locate tsx in the project's node_modules/.bin.
// Walk up from cwd to handle monorepo setups where node_modules is hoisted.
function findTsxBin() {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = resolve(dir, "node_modules/.bin/tsx");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Last resort: tsx on PATH (e.g. globally installed or nix-shell)
  return "tsx";
}

const tsxBin = findTsxBin();

const result = spawnSync(tsxBin, [RUNNER_PATH, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  cwd: process.cwd(),
});

if (result.error) {
  // tsx binary not found or failed to spawn
  process.stderr.write(
    `\n[tags-audit] ERROR: Could not run tsx to execute the tags-audit runner.\n` +
      `  Ensure tsx is in your project's devDependencies and run \`pnpm install\`.\n` +
      `  tsx searched for: ${tsxBin}\n\n`,
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
