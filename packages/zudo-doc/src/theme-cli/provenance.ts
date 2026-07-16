// theme-cli/provenance — `.zudo-doc.json` theme-pack provenance (issue #2824
// "Config-rewrite safety contract" / "`.zudo-doc.json` provenance").
//
// SCHEMA DECISION (locked): `.zudo-doc.json` previously recorded ONLY
// `{ packageVersion, ejected }` (see `src/eject/index.ts`'s `ZudoDocJson`).
// This adds exactly ONE new top-level key, additively:
//
//   {
//     "themePack": {
//       "schemaVersion": 1,
//       "slug": "foundry",
//       "packVersion": "1.0.0",
//       "appliedAt": "2026-07-16T00:00:00.000Z"
//     }
//   }
//
// `schemaVersion` versions the NESTED `themePack` object specifically (not
// the whole file) so this key's shape can evolve independently later
// without needing a file-wide migration. Existing readers of `.ejected` /
// `.packageVersion` (the eject module) are unaffected — they only read
// those two keys and never inspect `themePack`, and this module always
// reads the existing file first and merges (spread), so an eject-only file
// keeps its `ejected`/`packageVersion` keys intact after a `theme apply`,
// and vice versa.
//
// Written on every successful `apply` (overwrites the previous `themePack`
// object; `apply default` writes `slug: "default"` explicitly — see
// `config-rewriter.ts`'s header comment for why "set", not "remove").

import fs from "fs-extra";
import path from "node:path";

export const ZUDO_DOC_JSON_FILENAME = ".zudo-doc.json";
export const THEME_PACK_PROVENANCE_SCHEMA_VERSION = 1 as const;

export interface ThemePackProvenance {
  schemaVersion: typeof THEME_PACK_PROVENANCE_SCHEMA_VERSION;
  slug: string;
  packVersion: string;
  /** ISO 8601 timestamp of the apply that produced this record. */
  appliedAt: string;
}

function provenancePath(cwd: string): string {
  return path.join(cwd, ZUDO_DOC_JSON_FILENAME);
}

async function readExisting(cwd: string): Promise<Record<string, unknown>> {
  const filePath = provenancePath(cwd);
  if (!(await fs.pathExists(filePath))) return {};
  try {
    return (await fs.readJson(filePath)) as Record<string, unknown>;
  } catch {
    // Corrupt file — treat as empty, same fallback the eject module uses.
    return {};
  }
}

/** Merge-write the `themePack` provenance key, preserving every other
 *  top-level key already in `.zudo-doc.json` (notably `ejected` /
 *  `packageVersion`, written by `zudo-doc eject`). Creates the file if
 *  absent. */
export async function writeThemePackProvenance(
  cwd: string,
  entry: ThemePackProvenance,
): Promise<void> {
  const existing = await readExisting(cwd);
  existing.themePack = entry;
  await fs.writeJson(provenancePath(cwd), existing, { spaces: 2 });
}

/** Read back the current `themePack` provenance entry, or `null` if absent
 *  / the file doesn't exist / the key is malformed. */
export async function readThemePackProvenance(cwd: string): Promise<ThemePackProvenance | null> {
  const existing = await readExisting(cwd);
  const themePack = existing.themePack;
  if (themePack && typeof themePack === "object") {
    return themePack as ThemePackProvenance;
  }
  return null;
}
