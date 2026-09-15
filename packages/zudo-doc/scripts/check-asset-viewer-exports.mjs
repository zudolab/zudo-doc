#!/usr/bin/env node
// scripts/check-asset-viewer-exports.mjs
//
// Publish-time guard for the asset-viewer exports added by zudolab/zudo-doc#4225
// (on top of #4221's asset-page split and #4223's asset-index-page split):
//
//   - `./asset-page/body`, `./asset-page/components`, `./asset-page/script`
//   - `./asset-index-page`, `./asset-index-page/body`,
//     `./asset-index-page/tree`, `./asset-index-page/script`
//
// `src/__tests__/asset-viewer-zfb-free.test.ts` proves the SOURCE graph of the
// six zfb-free modules is clean; this proves the SHIPPED artifacts are — not
// the same claim: `bundle:false`, a stale `dist/`, or a publish-time transform
// could all slip a forbidden dependency (or a missing file) past a
// source-only check.
//
// Two things are asserted:
//   1. every export target below (JS + `.d.ts`) exists on disk;
//   2. for the six zfb-free targets, nothing reachable from the shipped JS OR
//      the shipped `.d.ts` is a `node:*` builtin, a `virtual:*` module, an
//      `@takazudo/zfb*` package, or a direct `doclayout/`/`chrome/` import.
//      `./asset-index-page` itself is the zfb-BOUND factory (like
//      `./asset-page`) and is exempt from rule (2) — only existence is
//      checked for it.
//
// Exit 0 → every target exists and the zfb-free targets are browser-safe.
// Exit 1 → a missing artifact or a forbidden dependency (with a clear diagnostic).

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ASSET_VIEWER_FORBIDDEN_SPECIFIERS,
  analyzeDeclarationGraph,
  analyzeSiteSchemaGraph,
} from "./site-schema-graph.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(PKG_ROOT, "../..");

/** Every export target this sub adds, plus whether it must stay zfb-free. */
const TARGETS = [
  { subpath: "./asset-page/body", relJs: "dist/asset-page/body.js", zfbFree: true },
  { subpath: "./asset-page/components", relJs: "dist/asset-page/components.js", zfbFree: true },
  { subpath: "./asset-page/script", relJs: "dist/asset-page/script.js", zfbFree: true },
  { subpath: "./asset-index-page", relJs: "dist/asset-index-page/index.js", zfbFree: false },
  { subpath: "./asset-index-page/body", relJs: "dist/asset-index-page/body.js", zfbFree: true },
  { subpath: "./asset-index-page/tree", relJs: "dist/asset-index-page/tree.js", zfbFree: true },
  { subpath: "./asset-index-page/script", relJs: "dist/asset-index-page/script.js", zfbFree: true },
];

let missing = false;
for (const target of TARGETS) {
  const dtsRel = target.relJs.replace(/\.js$/, ".d.ts");
  for (const rel of [target.relJs, dtsRel]) {
    if (!existsSync(resolve(PKG_ROOT, rel))) {
      process.stderr.write(
        `[check-asset-viewer-exports] ERROR: ${target.subpath} → ${rel} is missing.\n`,
      );
      missing = true;
    }
  }
}
if (missing) {
  process.stderr.write(
    `\n  Run \`pnpm --filter @takazudo/zudo-doc build\` (or \`pnpm build:workspace\`) first, then retry.\n\n`,
  );
  process.exit(1);
}

let forbiddenFound = false;
let checkedCount = 0;

for (const target of TARGETS.filter((t) => t.zfbFree)) {
  const distJs = resolve(PKG_ROOT, target.relJs);
  const distDts = resolve(PKG_ROOT, target.relJs.replace(/\.js$/, ".d.ts"));

  const { violations: jsViolations, specifiers } = await analyzeSiteSchemaGraph({
    entry: distJs,
    resolveFrom: [PKG_ROOT, REPO_ROOT],
    rules: ASSET_VIEWER_FORBIDDEN_SPECIFIERS,
  });
  const { violations: dtsViolations, files } = analyzeDeclarationGraph(
    distDts,
    ASSET_VIEWER_FORBIDDEN_SPECIFIERS,
  );

  if (jsViolations.length > 0 || dtsViolations.length > 0) {
    forbiddenFound = true;
    process.stderr.write(
      `\n[check-asset-viewer-exports] ERROR: ${target.subpath} must stay zfb-free, but its shipped graph reaches a forbidden specifier:\n`,
    );
    for (const violation of jsViolations) {
      process.stderr.write(
        `  JS: ${violation.specifier} (${violation.label}) imported by ${violation.importer}\n`,
      );
    }
    for (const violation of dtsViolations) {
      process.stderr.write(
        `  DTS: ${violation.specifier} (${violation.label}) declared in ${violation.importer}\n`,
      );
    }
    continue;
  }

  checkedCount += 1;
  process.stdout.write(
    `[check-asset-viewer-exports] ${target.subpath} OK ` +
      `(${specifiers.length} resolved specifier(s), ${files.length} declaration file(s), 0 forbidden)\n`,
  );
}

if (forbiddenFound) {
  process.stderr.write(
    `\n  Move the offending code back behind the zfb-bound factory (./asset-page,\n` +
      `  ./asset-index-page) instead of the plain-prop body/components/script/tree\n` +
      `  modules.\n\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `[check-asset-viewer-exports] all ${TARGETS.length} export target(s) exist; ${checkedCount} zfb-free target(s) verified.\n`,
);
