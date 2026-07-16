// Package-internal Claude resources generator used by
// `@takazudo/zudo-doc/plugins/claude-resources` and the repository dev watcher.

import path from "node:path";
import {
  generateClaudeResourcesDocs,
  type ClaudeResourcesConfig,
} from "./generate.js";

/** Options accepted by the plugin's generator runner. */
export interface ClaudeResourcesPluginOptions {
  /**
   * Path to the project's `.claude/` directory holding `commands/`,
   * `skills/`, `agents/`. Resolved against `projectRoot` when relative.
   */
  claudeDir: string;
  /**
   * Anchor for resolving the relative `claudeDir`, `docsDir`, and `scanRoot`
   * paths, and the default value of `scanRoot`. Defaults to `process.cwd()`.
   *
   * Note: this does NOT itself decide where `CLAUDE.md` discovery walks — that
   * is `scanRoot` (which defaults to this). Set `scanRoot` to widen discovery
   * (e.g. a subdirectory doc site scanning its repo root) without moving the
   * output base, which stays anchored here.
   */
  projectRoot?: string;
  /**
   * Root for `CLAUDE.md` discovery and the base for the generated pages'
   * relative-path titles/slugs. Defaults to `projectRoot`. Resolved against
   * `projectRoot` when relative (absolute allowed).
   *
   * Scope: governs `CLAUDE.md` discovery ONLY. Commands, skills, and agents
   * always come from `claudeDir` and are unaffected by `scanRoot`. Decoupling
   * this from `projectRoot` lets a doc site in a repo subdirectory scan
   * repo-wide `CLAUDE.md` files while still writing generated pages into its
   * own content collection (see #2558).
   */
  scanRoot?: string;
  /**
   * Output directory for generated MDX pages, resolved against
   * `projectRoot` when relative. Defaults to `src/content/docs` to
   * match the existing Astro integration's behaviour.
   */
  docsDir?: string;
}

/**
 * Imperative pre-step runner. Resolves relative paths against
 * `projectRoot` (defaults to `process.cwd()`) and invokes the underlying
 * generator. Output is byte-equivalent to the Astro integration when
 * given the same inputs.
 */
export function runClaudeResourcesPreStep(
  options: ClaudeResourcesPluginOptions,
): ReturnType<typeof generateClaudeResourcesDocs> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const claudeDir = path.isAbsolute(options.claudeDir)
    ? options.claudeDir
    : path.resolve(projectRoot, options.claudeDir);
  // scanRoot decouples CLAUDE.md discovery (and the generated pages' relPath
  // base) from the output base. Defaults to projectRoot, so an unset scanRoot
  // reproduces the pre-#2558 behaviour byte-for-byte.
  const scanRoot =
    options.scanRoot === undefined
      ? projectRoot
      : path.isAbsolute(options.scanRoot)
        ? options.scanRoot
        : path.resolve(projectRoot, options.scanRoot);
  const docsDirInput = options.docsDir ?? "src/content/docs";
  const docsDir = path.isAbsolute(docsDirInput)
    ? docsDirInput
    : path.resolve(projectRoot, docsDirInput);

  // The generator's `projectRoot` param IS the CLAUDE.md scan root + relPath
  // base (it never touches output — output is always `docsDir`), so pass the
  // resolved scanRoot there while docsDir stays anchored to the real projectRoot.
  return generateClaudeResourcesDocs({ claudeDir, projectRoot: scanRoot, docsDir });
}

export {
  generateClaudeResourcesDocs,
  type ClaudeResourcesConfig,
};
