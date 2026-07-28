#!/usr/bin/env node
// scripts/copy-eject-sources.mjs
//
// Copy each ejectable component's source directory verbatim from
// `src/<component>/` into `eject/<component>/` so the package can ship TS
// source for the `zudo-doc eject <component>` CLI (Decision 1 — C0 #2359).
//
// Exclusions per the eject contract:
//   - __tests__/ subdirectories
//   - *.test.ts / *.test.tsx files
//   - vitest.config.ts files
//
// Runs as part of the tsup `onSuccess` chain AFTER the JS/DTS compilation pass.
// A one-shot build's clean (`clean: !options.watch`) wipes `dist/` only —
// `eject/` is not under `dist/`, so it is NEVER automatically cleaned, under
// watch or otherwise. We wipe and recreate `eject/` here to keep the
// output deterministic (no stale files from renamed or removed components).

import { cpSync, rmSync, mkdirSync, statSync, readdirSync } from "node:fs";
import { resolve, dirname, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const SRC_ROOT = resolve(PKG_ROOT, "src");
const EJECT_ROOT = resolve(PKG_ROOT, "eject");

// Import EJECTABLE from the compiled package (single source of truth — S4 #2373).
// This script runs in onSuccess, AFTER tsup has compiled dist/eject/index.js.
const { EJECTABLE: EJECTABLE_MAP } = await import(resolve(PKG_ROOT, "dist/eject/index.js"));

/** Ejectable component names — derived from the canonical EJECTABLE map. */
const EJECTABLE = Object.keys(EJECTABLE_MAP);

/** Returns true for paths that should be excluded from the eject copy. */
function shouldExclude(srcAbs, srcBase) {
  const rel = relative(srcBase, srcAbs).split(/[\\/]/).join("/");
  if (rel === "") return false; // root dir itself — include
  const parts = rel.split("/");
  // Exclude __tests__/ directories (and their contents)
  if (parts.includes("__tests__")) return true;
  const filename = parts[parts.length - 1] ?? "";
  // Exclude *.test.ts / *.test.tsx / vitest.config.ts
  if (/\.test\.[cm]?[jt]sx?$/.test(filename)) return true;
  if (filename === "vitest.config.ts") return true;
  return false;
}

/** Recursively count files in a directory. */
function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += countFiles(join(dir, entry.name));
    else n++;
  }
  return n;
}

// Wipe the old eject/ tree so removed/renamed components don't linger.
rmSync(EJECT_ROOT, { recursive: true, force: true });
mkdirSync(EJECT_ROOT, { recursive: true });

let totalFiles = 0;

for (const name of EJECTABLE) {
  const srcDir = resolve(SRC_ROOT, name);
  const destDir = resolve(EJECT_ROOT, name);

  try {
    statSync(srcDir);
  } catch {
    process.stderr.write(
      `\n[copy-eject-sources] ERROR: src/${name}/ is missing — cannot build eject source.\n\n`,
    );
    process.exit(1);
  }

  cpSync(srcDir, destDir, {
    recursive: true,
    filter: (src) => !shouldExclude(src, srcDir),
  });

  const n = countFiles(destDir);
  totalFiles += n;
  process.stdout.write(`[copy-eject-sources] eject/${name}/ OK (${n} files)\n`);
}

process.stdout.write(
  `[copy-eject-sources] Done — ${EJECTABLE.length} components, ${totalFiles} files total\n`,
);
