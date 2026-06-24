#!/usr/bin/env node
// scripts/check-plugins.mjs
//
// Presence guard for dist/plugins/*.js — run as a prepack hook so a build
// that skipped compilation fails loudly instead of publishing a package whose
// `./plugins/*` exports 404 for consumers.
//
// Exit 0 → all 4 plugin files exist and are non-empty.
// Exit 1 → any file is missing or empty (with a clear diagnostic message).
//
// connect-adapter.js is intentionally absent from this list: it is an
// internal module imported by the other plugins via relative path and no
// longer exported as a public subpath (#2338).

import { statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, "../dist");

const PLUGIN_FILES = [
  "plugins/doc-history.js",
  "plugins/llms-txt.js",
  "plugins/search-index.js",
  "plugins/claude-resources.js",
];

let allOk = true;

for (const rel of PLUGIN_FILES) {
  const abs = resolve(DIST, rel);
  let size = 0;
  try {
    size = statSync(abs).size;
  } catch {
    process.stderr.write(
      `\n[check-plugins] ERROR: dist/${rel} is missing.\n` +
      `  Run \`pnpm --filter @takazudo/zudo-doc build\` first so tsup\n` +
      `  compiles the plugin sources, then retry.\n\n`,
    );
    allOk = false;
    continue;
  }

  if (size === 0) {
    process.stderr.write(
      `\n[check-plugins] ERROR: dist/${rel} exists but is empty.\n` +
      `  Re-run \`pnpm --filter @takazudo/zudo-doc build\` and check for errors.\n\n`,
    );
    allOk = false;
    continue;
  }

  process.stdout.write(`[check-plugins] dist/${rel} OK (${size} bytes)\n`);
}

if (!allOk) process.exit(1);
