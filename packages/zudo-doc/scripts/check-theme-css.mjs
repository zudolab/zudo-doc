#!/usr/bin/env node
// scripts/check-theme-css.mjs
//
// Presence and freshness guard for dist/theme.css and its derived
// dist/theme-no-reset.css variant — run as a prepack hook so a build that
// missed the tsup onSuccess step (which runs copy-theme-css.mjs) fails loudly
// instead of publishing a package whose CSS exports 404 or contain stale
// bytes for consumers.
//
// Exit 0 → both files exist, are non-empty, and the variant matches its
// canonical source-derived form.
// Exit 1 → a file is missing/empty or the variant is stale/invalid.

import { readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertNoResetVariant } from "./theme-css-variants.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const THEME = resolve(__dirname, "../dist/theme.css");
const NO_RESET_THEME = resolve(__dirname, "../dist/theme-no-reset.css");

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

let noResetSize = 0;
try {
  noResetSize = statSync(NO_RESET_THEME).size;
} catch {
  process.stderr.write(
    `\n[check-theme-css] ERROR: dist/theme-no-reset.css is missing.\n` +
      `  Run \`pnpm --filter @takazudo/zudo-doc build\` first so the\n` +
      `  tsup onSuccess hook derives the file, then retry.\n\n`,
  );
  process.exit(1);
}

if (noResetSize === 0) {
  process.stderr.write(
    `\n[check-theme-css] ERROR: dist/theme-no-reset.css exists but is empty.\n` +
      `  The tsup onSuccess hook (copy-theme-css.mjs) may have failed. Run\n` +
      `  \`pnpm --filter @takazudo/zudo-doc build\` and retry.\n\n`,
  );
  process.exit(1);
}

try {
  assertNoResetVariant(
    readFileSync(THEME, "utf8"),
    readFileSync(NO_RESET_THEME, "utf8"),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `\n[check-theme-css] ERROR: dist/theme-no-reset.css is invalid or stale.\n` +
      `  ${message}\n` +
      `  Run \`pnpm --filter @takazudo/zudo-doc build\` to regenerate both\n` +
      `  theme artifacts, then retry.\n\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `[check-theme-css] dist/theme-no-reset.css OK (${noResetSize} bytes; matches theme.css-derived variant)\n`,
);
