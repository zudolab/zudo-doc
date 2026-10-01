#!/usr/bin/env node
// scripts/check-wind-manifest.mjs
//
// Presence guard for dist/wind.json — run as a prepack / prepublishOnly
// hook so a build that missed the tsup onSuccess step (which runs
// gen-wind-manifest.mjs) fails loudly instead of publishing a package whose
// `./wind.json` export 404s for consumers.
//
// Exit 0 → wind-manifest exists and is non-empty.
// Exit 1 → file is missing or empty (with a clear diagnostic message).

import { statSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST = resolve(__dirname, "../dist/wind.json");

let size = 0;
try {
  size = statSync(MANIFEST).size;
} catch {
  process.stderr.write(
    `\n[check-wind-manifest] ERROR: dist/wind.json is missing.\n` +
    `  Run \`pnpm --filter @takazudo/zudo-doc build\` first so the\n` +
    `  tsup onSuccess hook generates the file, then retry.\n\n`,
  );
  process.exit(1);
}

if (size === 0) {
  process.stderr.write(
    `\n[check-wind-manifest] ERROR: dist/wind.json exists but is empty.\n` +
    `  The tsup onSuccess hook (gen-wind-manifest.mjs) may have failed silently.\n` +
    `  Re-run \`pnpm --filter @takazudo/zudo-doc build\` and check for errors.\n\n`,
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
if (manifest.schemaVersion !== 1 || manifest.specVersion !== 1 || manifest.producer !== "zudo-doc" || !Array.isArray(manifest.candidates) || manifest.candidates.length === 0) {
  throw new Error("dist/wind.json is not a populated zudo-doc v1 manifest");
}

process.stdout.write(`[check-wind-manifest] dist/wind.json OK (${size} bytes)\n`);
