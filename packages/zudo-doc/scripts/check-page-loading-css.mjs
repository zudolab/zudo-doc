#!/usr/bin/env node
// scripts/check-page-loading-css.mjs
//
// Presence guard for dist/page-loading.css — run as a prepack hook so a build that
// missed the tsup onSuccess step (which runs copy-page-loading-css.mjs) fails loudly
// instead of publishing a package whose `./page-loading.css` export 404s for
// consumers.
//
// Exit 0 → page-loading.css exists and is non-empty.
// Exit 1 → file is missing or empty (with a clear diagnostic message).

import { statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT = resolve(__dirname, "../dist/page-loading.css");

let size = 0;
try {
  size = statSync(CONTENT).size;
} catch {
  process.stderr.write(
    `\n[check-page-loading-css] ERROR: dist/page-loading.css is missing.\n` +
      `  Run \`pnpm --filter @takazudo/zudo-doc build\` first so the\n` +
      `  tsup onSuccess hook copies the file, then retry.\n\n`,
  );
  process.exit(1);
}

if (size === 0) {
  process.stderr.write(
    `\n[check-page-loading-css] ERROR: dist/page-loading.css exists but is empty.\n` +
      `  The tsup onSuccess hook (copy-page-loading-css.mjs) may have failed.\n\n`,
  );
  process.exit(1);
}

process.stdout.write(`[check-page-loading-css] dist/page-loading.css OK (${size} bytes)\n`);
