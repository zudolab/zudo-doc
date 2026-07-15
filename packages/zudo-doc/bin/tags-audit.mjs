#!/usr/bin/env node
// @takazudo/zudo-doc/bin/tags-audit.mjs
//
// Package bin: vocabulary-aware audit of frontmatter tags.
//
// Spawns the package-owned tsx dependency to run the TypeScript runner
// (bin/tags-audit-runner.ts) which imports the compiled core logic from this
// package plus the one project config module explicitly passed with --config.
//
// Usage (via package.json scripts):
//   tags-audit --config ./src/config/tag-vocabulary.ts
//   tags-audit --config ./src/config/tag-vocabulary.ts --ci
//   tags-audit --config ./src/config/tag-vocabulary.ts -- --json

import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// The TypeScript runner lives alongside this bin, published in the package.
// tsx treats it as a TypeScript file and handles the import graph.
const RUNNER_PATH = resolve(__dirname, "tags-audit-runner.ts");

const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));

const result = spawnSync(
  process.execPath,
  [tsxCli, RUNNER_PATH, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
  },
);

if (result.error) {
  process.stderr.write(
    `\n[tags-audit] ERROR: Could not start the package tag-audit runner.\n` +
      `  Reinstall @takazudo/zudo-doc and try again.\n\n`,
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
