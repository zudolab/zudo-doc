// plugins/internal/theme-packs/copy — postBuild copy step: materialise each
// ENABLED pack's files into `${outDir}/theme-packs/<slug>/…` plus the
// aggregated `theme-packs/index.json` registry manifest (ADR
// docs/adr/theme-packs.md, Decision 2). Runtime-agnostic (same shape as
// search-index's `emitSearchIndex`) so it can be called from a real zfb
// postBuild hook or a unit test against a throwaway temp dir.

import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ThemePackRegistry } from "../../../theme-packs-registry/index.js";
import { hasCssBearingPack } from "./resolve.js";
import type { ThemePacksIndexManifest } from "./types.js";

export interface CopyThemePacksParams {
  /** The shipped `theme-packs/` directory — `dist/theme-packs/` once
   *  compiled (workspace-built and published shapes alike), `src/theme-packs/`
   *  when vitest runs the source directly. Same resolution rule as
   *  `routes.ts`'s `themePacksDir`. */
  packsDir: string | URL;
  /** The ENABLED, ORDERED registry (already resolved via `resolveEnabledPacks`). */
  enabled: ThemePackRegistry;
  /** The build's output directory (`ctx.outDir`). */
  outDir: string;
}

export interface CopyThemePacksResult {
  /** `false` when the ADR's no-op rule applies (no CSS-bearing pack enabled)
   *  — nothing was written. */
  copied: boolean;
  /** Absolute path of `${outDir}/theme-packs/`, when `copied` is `true`. */
  destDir?: string;
  /** Absolute path of the written `index.json`, when `copied` is `true`. */
  indexJsonPath?: string;
}

/**
 * Copy every enabled pack's `meta.json` (+ `pack.css` when it ships one, +
 * `fonts/*` when present) into `${outDir}/theme-packs/<slug>/…`, and write
 * the aggregated `${outDir}/theme-packs/index.json` manifest
 * (`{ schemaVersion: 1, packs: ThemePackMeta[] }`) in resolved order.
 *
 * No-ops (writes nothing, returns `{ copied: false }`) when the enabled set
 * has no CSS-bearing pack — i.e. only `"default"` is enabled — per the ADR's
 * dead-weight-avoidance rule.
 */
export function copyEnabledThemePacks({
  packsDir,
  enabled,
  outDir,
}: CopyThemePacksParams): CopyThemePacksResult {
  if (!hasCssBearingPack(enabled)) {
    return { copied: false };
  }

  const srcRoot = packsDir instanceof URL ? fileURLToPath(packsDir) : packsDir;
  const destRoot = join(outDir, "theme-packs");
  mkdirSync(destRoot, { recursive: true });

  for (const entry of enabled) {
    const srcDir = join(srcRoot, entry.slug);
    const destDir = join(destRoot, entry.slug);
    mkdirSync(destDir, { recursive: true });
    copyFileSync(join(srcDir, "meta.json"), join(destDir, "meta.json"));

    if (entry.hasStylesheet) {
      copyFileSync(join(srcDir, "pack.css"), join(destDir, "pack.css"));
    }

    const fontsSrcDir = join(srcDir, "fonts");
    if (existsSync(fontsSrcDir)) {
      const fontsDestDir = join(destDir, "fonts");
      mkdirSync(fontsDestDir, { recursive: true });
      for (const file of readdirSync(fontsSrcDir, { withFileTypes: true })) {
        if (file.isFile()) {
          copyFileSync(join(fontsSrcDir, file.name), join(fontsDestDir, file.name));
        }
      }
    }
  }

  const manifest: ThemePacksIndexManifest = {
    schemaVersion: 1,
    packs: enabled.map((entry) => entry.meta),
  };
  const indexJsonPath = join(destRoot, "index.json");
  writeFileSync(indexJsonPath, JSON.stringify(manifest));

  return { copied: true, destDir: destRoot, indexJsonPath };
}
