#!/usr/bin/env node
// scripts/copy-theme-packs.mjs
//
// Copy the pack sources `src/theme-packs/<slug>/**` (pack.css, meta.json,
// fonts/*) verbatim into `dist/theme-packs/<slug>/**` so the package can ship
// them as the `@takazudo/zudo-doc/theme-packs/*` static-asset export, and so a
// real `zfb build` can resolve `new URL("../theme-packs/", import.meta.url)`
// from `dist/plugins/routes.js` / `dist/plugins/theme-packs.js` (ADR
// docs/adr/theme-packs.md, Decision 2). Before #2820 this directory did not
// exist in `dist/`, which made `routes.ts`'s registry scan throw
// "theme-packs directory not found" on a real build — this script is what
// closes that gap.
//
// Runs from the tsup `onSuccess` chain AFTER compilation (clean:true wipes
// dist/ first) — mirrors copy-theme-css.mjs's shape. Before copying, this
// imports the ALREADY-COMPILED `dist/theme-packs-registry/index.js` (tsup
// just finished compiling it) and calls `loadThemePackRegistry` against the
// SOURCE directory — which validates every bundled pack (ADR Decision 6.7)
// and throws loudly, naming the offending pack, on any failure. This is what
// makes a broken pack fail the PACKAGE build, not a consumer's site build
// (mirrors `copy-eject-sources.mjs`'s "import from dist/, already compiled"
// precedent).

import { cpSync, mkdirSync, rmSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const SRC = resolve(PKG_ROOT, "src/theme-packs");
const DEST = resolve(PKG_ROOT, "dist/theme-packs");

try {
  statSync(SRC);
} catch {
  process.stderr.write(
    `\n[copy-theme-packs] ERROR: src/theme-packs/ is missing — cannot ship theme packs.\n\n`,
  );
  process.exit(1);
}

const { loadThemePackRegistry } = await import(
  resolve(PKG_ROOT, "dist/theme-packs-registry/index.js")
);

let registry;
try {
  registry = loadThemePackRegistry(SRC);
} catch (err) {
  process.stderr.write(`\n[copy-theme-packs] ERROR: ${err.message}\n\n`);
  process.exit(1);
}

// Wipe the old dist/theme-packs/ tree so a removed/renamed pack doesn't linger.
rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true });

const slugs = registry.map((e) => e.slug).sort();
process.stdout.write(
  `[copy-theme-packs] dist/theme-packs/ OK (${slugs.length} pack(s): ${slugs.join(", ")})\n`,
);
