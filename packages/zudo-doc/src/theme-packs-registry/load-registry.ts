// theme-packs-registry/load-registry — `loadThemePackRegistry`, the node-side
// fs scan of `src/theme-packs/<slug>/` (ADR `docs/adr/theme-packs.md`,
// Decision 2 "Registry threading to SSR/islands"). Aggregates the bundled
// pack registry from the per-slug directories ONLY — there is no hand-edited
// shared index file, so parallel packs merge conflict-free.
//
// Uses `node:fs`/`node:path`/`node:url` — this module is loaded by the routes
// plugin (`src/plugins/routes.ts`), which runs under the zfb plugin host
// (Node.js), NEVER by `config.ts`/`preset.ts`'s node-free config eval graph.
// Do not import this module from either of those.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import type { ThemePackMeta } from "./meta-schema.js";
import { validateThemePack } from "./validator.js";

/** One entry in the aggregated, canonically-ordered bundled registry. */
export interface ThemePackRegistryEntry {
  /** The pack's directory name (equals `meta.slug`). */
  slug: string;
  /** The pack's schema-validated `meta.json`. */
  meta: ThemePackMeta;
  /** Whether this pack ships a `pack.css` (always `false` for `"default"`). */
  hasStylesheet: boolean;
}

/** The full bundled registry, or a subset of it (after `resolveEnabledPacks`)
 *  — an ordered array; order carries meaning (canonical / switcher order). */
export type ThemePackRegistry = ThemePackRegistryEntry[];

function readFontFiles(fontsDir: string): string[] {
  if (!existsSync(fontsDir)) return [];
  return readdirSync(fontsDir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);
}

/** Sum of `pack.css` + every non-license file under `fonts/` — the payload
 *  the browser actually fetches (Decision 6.7's soft ~250 KB budget). */
function computeTotalPayloadBytes(packDir: string, cssContent: string | null): number {
  let total = cssContent ? Buffer.byteLength(cssContent, "utf8") : 0;
  const fontsDir = join(packDir, "fonts");
  if (existsSync(fontsDir)) {
    for (const entry of readdirSync(fontsDir, { withFileTypes: true })) {
      if (!entry.isFile() || entry.name.toUpperCase() === "OFL.TXT") continue;
      total += statSync(join(fontsDir, entry.name)).size;
    }
  }
  return total;
}

/**
 * Scan `dir` (a `theme-packs/` directory — `src/theme-packs/` in the
 * workspace, `dist/theme-packs/` once shipped) for per-slug pack directories,
 * validate each with {@link validateThemePack}, and return them in canonical
 * (alphabetical-by-slug) order. Throws — naming the offending pack and the
 * failed rule(s) — on any pack that fails validation; this is the package's
 * OWN bundled packs, so a failure here means the package itself shipped a
 * broken pack, not a consumer misconfiguration.
 */
export function loadThemePackRegistry(dir: string | URL): ThemePackRegistry {
  const dirPath = dir instanceof URL ? fileURLToPath(dir) : dir;
  if (!existsSync(dirPath)) {
    throw new Error(
      `zudo-doc: theme-packs directory not found at "${dirPath}" — the @takazudo/zudo-doc package installation may be incomplete or corrupted.`,
    );
  }

  const slugs = readdirSync(dirPath, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const entries: ThemePackRegistryEntry[] = [];
  for (const slug of slugs) {
    const packDir = join(dirPath, slug);
    const metaPath = join(packDir, "meta.json");
    if (!existsSync(metaPath)) {
      throw new Error(`zudo-doc: theme pack "${slug}" is missing meta.json at "${metaPath}".`);
    }

    let metaRaw: unknown;
    try {
      metaRaw = JSON.parse(readFileSync(metaPath, "utf8"));
    } catch (err) {
      throw new Error(
        `zudo-doc: theme pack "${slug}" has invalid JSON in meta.json: ${(err as Error).message}`,
      );
    }

    const cssPath = join(packDir, "pack.css");
    const cssContent = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : null;
    const fontFiles = readFontFiles(join(packDir, "fonts"));
    const totalPayloadBytes = computeTotalPayloadBytes(packDir, cssContent);

    const result = validateThemePack({ dirName: slug, metaRaw, cssContent, fontFiles, totalPayloadBytes });

    for (const issue of result.issues) {
      if (issue.severity === "warning") {
        console.warn(`[zudo-doc] theme pack "${slug}": ${issue.message}`);
      }
    }
    if (!result.valid || !result.meta) {
      const errorLines = result.issues
        .filter((i) => i.severity === "error")
        .map((i) => `  - [${i.rule}] ${i.message}`)
        .join("\n");
      throw new Error(`zudo-doc: theme pack "${slug}" failed validation:\n${errorLines}`);
    }

    entries.push({ slug, meta: result.meta, hasStylesheet: cssContent !== null });
  }

  return entries;
}
