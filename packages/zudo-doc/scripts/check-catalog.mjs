#!/usr/bin/env node
// scripts/check-catalog.mjs
//
// Presence + shape guard for dist/catalog.js — run as a prepack hook so a
// build that missed the tsup onSuccess step (gen-catalog.mjs) fails loudly
// instead of publishing a package whose `./catalog` export 404s or ships a
// stale manifest for consumers (mirrors check-theme-packs.mjs).
//
// Asserts: dist/catalog.js and dist/catalog.d.ts exist, the manifest has
// schemaVersion 1, exactly 31 packs (the current bundled pack count —
// zudolab/zudo-doc#3349 acceptance criterion), and every pack carries the
// full preview.{light,dark} swatch fields the catalog exists to serve
// (bg/fg/accent/syntax).
//
// Exit 0 → dist/catalog.js is valid and complete.
// Exit 1 → missing artifact or a shape violation (with a clear diagnostic).

import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const DIST_JS = resolve(PKG_ROOT, "dist/catalog.js");
const DIST_DTS = resolve(PKG_ROOT, "dist/catalog.d.ts");

const EXPECTED_PACK_COUNT = 31;
const SWATCH_FIELDS = ["bg", "fg", "accent"];
const SYNTAX_FIELDS = ["keyword", "string", "comment", "callable"];

if (!existsSync(DIST_JS) || !existsSync(DIST_DTS)) {
  process.stderr.write(
    `\n[check-catalog] ERROR: dist/catalog.js and/or dist/catalog.d.ts is missing.\n` +
      `  Run \`pnpm --filter @takazudo/zudo-doc build\` first so the\n` +
      `  tsup onSuccess hook (gen-catalog.mjs) generates the catalog, then retry.\n\n`,
  );
  process.exit(1);
}

const { default: catalog } = await import(DIST_JS);

let allOk = true;
function fail(message) {
  process.stderr.write(`[check-catalog] ERROR: ${message}\n`);
  allOk = false;
}

if (catalog.schemaVersion !== 1) {
  fail(`schemaVersion must be 1, got ${JSON.stringify(catalog.schemaVersion)}.`);
}
if (!Array.isArray(catalog.packs)) {
  fail(`catalog.packs must be an array, got ${typeof catalog.packs}.`);
} else {
  if (catalog.packs.length !== EXPECTED_PACK_COUNT) {
    fail(
      `catalog.packs must have exactly ${EXPECTED_PACK_COUNT} entries, got ${catalog.packs.length}.`,
    );
  }
  for (const pack of catalog.packs) {
    const preview = pack?.preview;
    for (const mode of ["light", "dark"]) {
      const swatches = preview?.[mode];
      if (!swatches) {
        fail(`pack "${pack?.slug}" is missing preview.${mode}.`);
        continue;
      }
      for (const field of SWATCH_FIELDS) {
        if (typeof swatches[field] !== "string" || swatches[field].length === 0) {
          fail(`pack "${pack.slug}" is missing preview.${mode}.${field}.`);
        }
      }
      for (const field of SYNTAX_FIELDS) {
        if (typeof swatches.syntax?.[field] !== "string" || swatches.syntax[field].length === 0) {
          fail(`pack "${pack.slug}" is missing preview.${mode}.syntax.${field}.`);
        }
      }
    }
  }
}

if (!allOk) process.exit(1);

process.stdout.write(
  `[check-catalog] dist/catalog.js OK (${catalog.packs.length} pack(s), schemaVersion ${catalog.schemaVersion})\n`,
);
