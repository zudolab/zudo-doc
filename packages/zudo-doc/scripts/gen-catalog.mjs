#!/usr/bin/env node
// scripts/gen-catalog.mjs
//
// Generate the complete `dist/catalog.js` + `dist/catalog.d.ts` artifact pair
// for the `@takazudo/zudo-doc/catalog` browser-safe data export (zudolab/
// zudo-doc#3349, epic #3345 "theme catalog single-sourcing"). Aggregates
// EVERY bundled theme pack's validated `meta.json` into one
// `{ schemaVersion: 2, packs: ThemePackCatalogEntry[] }` manifest, `"default"`
// first then alphabetical (the `resolveEnabledPacks` convention — this script
// calls that same pure resolver with no settings so it resolves every pack, in
// that canonical order). Catalog schema v2 is independent from the schema
// version inside each pack's `meta.json` (currently v1); those two version
// numbers must not be conflated.
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
// (e.g. zudolab/zudo-doc-cloud) can import this subpath directly.

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
  schemaVersion: 2,
  packs: enabled.map(({ slug, meta, hasStylesheet }) => ({
    slug,
    meta,
    hasStylesheet,
  })),
};

const banner = "// GENERATED FILE — do not edit by hand.\n// Produced by scripts/gen-catalog.mjs (zudolab/zudo-doc#3349, #3675) from the\n// validated src/theme-packs/<slug>/meta.json registry. Re-run `pnpm build`\n// to regenerate after adding, removing, or editing a theme pack.\n// Catalog schemaVersion 2 is distinct from each pack's meta.json schemaVersion 1.\n";

writeFileSync(
  DIST_JS,
  `${banner}const catalog = ${JSON.stringify(manifest)};\n\n/**\n * Validate the browser-facing catalog contract before consuming its entries.\n *\n * Catalog schemaVersion 2 is deliberately independent from the schemaVersion\n * in each pack's meta.json (currently 1). This validator checks the catalog\n * contract only; those per-pack metadata versions must not be conflated.\n */\nexport function validateThemePackCatalog(value) {\n  if (value === null || typeof value !== \"object\" || Array.isArray(value)) {\n    throw new TypeError(\n      \`@takazudo/zudo-doc/catalog: expected a catalog manifest object with schemaVersion 2; got \${describeCatalogValue(value)}.\`,\n    );\n  }\n\n  if (value.schemaVersion !== 2) {\n    throw new Error(\n      \`@takazudo/zudo-doc/catalog: unsupported catalog schemaVersion \${describeCatalogValue(value.schemaVersion)}; expected 2.\`,\n    );\n  }\n\n  if (!Array.isArray(value.packs)) {\n    throw new TypeError(\n      \`@takazudo/zudo-doc/catalog: catalog.packs must be an array; got \${describeCatalogValue(value.packs)}.\`,\n    );\n  }\n\n  for (const [index, entry] of value.packs.entries()) {\n    if (entry === null || typeof entry !== \"object\" || Array.isArray(entry)) {\n      throw new TypeError(\n        \`@takazudo/zudo-doc/catalog: catalog.packs[\${index}] must be an object; got \${describeCatalogValue(entry)}.\`,\n      );\n    }\n    if (typeof entry.slug !== \"string\") {\n      throw new TypeError(\n        \`@takazudo/zudo-doc/catalog: catalog.packs[\${index}].slug must be a string; got \${describeCatalogValue(entry.slug)}.\`,\n      );\n    }\n    if (entry.meta === null || typeof entry.meta !== \"object\" || Array.isArray(entry.meta)) {\n      throw new TypeError(\n        \`@takazudo/zudo-doc/catalog: catalog.packs[\${index}].meta must be an object; got \${describeCatalogValue(entry.meta)}.\`,\n      );\n    }\n    if (typeof entry.hasStylesheet !== \"boolean\") {\n      throw new TypeError(\n        \`@takazudo/zudo-doc/catalog: catalog.packs[\${index}].hasStylesheet must be a boolean; got \${describeCatalogValue(entry.hasStylesheet)}.\`,\n      );\n    }\n  }\n\n  return value;\n}\n\n/** @param {unknown} value */\nfunction describeCatalogValue(value) {\n  if (value === undefined) return \"undefined\";\n  try {\n    const json = JSON.stringify(value);\n    return json === undefined ? String(value) : json;\n  } catch {\n    return String(value);\n  }\n}\n\nexport default catalog;\n`,
);

writeFileSync(
  DIST_DTS,
  `${banner}import type { ThemePackMeta } from "./theme-packs-registry/meta-schema.js";

export type { ThemePackMeta };

/** One entry in the browser-facing catalog (catalog schemaVersion 2). */
export interface ThemePackCatalogEntry {
  /** The pack directory slug. */
  slug: string;
  /** The pack's metadata; its own meta.json schemaVersion is currently 1. */
  meta: ThemePackMeta;
  /** Whether the pack ships a pack.css stylesheet, from the real registry. */
  hasStylesheet: boolean;
}

/** The v2 catalog entry is structurally the same as a resolved registry entry. */
export type ThemePackRegistryEntry = ThemePackCatalogEntry;

/**
 * The browser-facing theme-pack catalog manifest.
 *
 * This catalog schemaVersion 2 is distinct from each pack's meta.json
 * schemaVersion 1. The two version numbers are unrelated and must not be
 * conflated. The manifest is declared here instead of importing the
 * postBuild-time theme-packs/index.json type so the browser export keeps its
 * own contract and remains free of node-touching imports.
 */
export interface ThemePacksCatalogManifest {
  schemaVersion: 2;
  packs: ThemePackCatalogEntry[];
}

/**
 * @deprecated Use ThemePacksCatalogManifest. This catalog-only legacy name is
 * not the postBuild plugin's separate \`ThemePacksIndexManifest\` type.
 */
export type ThemePacksIndexManifest = ThemePacksCatalogManifest;

/**
 * Validate and return a browser-facing catalog manifest. Throws when the
 * catalog is not schemaVersion 2 or has malformed v2 entries.
 */
export declare function validateThemePackCatalog(
  value: unknown,
): ThemePacksCatalogManifest;

declare const catalog: ThemePacksCatalogManifest;
export default catalog;
`,
);

process.stdout.write(
  `[gen-catalog] dist/catalog.js + dist/catalog.d.ts OK (${manifest.packs.length} pack(s))\n`,
);
