// The doc-sources pipeline:
//   normalize + expand presets → discover → plan → render → reconcile.
// Used unchanged by the build plugin and the development watcher.

import fs from "node:fs";
import path from "node:path";
import { discover, type WatchTarget } from "./discover.js";
import type { DocSourcesDiagnostic, DocSourcesRunOptions } from "./model.js";
import { normalizeDocSources } from "./normalize.js";
import { ASSET_DIR, buildPlan } from "./plan.js";
import { reconcile } from "./reconcile.js";

/** Plugin options produced by `zudoDocPreset()`: data only, no absolute paths required. */
export interface DocSourcesPluginOptions {
  sources?: unknown;
  docsDir?: string;
  /** Site base path; prefixes copied-asset URLs. */
  base?: string;
  locales?: Record<string, { dir: string }>;
  defaultLocale?: string;
  defaultLocaleOnlyPrefixes?: string[];
  translations?: Record<string, Record<string, string>>;
  /** Snapshot content directories (versions); excluded from every scan. */
  excludeDirs?: string[];
}

export interface DocSourcesEnvironment {
  projectRoot: string;
  /** Absolute or project-relative public directory. Defaults to `public`. */
  publicDir?: string;
  /** Absolute or project-relative build output directory. */
  outDir?: string;
  /** Injected home-directory resolver for `~/` paths. */
  homeDir: () => string;
}

export const STATE_DIR = path.join(".zfb", "doc-sources");
export const WATCH_STATE_FILE = "watch-state.json";

function abs(projectRoot: string, p: string): string {
  return path.isAbsolute(p) ? path.normalize(p) : path.resolve(projectRoot, p);
}

export function resolveRunOptions(
  plugin: DocSourcesPluginOptions,
  env: DocSourcesEnvironment,
): DocSourcesRunOptions {
  const projectRoot = path.resolve(env.projectRoot);
  const docsDir = abs(projectRoot, plugin.docsDir ?? "src/content/docs");
  const locales: Record<string, string> = {};
  for (const [locale, config] of Object.entries(plugin.locales ?? {})) {
    if (config === null || typeof config !== "object" || typeof config.dir !== "string") {
      throw new TypeError(`docSources: locale "${locale}" must configure { dir: string }`);
    }
    locales[locale] = abs(projectRoot, config.dir);
  }
  const publicDir = abs(projectRoot, env.publicDir ?? "public");
  const stateDir = path.join(projectRoot, STATE_DIR);
  return {
    projectRoot,
    sources: normalizeDocSources(plugin.sources, { projectRoot, homeDir: env.homeDir }),
    docsDir,
    base: plugin.base ?? "/",
    locales,
    defaultLocale: plugin.defaultLocale ?? "en",
    defaultLocaleOnlyPrefixes: plugin.defaultLocaleOnlyPrefixes ?? [],
    translations: plugin.translations ?? {},
    publicDir,
    excludedRoots: [
      docsDir,
      ...Object.values(locales),
      ...(plugin.excludeDirs ?? []).map((dir) => abs(projectRoot, dir)),
      path.join(publicDir, ASSET_DIR),
      abs(projectRoot, env.outDir ?? "dist"),
      path.join(projectRoot, ".zfb"),
      path.join(projectRoot, ".zfb-build"),
    ],
    stateDir,
  };
}

export interface DocSourcesRunResult {
  sources: number;
  documents: number;
  assets: number;
  indexes: number;
  written: string[];
  removed: string[];
  diagnostics: DocSourcesDiagnostic[];
  /** Directories the development watcher should observe. */
  watch: WatchTarget[];
}

export function runDocSources(options: DocSourcesRunOptions): DocSourcesRunResult {
  // An empty configuration scans nothing; reconciliation still runs so a
  // removed or disabled source leaves no stale output behind.
  const discovery = options.sources.length === 0
    ? { files: [], skillTrees: new Map(), watch: [], diagnostics: [] }
    : discover(options.sources, options.excludedRoots);
  const plan = buildPlan(options, discovery);
  const result = reconcile({
    projectRoot: options.projectRoot,
    stateDir: options.stateDir,
    outputs: plan.outputs,
    outputRoots: plan.outputRoots,
  });
  try {
    // The shared asset directory is engine-owned; drop it once it is empty.
    fs.rmdirSync(path.join(options.publicDir, ASSET_DIR));
  } catch {
    // absent or still holding assets
  }
  return {
    sources: options.sources.length,
    ...plan.counts,
    written: result.written,
    removed: result.removed,
    diagnostics: [...plan.diagnostics, ...result.diagnostics],
    watch: discovery.watch,
  };
}

/** Build-local state the watcher reads: the same plugin options and environment. */
export interface WatchState {
  plugin: DocSourcesPluginOptions;
  projectRoot: string;
  publicDir: string;
  outDir: string;
}

/**
 * Record the resolved inputs for `zudo-doc sources watch`. An empty
 * configuration removes the state so the watcher stays idle.
 */
export function writeWatchState(state: WatchState, hasSources: boolean): void {
  const file = path.join(state.projectRoot, STATE_DIR, WATCH_STATE_FILE);
  if (!hasSources) {
    fs.rmSync(file, { force: true });
    try {
      fs.rmdirSync(path.dirname(file));
    } catch {
      // keep a non-empty state directory
    }
    return;
  }
  const serialized = `${JSON.stringify(state, null, 2)}\n`;
  let previous = "";
  try {
    previous = fs.readFileSync(file, "utf8");
  } catch {
    previous = "";
  }
  if (previous === serialized) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, serialized);
  fs.renameSync(`${file}.tmp`, file);
}

export function readWatchState(projectRoot: string): WatchState | null {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(projectRoot, STATE_DIR, WATCH_STATE_FILE), "utf8"),
    ) as WatchState;
  } catch {
    return null;
  }
}

export function summarize(result: DocSourcesRunResult): string {
  return `doc-sources: ${result.sources} source(s), ${result.documents} document(s), ${result.assets} asset(s), ${result.indexes} index page(s); ${result.written.length} written, ${result.removed.length} removed`;
}
