#!/usr/bin/env node
// scripts/check-theme-css.mjs
//
// Presence guard for dist/theme.css — run as a prepack hook so a build that
// missed the tsup onSuccess step (which runs copy-theme-css.mjs) fails loudly
// instead of publishing a package whose `./theme.css` export 404s for
// consumers (both the showcase and every create-zudo-doc project @import it).
//
// Exit 0 → theme.css exists and is non-empty.
// Exit 1 → file is missing or empty (with a clear diagnostic message).

import { statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const THEME = resolve(__dirname, "../dist/theme.css");

let size = 0;
try {
  size = statSync(THEME).size;
} catch {
  process.stderr.write(
    `\n[check-theme-css] ERROR: dist/theme.css is missing.\n` +
      `  Run \`pnpm --filter @takazudo/zudo-doc build\` first so the\n` +
      `  tsup onSuccess hook copies the file, then retry.\n\n`,
  );
  process.exit(1);
}

if (size === 0) {
  process.stderr.write(
    `\n[check-theme-css] ERROR: dist/theme.css exists but is empty.\n` +
      `  The tsup onSuccess hook (copy-theme-css.mjs) may have failed.\n\n`,
  );
  process.exit(1);
}

process.stdout.write(`[check-theme-css] dist/theme.css OK (${size} bytes)\n`);
