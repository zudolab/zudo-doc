#!/usr/bin/env node
// Publish-time public-shape and browser-safety guard for
// `./route-context-payload`. It checks both emitted runtime and declaration
// graphs with the shared site-schema detector.

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeDeclarationGraph,
  analyzeSiteSchemaGraph,
} from "./site-schema-graph.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const DIST_JS = resolve(PKG_ROOT, "dist/route-context-payload/index.js");
const DIST_DTS = resolve(PKG_ROOT, "dist/route-context-payload/index.d.ts");

if (!existsSync(DIST_JS) || !existsSync(DIST_DTS)) {
  process.stderr.write(
    "\n[check-route-context-payload] ERROR: emitted JS and/or declarations are missing.\n" +
      "  Run `pnpm --filter @takazudo/zudo-doc build` first, then retry.\n\n",
  );
  process.exit(1);
}

const mod = await import(DIST_JS);
if (typeof mod.createRouteContextPayload !== "function") {
  process.stderr.write(
    "[check-route-context-payload] ERROR: the public entry does not export createRouteContextPayload(input).\n",
  );
  process.exit(1);
}

const { violations: jsViolations, specifiers } = await analyzeSiteSchemaGraph({
  entry: DIST_JS,
  resolveFrom: [PKG_ROOT, resolve(PKG_ROOT, "../..")],
});
const { violations: dtsViolations, files } = analyzeDeclarationGraph(DIST_DTS);

if (jsViolations.length > 0 || dtsViolations.length > 0) {
  process.stderr.write(
    "\n[check-route-context-payload] ERROR: ./route-context-payload must stay browser-safe.\n",
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
  `[check-route-context-payload] OK (${specifiers.length} resolved runtime specifier(s), ` +
    `${files.length} declaration file(s), 0 forbidden)\n`,
);
