#!/usr/bin/env node
// scripts/check-theme-packs-registry.mjs
//
// Publish-time browser-safety guard for the `./theme-packs-registry` subpath
// (zudolab/zudo-doc#3679). The source test covers the same graph, but a
// prepack check must inspect the actual emitted JS and declarations so a stale
// or hand-edited dist/ cannot publish a Node-backed public entry by accident.
// The filesystem loader is intentionally a separate internal artifact and is
// not rooted by this check.

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeDeclarationGraph, analyzeSiteSchemaGraph } from "./site-schema-graph.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const DIST_JS = resolve(PKG_ROOT, "dist/theme-packs-registry/index.js");
const DIST_DTS = resolve(PKG_ROOT, "dist/theme-packs-registry/index.d.ts");

if (!existsSync(DIST_JS) || !existsSync(DIST_DTS)) {
  process.stderr.write(
    `\n[check-theme-packs-registry] ERROR: dist/theme-packs-registry/index.js and/or index.d.ts is missing.\n` +
      `  Run \`pnpm --filter @takazudo/zudo-doc build\` first, then retry.\n\n`,
  );
  process.exit(1);
}

const mod = await import(DIST_JS);
if (typeof mod.schemaVersion !== "number") {
  process.stderr.write(
    `[check-theme-packs-registry] ERROR: dist/theme-packs-registry/index.js does not export a numeric schemaVersion (got ${JSON.stringify(mod.schemaVersion)}).\n`,
  );
  process.exit(1);
}
if (typeof mod.buildThemePackRegistry !== "function") {
  process.stderr.write(
    `[check-theme-packs-registry] ERROR: dist/theme-packs-registry/index.js does not export buildThemePackRegistry(catalog, settings).\n`,
  );
  process.exit(1);
}
if (typeof mod.loadThemePackRegistry === "function") {
  process.stderr.write(
    `[check-theme-packs-registry] ERROR: the browser-safe barrel must not export loadThemePackRegistry.\n`,
  );
  process.exit(1);
}

const { violations: jsViolations, specifiers } = await analyzeSiteSchemaGraph({
  entry: DIST_JS,
  resolveFrom: [PKG_ROOT, resolve(PKG_ROOT, "../..")],
});
const {
  violations: dtsViolations,
  files: declarationFiles,
} = analyzeDeclarationGraph(DIST_DTS);

if (jsViolations.length > 0 || dtsViolations.length > 0) {
  process.stderr.write(
    `\n[check-theme-packs-registry] ERROR: ./theme-packs-registry must stay browser-safe.\n`,
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
  process.stderr.write("\n");
  process.exit(1);
}

process.stdout.write(
  `[check-theme-packs-registry] dist/theme-packs-registry/index.js OK ` +
    `(schemaVersion ${mod.schemaVersion}, ${specifiers.length} resolved specifier(s), ` +
    `${declarationFiles.length} declaration file(s), 0 forbidden)\n`,
);
