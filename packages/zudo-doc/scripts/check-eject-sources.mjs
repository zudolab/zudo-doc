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
const EJECT_ROOT = resolve(__dirname, "../eject");

/** Must stay in sync with EJECTABLE in packages/create-zudo-doc/src/eject.ts
 *  and the EJECTABLE list in copy-eject-sources.mjs. */
const EJECTABLE = [
  "header",
  "footer",
  "breadcrumb",
  "toc",
  "sidebar",
  "theme-toggle",
  "page-loading",
  "tab-item",
  "doc-pager",
  "content-admonition",
  "code-group",
  "details",
];

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
