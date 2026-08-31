// Package-internal Codex resources generator used by the public plugin shim
// and repository dev watcher added by downstream integration work.

import path from "node:path";
import {
  generateCodexResourcesDocs,
  type CodexResourcesConfig,
} from "./generate.js";
import {
  resolveLocaleDirs,
  type ResourceLocaleConfig,
  type ResourceTranslations,
} from "../resource-docs-shared/index.js";

export interface CodexResourcesPluginOptions {
  /**
   * Path to the project's `.codex/` directory. Resolved against
   * `projectRoot` when relative.
   */
  codexDir: string;
  /**
   * Anchor for `codexDir`, `docsDir`, and relative `scanRoot` paths, and the
   * default value of `scanRoot`. Defaults to `process.cwd()`.
   */
  projectRoot?: string;
  /**
   * Repo-wide discovery root, defaulting to `projectRoot`. It governs both the
   * `AGENTS.md` / `AGENTS.override.md` walk (including relative titles/slugs)
   * and the repo-level `.agents/skills/` root. `codexDir` and `docsDir` remain
   * anchored to `projectRoot`.
   */
  scanRoot?: string;
  /** Output directory, anchored to `projectRoot` when relative. */
  docsDir?: string;
  /** Additional locale content roots, keyed by locale code. */
  locales?: Record<string, ResourceLocaleConfig>;
  /** Default locale code (the unprefixed docs directory). */
  defaultLocale?: string;
  /** UI-string translation table used by localized generated indexes. */
  translations?: ResourceTranslations;
}

export function runCodexResourcesPreStep(
  options: CodexResourcesPluginOptions,
): ReturnType<typeof generateCodexResourcesDocs> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const codexDir = path.isAbsolute(options.codexDir)
    ? options.codexDir
    : path.resolve(projectRoot, options.codexDir);
  const scanRoot = options.scanRoot === undefined
    ? projectRoot
    : path.isAbsolute(options.scanRoot)
      ? options.scanRoot
      : path.resolve(projectRoot, options.scanRoot);
  const docsDirInput = options.docsDir ?? "src/content/docs";
  const docsDir = path.isAbsolute(docsDirInput)
    ? docsDirInput
    : path.resolve(projectRoot, docsDirInput);
  const locales = resolveLocaleDirs({
    projectRoot,
    docsDir,
    locales: options.locales,
  });

  return generateCodexResourcesDocs({
    codexDir,
    projectRoot,
    scanRoot,
    docsDir,
    locales,
    defaultLocale: options.defaultLocale,
    translations: options.translations,
  });
}

export { generateCodexResourcesDocs, type CodexResourcesConfig };
