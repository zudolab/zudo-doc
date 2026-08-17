#!/usr/bin/env node
// scripts/check-site-schema.mjs
//
// Publish-time browser-safety guard for the `@takazudo/zudo-doc/site-schema`
// subpath (zudolab/zudo-doc#3395) — run in the `prepack` chain next to
// check-catalog.mjs.
//
// The unit test in `src/__tests__/site-schema.test.ts` proves the SOURCE graph
// is clean; this proves the SHIPPED graph is, which is not the same claim: a
// stale `dist/`, a hand-edited artifact, or a build that ran with different
// resolution would all slip past a source-only check and reach consumers.
//
// Asserts: dist/site-schema/index.js and index.d.ts exist, the barrel really
// exports `schemaVersion`, and nothing reachable from the bundled JS is a
// `node:*` builtin, preact, a stylesheet, a `virtual:` module, or an
// `@takazudo/zfb*` package.
//
// Exit 0 → the shipped subpath is browser-safe.
// Exit 1 → missing artifact or a forbidden dependency (with a clear diagnostic).

import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeSiteSchemaGraph } from "./site-schema-graph.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const DIST_JS = resolve(PKG_ROOT, "dist/site-schema/index.js");
const DIST_DTS = resolve(PKG_ROOT, "dist/site-schema/index.d.ts");

if (!existsSync(DIST_JS) || !existsSync(DIST_DTS)) {
  process.stderr.write(
    `\n[check-site-schema] ERROR: dist/site-schema/index.js and/or index.d.ts is missing.\n` +
      `  Run \`pnpm --filter @takazudo/zudo-doc build\` first, then retry.\n\n`,
  );
  process.exit(1);
}

const mod = await import(DIST_JS);
if (typeof mod.schemaVersion !== "number") {
  process.stderr.write(
    `[check-site-schema] ERROR: dist/site-schema/index.js does not export a numeric ` +
      `schemaVersion (got ${JSON.stringify(mod.schemaVersion)}).\n`,
  );
  process.exit(1);
}

const { violations, specifiers } = await analyzeSiteSchemaGraph({
  entry: DIST_JS,
  resolveFrom: [PKG_ROOT, resolve(PKG_ROOT, "../..")],
});

if (violations.length > 0) {
  process.stderr.write(
    `\n[check-site-schema] ERROR: ./site-schema must stay browser-safe, but its\n` +
      `  shipped graph reaches ${violations.length} forbidden specifier(s):\n` +
      violations
        .map((v) => `    ${v.specifier}  (${v.label})  imported by ${v.importer}\n`)
        .join("") +
      `\n  Move the offending code behind a subpath that is allowed to be\n` +
      `  engine-bound (e.g. ./doc-route-entries, ./nav-source-docs), or import\n` +
      `  the pure half directly (e.g. ../sidebar-tree/build-tree.js instead of\n` +
      `  the sidebar-tree barrel).\n\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `[check-site-schema] dist/site-schema/index.js OK ` +
    `(schemaVersion ${mod.schemaVersion}, ${specifiers.length} resolved specifier(s), 0 forbidden)\n`,
);
