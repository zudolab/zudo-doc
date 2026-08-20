import fs from "node:fs";
import path from "node:path";

/**
 * Directory names skipped by basename at ANY depth of the walk.
 *
 * These are build output, vendored trees, and tooling scratch dirs that can
 * belong to *any* project under the scan root, not just the one at its top
 * level. Anchoring them to the scan root (the pre-#3200 behaviour) meant a
 * doc site in a repo subdirectory with `scanRoot` widened to the repo root
 * still walked its own `dist/`, `public/`, `out/`, and `test-results/` on
 * every build — the exact nested layout `scanRoot` exists for.
 *
 * `.git` needs no entry here: dot-prefixed entries are already skipped at any
 * depth by the loop below.
 */
export const EXCLUDED_DIR_NAMES = new Set([
  "node_modules",
  "worktrees",
  "dist",
  "out",
  "public",
  "__inbox",
  "test-results",
]);

/**
 * Find named regular files without following symlinked directories.
 * Excludes are path-segment-boundary-aware, and dot-prefixed entries are
 * skipped at every depth.
 */
export function findNamedFiles(
  dir: string,
  excludeDirs: string[],
  fileNames: string[],
): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  // Strip trailing separators (path.join preserves one on e.g. "docs/") so the
  // boundary compare below stays exact for such entries too.
  const excludes = excludeDirs.map((d) =>
    d.endsWith(path.sep) ? d.slice(0, -path.sep.length) : d,
  );
  const names = new Set(fileNames);

  for (const item of fs.readdirSync(dir)) {
    if (EXCLUDED_DIR_NAMES.has(item)) continue;
    if (item.startsWith(".")) continue;
    const itemPath = path.join(dir, item);
    // Path-segment-boundary-aware: a raw startsWith(d) would also match a
    // sibling like "dist-extra" against an excluded "dist" (#2561).
    if (excludes.some((d) => itemPath === d || itemPath.startsWith(d + path.sep))) continue;

    // lstat (not stat) so symlinks aren't followed — a symlinked dir can point
    // back into the project (e.g. e2e fixtures linking to packages/) or out to
    // a slow mount (e.g. /mnt/c on WSL) and either turns the walk into a
    // multi-minute hang.
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(itemPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results.push(...findNamedFiles(itemPath, excludes, fileNames));
    } else if (stat.isFile() && names.has(item)) {
      results.push(itemPath);
    }
  }
  return results;
}
