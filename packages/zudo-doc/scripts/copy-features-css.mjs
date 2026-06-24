#!/usr/bin/env node
// scripts/copy-features-css.mjs
//
// Copy the static feature stylesheet src/features.css → dist/features.css so
// the package can ship it as `@takazudo/zudo-doc/features.css`. tsup
// (bundle:false) only compiles .ts/.tsx, so CSS assets need an explicit copy
// step; this runs from the tsup `onSuccess` hook AFTER compilation (clean:true
// wipes dist/ first, so dist/ exists by the time this runs but the file must
// be re-copied every build). Cross-platform (node fs, no shell `cp`).

import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../src/features.css");
const DEST = resolve(__dirname, "../dist/features.css");

try {
  statSync(SRC);
} catch {
  process.stderr.write(
    `\n[copy-features-css] ERROR: src/features.css is missing — cannot ship ` +
      `the features stylesheet.\n\n`,
  );
  process.exit(1);
}

mkdirSync(dirname(DEST), { recursive: true });
copyFileSync(SRC, DEST);

const { size } = statSync(DEST);
process.stdout.write(`[copy-features-css] dist/features.css OK (${size} bytes)\n`);
