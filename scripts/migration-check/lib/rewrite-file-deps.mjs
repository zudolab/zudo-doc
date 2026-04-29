/**
 * rewrite-file-deps.mjs — pure function for rewriting file: deps in package.json.
 *
 * When a git worktree is created at worktrees/<name>/, relative "file:../<x>/..."
 * paths in package.json resolve from inside the worktrees/ subdirectory rather
 * than from the original repo root, landing on the wrong absolute path.
 *
 * This module rewrites any "file:../" dep to an absolute path resolved from
 * the original repo root so pnpm install inside the worktree works correctly.
 * The rewrite is purely transient (caller writes back to a throwaway worktree,
 * never committed).
 */

import { resolve } from "node:path";

/**
 * @typedef {Object} RewriteResult
 * @property {boolean} rewritten - true if at least one dep was rewritten
 * @property {string[]} log - human-readable log of each rewrite performed
 * @property {object} pkgJson - the (possibly modified) copy of the package.json
 */

/**
 * Rewrite all "file:../" (parent-traversal) deps in a package.json object to
 * absolute "file:/abs/path" specs resolved from `repoRoot`.
 *
 * "file:./" deps are intentionally left untouched — they reference paths
 * within the same repo checkout (e.g. vendor/) and resolve correctly as-is.
 *
 * Does NOT mutate the input object.
 *
 * @param {object} pkgJson - parsed package.json as a plain JS object
 * @param {string} repoRoot - absolute path to the original repo root
 * @returns {RewriteResult}
 */
export function rewriteFileDeps(pkgJson, repoRoot) {
  const log = [];
  let rewritten = false;
  const result = structuredClone(pkgJson);

  // All standard dep fields that may contain file: specs
  const depFields = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ];

  for (const field of depFields) {
    const deps = result[field];
    if (!deps || typeof deps !== "object") continue;

    for (const [name, spec] of Object.entries(deps)) {
      if (typeof spec !== "string") continue;
      // Only rewrite file: deps with parent-traversal (file:../).
      // "file:./" deps are same-repo and resolve correctly from the worktree.
      if (!spec.startsWith("file:../")) continue;

      const relativePath = spec.slice("file:".length);
      const absolutePath = resolve(repoRoot, relativePath);
      const newSpec = `file:${absolutePath}`;

      deps[name] = newSpec;
      log.push(`${field}.${name}: ${spec} → ${newSpec}`);
      rewritten = true;
    }
  }

  return { rewritten, log, pkgJson: result };
}
