#!/usr/bin/env node
// @takazudo/zudo-doc/bin/zudo-doc.mjs
//
// Package bin: `zudo-doc eject <component>` swizzle CLI.
//
// Spawns tsx (from the project's node_modules) to run the TypeScript runner
// (bin/zudo-doc-cli-runner.ts) which imports eject logic from this package.
//
// Mirrors the bin/tags-audit.mjs + bin/tags-audit-runner.ts tsx-runner pattern.
//
// Requires tsx in the project's devDependencies. pnpm puts ./node_modules/.bin
// in PATH for npm scripts, so `pnpm run` scripts always find tsx.
//
// Usage:
//   zudo-doc eject <component>   # eject a component's TS source into the project
//   zudo-doc --help              # show help

import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// The TypeScript runner lives alongside this bin, published in the package.
// tsx treats it as a TypeScript file and handles the import graph.
const RUNNER_PATH = resolve(__dirname, "zudo-doc-cli-runner.ts");

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
    `\n[zudo-doc] ERROR: Could not run tsx to execute the zudo-doc CLI runner.\n` +
      `  Ensure tsx is in your project's devDependencies and run \`pnpm install\`.\n` +
      `  tsx searched for: ${tsxBin}\n\n`,
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
