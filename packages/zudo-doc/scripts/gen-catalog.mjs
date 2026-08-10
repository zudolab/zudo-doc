#!/usr/bin/env node
// scripts/gen-catalog.mjs
//
// Generate the complete `dist/catalog.js` + `dist/catalog.d.ts` artifact pair
// for the `@takazudo/zudo-doc/catalog` browser-safe data export (zudolab/
// zudo-doc#3349, epic #3345 "theme catalog single-sourcing"). Aggregates
// EVERY bundled theme pack's validated `meta.json` into one
// `{ schemaVersion: 1, packs: ThemePackMeta[] }` manifest, `"default"` first
// then alphabetical (the `resolveEnabledPacks` convention — this script calls
// that same pure resolver with no settings so it resolves every pack, in that
// canonical order).
//
// GENERATION SEQUENCING (binding, per the issue spec): this emits the
// COMPLETE dist/ artifact pair directly, rather than generating a
// `src/catalog.ts` module for tsup to compile — tsup has already compiled by
// the time `onSuccess` runs, so a source-generation approach would ship a
// missing/stale dist/catalog.js on a clean one-shot build. Mirrors the
// `copy-theme-packs.mjs` precedent: runs from the tsup `onSuccess` chain,
// AFTER copy-theme-packs.mjs (so both read the same validated SRC packs
// directory), and imports the ALREADY-COMPILED
// `dist/theme-packs-registry/index.js` for `loadThemePackRegistry` +
// `resolveEnabledPacks` — pure, browser-safe logic already proven against
// this exact registry shape.
//
// The generated `dist/catalog.js` embeds the manifest as a JSON literal —
// no `node:fs` import, no filesystem access at import time, so a browser app
// (packages/zudo-doc-online) can import this subpath directly.

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const SRC = resolve(PKG_ROOT, "src/theme-packs");
const DIST_JS = resolve(PKG_ROOT, "dist/catalog.js");
const DIST_DTS = resolve(PKG_ROOT, "dist/catalog.d.ts");

const { loadThemePackRegistry, resolveEnabledPacks } = await import(
  resolve(PKG_ROOT, "dist/theme-packs-registry/index.js")
);

let registry;
try {
  registry = loadThemePackRegistry(SRC);
} catch (err) {
  process.stderr.write(`\n[gen-catalog] ERROR: ${err.message}\n\n`);
  process.exit(1);
}

// No settings filter → every bundled pack, "default" first then alphabetical.
let enabled;
try {
  enabled = resolveEnabledPacks(registry, {});
} catch (err) {
  process.stderr.write(`\n[gen-catalog] ERROR: ${err.message}\n\n`);
  process.exit(1);
}
const manifest = {
  schemaVersion: 1,
  packs: enabled.map((entry) => entry.meta),
};

const banner = "// GENERATED FILE — do not edit by hand.\n// Produced by scripts/gen-catalog.mjs (zudolab/zudo-doc#3349) from the\n// validated src/theme-packs/<slug>/meta.json registry. Re-run `pnpm build`\n// to regenerate after adding, removing, or editing a theme pack.\n";

writeFileSync(
  DIST_JS,
  `${banner}const catalog = ${JSON.stringify(manifest)};\n\nexport default catalog;\n`,
);

writeFileSync(
  DIST_DTS,
  `${banner}import type { ThemePackMeta } from "./theme-packs-registry/meta-schema.js";

export type { ThemePackMeta };

/** The aggregated theme-pack catalog manifest shape — mirrors the
 *  postBuild-time \`theme-packs/index.json\` registry manifest
 *  (\`ThemePacksIndexManifest\` in plugins/internal/theme-packs/types.ts),
 *  duplicated here rather than imported so this module stays free of any
 *  node-touching import chain. */
export interface ThemePacksIndexManifest {
  schemaVersion: 1;
  packs: ThemePackMeta[];
}

declare const catalog: ThemePacksIndexManifest;
export default catalog;
`,
);

process.stdout.write(
  `[gen-catalog] dist/catalog.js + dist/catalog.d.ts OK (${manifest.packs.length} pack(s))\n`,
);
