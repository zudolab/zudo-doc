#!/usr/bin/env node
// scripts/check-eject-sources.mjs
//
// Presence guard for `eject/<component>/` directories — run as part of the
// `prepack` hook so a build that skipped the `copy-eject-sources.mjs` step
// fails loudly rather than publishing a package whose eject sources are missing.
//
// Exit 0 → every allowlisted eject/<component>/ directory exists and is
//           non-empty (contains at least one file).
// Exit 1 → a directory is missing or empty (with a clear diagnostic message).

import { statSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const EJECT_ROOT = resolve(PKG_ROOT, "eject");

// Import EJECTABLE from the compiled package (single source of truth — S4 #2373).
// prepack runs after `pnpm build`, so dist/eject/index.js is guaranteed to exist.
const { EJECTABLE: EJECTABLE_MAP } = await import(resolve(PKG_ROOT, "dist/eject/index.js"));

/** Ejectable component names — derived from the canonical EJECTABLE map. */
const EJECTABLE = Object.keys(EJECTABLE_MAP);

/** Recursively count files in a directory. */
function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += countFiles(join(dir, entry.name));
    else n++;
  }
  return n;
}

let ok = true;

for (const name of EJECTABLE) {
  const dir = resolve(EJECT_ROOT, name);
  let size = 0;
  try {
    statSync(dir);
    size = countFiles(dir);
  } catch {
    process.stderr.write(
      `\n[check-eject-sources] ERROR: eject/${name}/ is missing.\n` +
        `  Run \`pnpm --filter @takazudo/zudo-doc build\` first so the\n` +
        `  tsup onSuccess hook (copy-eject-sources.mjs) generates the files,\n` +
        `  then retry.\n\n`,
    );
    ok = false;
    continue;
  }

  if (size === 0) {
    process.stderr.write(
      `\n[check-eject-sources] ERROR: eject/${name}/ exists but is empty.\n` +
        `  The tsup onSuccess hook (copy-eject-sources.mjs) may have failed.\n` +
        `  Re-run \`pnpm --filter @takazudo/zudo-doc build\` and check for errors.\n\n`,
    );
    ok = false;
    continue;
  }

  process.stdout.write(`[check-eject-sources] eject/${name}/ OK (${size} files)\n`);
}

if (!ok) process.exit(1);
