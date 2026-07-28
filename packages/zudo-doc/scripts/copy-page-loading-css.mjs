#!/usr/bin/env node
// scripts/copy-page-loading-css.mjs
//
// Copy the static page-loading stylesheet src/page-loading.css → dist/page-loading.css so the
// package can ship it as `@takazudo/zudo-doc/page-loading.css`. tsup (bundle:false)
// only compiles .ts/.tsx, so CSS assets need an explicit copy step; this runs
// from the tsup `onSuccess` hook AFTER compilation (a one-shot build's clean
// wipes dist/ first — `clean: !options.watch`, so a watch build does not — and
// either way dist/ exists by the time this runs but the file must be re-copied
// every build). Cross-platform (node fs, no shell `cp`).

import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../src/page-loading.css");
const DEST = resolve(__dirname, "../dist/page-loading.css");

try {
  statSync(SRC);
} catch {
  process.stderr.write(
    `\n[copy-page-loading-css] ERROR: src/page-loading.css is missing — cannot ship ` +
      `the page-loading stylesheet.\n\n`,
  );
  process.exit(1);
}

mkdirSync(dirname(DEST), { recursive: true });
copyFileSync(SRC, DEST);

const { size } = statSync(DEST);
process.stdout.write(`[copy-page-loading-css] dist/page-loading.css OK (${size} bytes)\n`);
