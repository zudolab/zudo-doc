#!/usr/bin/env node
// Package bin: local-LLM suggestions from an explicit project tag config.

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const runnerPath = resolve(__dirname, "tags-suggest-runner.ts");
const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));

const result = spawnSync(
  process.execPath,
  [tsxCli, runnerPath, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
  },
);

if (result.error) {
  process.stderr.write(
    `\n[tags-suggest] ERROR: Could not start the package tag-suggest runner.\n` +
      `  Reinstall @takazudo/zudo-doc and try again.\n\n`,
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
