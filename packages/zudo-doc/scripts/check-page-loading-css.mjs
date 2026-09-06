#!/usr/bin/env node
// scripts/check-page-loading-css.mjs
//
// Presence guard for dist/page-loading.css — run as a prepack hook so a build that
// missed the tsup onSuccess step (which runs copy-page-loading-css.mjs) fails loudly
// instead of publishing a package whose `./page-loading.css` export 404s for
// consumers.
//
// This is a presence check, not a freshness check: it passes on a *stale*
// dist/page-loading.css just as happily as on a fresh one (same gap as the
// ensure-workspace-build preflight that runs ahead of this in b4push — see the root
// CLAUDE.md's "Workspace build prerequisite" section). A stale file still satisfies
// the publish contract this guard exists for, so the fix for that case is a rebuild
// (`pnpm --filter @takazudo/zudo-doc build`), not an edit to this script.
//
// Exit 0 → page-loading.css exists and is non-empty (does not prove it is fresh).
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
      `  This is a presence check only — it cannot tell a missing file from a stale\n` +
      `  one that was never rebuilt after a source change. Either way, run\n` +
      `  \`pnpm --filter @takazudo/zudo-doc build\` first so the tsup onSuccess hook\n` +
      `  (re)copies the file, then retry.\n\n`,
  );
  process.exit(1);
}

if (size === 0) {
  process.stderr.write(
    `\n[check-page-loading-css] ERROR: dist/page-loading.css exists but is empty.\n` +
      `  The tsup onSuccess hook (copy-page-loading-css.mjs) may have failed. A\n` +
      `  rebuild (\`pnpm --filter @takazudo/zudo-doc build\`) fixes this too, not an\n` +
      `  edit to this script.\n\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `[check-page-loading-css] dist/page-loading.css OK (${size} bytes) — presence only, ` +
    `not proof the file is fresh; run a build after editing the source CSS.\n`,
);
