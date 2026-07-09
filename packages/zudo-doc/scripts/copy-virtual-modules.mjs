#!/usr/bin/env node
// scripts/copy-virtual-modules.mjs
//
// Generate the package-root `virtual-modules.d.ts` (the HOST-facing ambient
// shim shipped via `tsconfig.base.json`'s top-level `files`, #2656) from the
// single source of truth `src/routes/_virtual.d.ts`, rewriting parent-relative
// `import(...)` type specifiers to bare `@takazudo/zudo-doc/*` subpaths —
// the same rewrite `copy-routes-src.mjs` applies to the route sources, for
// the same reason: the shipped copy lives at a different depth (the package
// root) and resolves types from a CONSUMER's node_modules, where only the
// package's public subpath exports exist.
//
// Runs in the tsup `onSuccess` chain. The output is gitignored (like
// `routes-src/`) but published via package.json `files[]` + `exports`.
// Generating instead of hand-duplicating removes the hand-sync duty an
// earlier draft of #2656 carried — edit `src/routes/_virtual.d.ts` and
// rebuild; never edit the generated file.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const SRC = resolve(PKG_ROOT, "src/routes/_virtual.d.ts");
const DEST = resolve(PKG_ROOT, "virtual-modules.d.ts");

// Same two parent-relative shapes copy-routes-src.mjs rewrites, applied to
// inline `import("../…")` TYPE specifiers (the only import form a .d.ts of
// ambient module declarations can carry — a top-level import would break the
// ambient blocks):
//   ../<seg>/<rest>        → @takazudo/zudo-doc/<seg>
//   ../<file>.{js,ts,tsx}  → @takazudo/zudo-doc/<file>
const PARENT_SUBDIR = String.raw`\.\.\/([\w-]+)\/[^"']+`;
const PARENT_FILE = String.raw`\.\.\/([\w-]+)\.[cm]?[jt]sx?`;

function rewriteImports(code) {
  let out = code;
  out = out.replace(
    new RegExp(String.raw`(import\s*\(\s*)(["'])` + PARENT_SUBDIR + String.raw`\2`, "g"),
    (_m, head, q, seg) => `${head}${q}@takazudo/zudo-doc/${seg}${q}`,
  );
  out = out.replace(
    new RegExp(String.raw`(import\s*\(\s*)(["'])` + PARENT_FILE + String.raw`\2`, "g"),
    (_m, head, q, file) => `${head}${q}@takazudo/zudo-doc/${file}${q}`,
  );
  return out;
}

const BANNER = `// GENERATED FILE — DO NOT EDIT.
// Built from src/routes/_virtual.d.ts by scripts/copy-virtual-modules.mjs
// (tsup onSuccess), with parent-relative import(...) type specifiers
// rewritten to bare @takazudo/zudo-doc/* subpaths. Edit the source file and
// rebuild the package (pnpm --filter @takazudo/zudo-doc build) instead.
//
// Host-facing: pulled into consumer projects via tsconfig.base.json's
// top-level "files" so host code importing the zfb virtual modules
// (virtual:zudo-doc-route-context / virtual:zudo-doc-chrome-bindings)
// typechecks. Consumer-level regression proof (tsc/zfb check against a
// fixture extending tsconfig.base.json) lives in the Wave-5 confirm case
// (zudolab/zudo-doc#2659).

`;

let source;
try {
  source = readFileSync(SRC, "utf-8");
} catch {
  process.stderr.write(
    `\n[copy-virtual-modules] ERROR: src/routes/_virtual.d.ts is missing — cannot ` +
      `generate virtual-modules.d.ts.\n\n`,
  );
  process.exit(1);
}

const rewritten = rewriteImports(source);
writeFileSync(DEST, BANNER + rewritten, "utf-8");

const residual = rewritten.match(/import\s*\(\s*["']\.\.\//);
if (residual) {
  process.stderr.write(
    `\n[copy-virtual-modules] ERROR: a parent-relative import(...) specifier ` +
      `survived the rewrite — check the patterns in this script.\n\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `[copy-virtual-modules] virtual-modules.d.ts OK (${BANNER.length + rewritten.length} bytes)\n`,
);
