#!/usr/bin/env node
// scripts/check-features-css.mjs
//
// Presence guard for dist/features.css — run as a prepack hook so a build that
// missed the tsup onSuccess step (which runs copy-features-css.mjs) fails loudly
// instead of publishing a package whose `./features.css` export 404s for
// consumers (both the showcase and every create-zudo-doc project @import it).
//
// Exit 0 → features.css exists and is non-empty.
// Exit 1 → file is missing or empty (with a clear diagnostic message).

import { statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FEATURES = resolve(__dirname, "../dist/features.css");

let size = 0;
try {
  size = statSync(FEATURES).size;
} catch {
  process.stderr.write(
    `\n[check-features-css] ERROR: dist/features.css is missing.\n` +
      `  Run \`pnpm --filter @takazudo/zudo-doc build\` first so the\n` +
      `  tsup onSuccess hook copies the file, then retry.\n\n`,
  );
  process.exit(1);
}

if (size === 0) {
  process.stderr.write(
    `\n[check-features-css] ERROR: dist/features.css exists but is empty.\n` +
      `  The tsup onSuccess hook (copy-features-css.mjs) may have failed.\n\n`,
  );
  process.exit(1);
}

process.stdout.write(`[check-features-css] dist/features.css OK (${size} bytes)\n`);
