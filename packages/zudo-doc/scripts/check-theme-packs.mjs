#!/usr/bin/env node
// scripts/check-theme-packs.mjs
//
// Presence + validity guard for dist/theme-packs/ — run as a prepack hook so
// a build that missed the tsup onSuccess step (copy-theme-packs.mjs) fails
// loudly instead of publishing a package whose bundled theme packs 404/are
// broken for consumers (mirrors check-theme-css.mjs).
//
// Asserts: dist/theme-packs/ exists, every discovered pack still passes the
// Decision 6.7 validator (re-scanned via the compiled loader — dist/ may
// have been hand-edited or partially copied since the last build), and at
// least the two reserved slugs this package ships today ("default" — meta
// only, "foundry" — the CSS-bearing reference pack) are present with the
// right css-presence shape.
//
// Exit 0 → dist/theme-packs/ is valid and complete.
// Exit 1 → missing directory, a failed pack, or a missing required slug
// (with a clear diagnostic message).

import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const DIST_THEME_PACKS = resolve(PKG_ROOT, "dist/theme-packs");

// slug -> whether it must ship a non-empty pack.css (ADR Decision 1: the
// reserved "default" pack ships meta.json ONLY).
const REQUIRED_SLUGS = { default: false, foundry: true };

if (!existsSync(DIST_THEME_PACKS)) {
  process.stderr.write(
    `\n[check-theme-packs] ERROR: dist/theme-packs/ is missing.\n` +
      `  Run \`pnpm --filter @takazudo/zudo-doc build\` first so the\n` +
      `  tsup onSuccess hook (copy-theme-packs.mjs) copies the packs, then retry.\n\n`,
  );
  process.exit(1);
}

let registry;
try {
  const { loadThemePackRegistry } = await import(
    resolve(PKG_ROOT, "dist/theme-packs-registry/index.js")
  );
  registry = loadThemePackRegistry(DIST_THEME_PACKS);
} catch (err) {
  process.stderr.write(`\n[check-theme-packs] ERROR: ${err.message}\n\n`);
  process.exit(1);
}

const bySlug = new Map(registry.map((e) => [e.slug, e]));
let allOk = true;

for (const [slug, wantsCss] of Object.entries(REQUIRED_SLUGS)) {
  const entry = bySlug.get(slug);
  if (!entry) {
    process.stderr.write(
      `[check-theme-packs] ERROR: required pack "${slug}" is missing from dist/theme-packs/.\n`,
    );
    allOk = false;
    continue;
  }
  if (entry.hasStylesheet !== wantsCss) {
    process.stderr.write(
      `[check-theme-packs] ERROR: pack "${slug}" ${wantsCss ? "must" : "must NOT"} ship pack.css.\n`,
    );
    allOk = false;
    continue;
  }
  process.stdout.write(`[check-theme-packs] dist/theme-packs/${slug} OK\n`);
}

if (!allOk) process.exit(1);

process.stdout.write(
  `[check-theme-packs] dist/theme-packs/ OK (${registry.length} pack(s) total)\n`,
);
