#!/usr/bin/env node
// scripts/copy-content-css.mjs
//
// Copy the static content stylesheet src/content.css → dist/content.css so the
// package can ship it as `@takazudo/zudo-doc/content.css`. tsup (bundle:false)
// only compiles .ts/.tsx, so CSS assets need an explicit copy step; this runs
// from the tsup `onSuccess` hook AFTER compilation (a one-shot build's clean
// wipes dist/ first — `clean: !options.watch`, so a watch build does not — and
// either way dist/ exists by the time this runs but the file must be re-copied
// every build). Cross-platform (node fs, no shell `cp`).

import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../src/content.css");
const DEST = resolve(__dirname, "../dist/content.css");

try {
  statSync(SRC);
} catch {
  process.stderr.write(
    `\n[copy-content-css] ERROR: src/content.css is missing — cannot ship ` +
      `the content stylesheet.\n\n`,
  );
  process.exit(1);
}

mkdirSync(dirname(DEST), { recursive: true });
copyFileSync(SRC, DEST);

const { size } = statSync(DEST);
process.stdout.write(`[copy-content-css] dist/content.css OK (${size} bytes)\n`);
