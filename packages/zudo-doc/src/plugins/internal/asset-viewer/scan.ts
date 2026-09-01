import { readdirSync, realpathSync, statSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { matchExclude, normalizeAssetPath } from "../../../asset-path/index.js";

function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== "..");
}

function finishScan(paths: string[]): string[] {
  paths.sort((a, b) => a.localeCompare(b, "en"));
  const folded = new Map<string, string>();
  for (const path of paths) {
    const key = path.toLocaleLowerCase("en-US");
    const existing = folded.get(key);
    if (existing !== undefined) {
      throw new Error(`[asset-viewer] case-insensitive or Unicode-normalized URL collision: ${existing} and ${path}`);
    }
    folded.set(key, path);
    if (path === "client" || path.startsWith("client/")) {
      console.warn(`[asset-viewer] reserved client/ asset path: ${path}`);
    }
  }
  return paths;
}

/**
 * Recursively enumerate safe, public assets in deterministic path order.
 *
 * This synchronous implementation is the canonical walk. Search and llms.txt
 * build/dev consumers are synchronous, while the routes setup hook already
 * exposes an async `scanAssets()` contract. Keeping one walk here gives both
 * boundaries identical symlink, exclusion, and collision behavior.
 */
export function scanAssetsSync(
  projectRoot: string,
  dir: string,
  exclude: readonly string[] = [],
): string[] {
  const publicRoot = resolve(projectRoot, "public");
  const assetRoot = resolve(publicRoot, dir);
  if (!isWithin(publicRoot, assetRoot)) {
    throw new Error(`[asset-viewer] asset directory escapes public/: ${dir}`);
  }
  let canonicalRoot: string;
  try {
    const canonicalPublicRoot = realpathSync(publicRoot);
    canonicalRoot = realpathSync(assetRoot);
    if (!isWithin(canonicalPublicRoot, canonicalRoot)) {
      throw new Error(`[asset-viewer] asset directory symlink escapes public/: ${dir}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const paths: string[] = [];
  function walk(
    absDir: string,
    relDir: string,
    canonicalAncestors: ReadonlySet<string>,
  ): void {
    const canonicalDir = realpathSync(absDir);
    if (!isWithin(canonicalRoot, canonicalDir)) {
      throw new Error(`[asset-viewer] symlink escapes public/${dir}: ${relDir || basename(absDir)}`);
    }
    // An ancestor link is a cycle. The same directory reached through a
    // separate non-ancestor alias is valid and represents a distinct URL tree.
    if (canonicalAncestors.has(canonicalDir)) return;
    const nextAncestors = new Set(canonicalAncestors).add(canonicalDir);

    const entries = readdirSync(absDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.name.endsWith(".meta.json")) continue;
      const absPath = resolve(absDir, entry.name);
      const canonical = realpathSync(absPath);
      if (!isWithin(canonicalRoot, canonical)) {
        throw new Error(`[asset-viewer] symlink escapes public/${dir}: ${relPath}`);
      }
      if (entry.isDirectory()) {
        walk(absPath, relPath, nextAncestors);
      } else if (entry.isSymbolicLink()) {
        const target = statSync(canonical);
        if (target.isDirectory()) walk(absPath, relPath, nextAncestors);
        else {
          const path = normalizeAssetPath(relPath);
          if (!matchExclude(path, exclude)) paths.push(path);
        }
      } else if (entry.isFile()) {
        const path = normalizeAssetPath(relPath);
        if (!matchExclude(path, exclude)) paths.push(path);
      }
    }
  }
  walk(assetRoot, "", new Set());

  return finishScan(paths);
}

/**
 * Async-compatible asset scan used by the routes setup hook.
 *
 * The route plugin's public lifecycle contract is async, but its scan itself
 * is only filesystem enumeration. Delegating to the canonical sync walk keeps
 * it behaviorally identical to `scanAssetsSync()` without introducing a
 * second implementation (or a promise that synchronous middleware cannot
 * consume).
 */
export async function scanAssets(
  projectRoot: string,
  dir: string,
  exclude: readonly string[] = [],
): Promise<string[]> {
  return scanAssetsSync(projectRoot, dir, exclude);
}
