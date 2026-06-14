#!/usr/bin/env node
// scripts/check-safelist.mjs
//
// Presence guard for dist/safelist.css — run as a prepack / prepublishOnly
// hook so a build that missed the tsup onSuccess step (which runs
// gen-safelist.mjs) fails loudly instead of publishing a package whose
// `./safelist.css` export 404s for consumers.
//
// Exit 0 → safelist exists and is non-empty.
// Exit 1 → file is missing or empty (with a clear diagnostic message).

import { statSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAFELIST = resolve(__dirname, "../dist/safelist.css");

let size = 0;
try {
  size = statSync(SAFELIST).size;
} catch {
  process.stderr.write(
    `\n[check-safelist] ERROR: dist/safelist.css is missing.\n` +
    `  Run \`pnpm --filter @takazudo/zudo-doc build\` first so the\n` +
    `  tsup onSuccess hook generates the file, then retry.\n\n`,
  );
  process.exit(1);
}

if (size === 0) {
  process.stderr.write(
    `\n[check-safelist] ERROR: dist/safelist.css exists but is empty.\n` +
    `  The tsup onSuccess hook (gen-safelist.mjs) may have failed silently.\n` +
    `  Re-run \`pnpm --filter @takazudo/zudo-doc build\` and check for errors.\n\n`,
  );
  process.exit(1);
}

process.stdout.write(`[check-safelist] dist/safelist.css OK (${size} bytes)\n`);
