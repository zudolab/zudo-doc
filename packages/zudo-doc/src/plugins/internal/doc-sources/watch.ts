// Development watcher for document sources (`zudo-doc sources watch`).
//
// zfb has no lifecycle hook for regenerating content files from external
// inputs during `zfb dev` (`watchFiles` only refreshes virtual modules), so
// this package-owned entry runs beside `zfb dev`. It reads the state the
// build plugin recorded — the same plugin options and environment — and uses
// the same normalization and discovery plan as baking:
//
// - the watch set is exactly the directories discovery visited, plus parent
//   anchors for every mapping root (so missing roots appearing, roots being
//   removed, new directories and followed symlink targets are all covered);
// - output roots and the build-local state directory are excluded from
//   discovery and their events are ignored, so generated writes never
//   re-trigger a run;
// - runs are debounced and serialized; changes arriving during a run queue
//   exactly one follow-up run; a failed run keeps the previous valid output.

import fs from "node:fs";
import path from "node:path";
import { discover, isInside, rootAnchors, type WatchTarget } from "./discover.js";
import type { DocSourcesRunOptions } from "./model.js";
import {
  readWatchState,
  resolveRunOptions,
  runDocSources,
  STATE_DIR,
  summarize,
  WATCH_STATE_FILE,
  type DocSourcesRunResult,
} from "./run.js";

export interface WatchLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** Debounced, serialized task runner with a single queued follow-up. */
export function createSerialScheduler(
  task: () => Promise<void> | void,
  debounceMs: number,
): { trigger(): void; close(): Promise<void>; idle(): Promise<void> } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let queued = false;
  let closed = false;

  const start = () => {
    timer = undefined;
    if (closed) return;
    if (running !== undefined) {
      queued = true;
      return;
    }
    running = (async () => {
      try {
        await task();
      } finally {
        running = undefined;
        if (queued && !closed) {
          queued = false;
          trigger();
        }
      }
    })();
  };
  const trigger = () => {
    if (closed) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(start, debounceMs);
  };
  const idle = async () => {
    while (timer !== undefined || running !== undefined) {
      if (running !== undefined) await running;
      else await new Promise((resolve) => setTimeout(resolve, debounceMs));
    }
  };
  return {
    trigger,
    idle,
    async close() {
      closed = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (running !== undefined) await running;
    },
  };
}

export interface DocSourcesWatcherOptions {
  projectRoot: string;
  homeDir: () => string;
  logger: WatchLogger;
  debounceMs?: number;
  /** Poll interval for the recorded state file (config changes restart `zfb dev`). */
  statePollMs?: number;
  /** Injected for tests. */
  watchDir?: (dir: string, listener: (filename: string | null) => void) => { close(): void };
}

export interface DocSourcesWatcher {
  /** Directories currently watched. */
  watchedDirs(): string[];
  /** Resolves when no run is pending. */
  idle(): Promise<void>;
  /** Completed regeneration runs. */
  runs(): number;
  close(): Promise<void>;
}

function defaultWatchDir(dir: string, listener: (filename: string | null) => void) {
  const watcher = fs.watch(dir, { persistent: true }, (_event, filename) => {
    listener(filename === null ? null : String(filename));
  });
  watcher.on("error", () => listener(null));
  return watcher;
}

export function startDocSourcesWatcher(options: DocSourcesWatcherOptions): DocSourcesWatcher {
  const { projectRoot, logger } = options;
  const debounceMs = options.debounceMs ?? 150;
  const watchDir = options.watchDir ?? defaultWatchDir;
  const stateFile = path.join(projectRoot, STATE_DIR, WATCH_STATE_FILE);
  const active = new Map<string, { close(): void; names: Set<string | undefined> }>();
  let runOptions: DocSourcesRunOptions | null = null;
  let runCount = 0;
  let closed = false;

  const relevant = (dir: string, filename: string | null, names: Set<string | undefined>) => {
    if (runOptions === null) return false;
    if (filename !== null) {
      if (!names.has(undefined) && !names.has(filename)) return false;
      const full = path.join(dir, filename);
      if (runOptions.excludedRoots.some((root) => isInside(full, root))) return false;
    }
    return true;
  };

  const syncWatchers = (targets: WatchTarget[]) => {
    const wanted = new Map<string, Set<string | undefined>>();
    for (const target of targets) {
      const names = wanted.get(target.dir) ?? new Set<string | undefined>();
      names.add(target.name);
      wanted.set(target.dir, names);
    }
    for (const [dir, entry] of active) {
      if (!wanted.has(dir)) {
        entry.close();
        active.delete(dir);
      }
    }
    for (const [dir, names] of wanted) {
      const existing = active.get(dir);
      if (existing !== undefined) {
        existing.names = names;
        continue;
      }
      try {
        const entry = { names, close: () => {} };
        const handle = watchDir(dir, (filename) => {
          if (relevant(dir, filename, entry.names)) scheduler.trigger();
        });
        entry.close = () => handle.close();
        active.set(dir, entry);
      } catch (error) {
        logger.warn(`doc-sources watch: cannot watch "${dir}": ${String(error)}`);
      }
    }
  };

  const loadOptions = (): boolean => {
    const state = readWatchState(projectRoot);
    if (state === null) {
      runOptions = null;
      syncWatchers([]);
      return false;
    }
    runOptions = resolveRunOptions(state.plugin, {
      projectRoot: state.projectRoot,
      publicDir: state.publicDir,
      outDir: state.outDir,
      homeDir: options.homeDir,
    });
    if (runOptions.sources.length === 0) {
      syncWatchers([]);
      return false;
    }
    return true;
  };

  /** Watch set from discovery alone; the build plugin already generated output. */
  const prime = () => {
    try {
      if (!loadOptions() || runOptions === null) {
        logger.info("doc-sources watch: no document sources configured; idle");
        return;
      }
      const discovery = discover(runOptions.sources, runOptions.excludedRoots);
      syncWatchers([...discovery.watch, ...rootAnchors(runOptions.sources)]);
      logger.info(`doc-sources watch: watching ${active.size} director${active.size === 1 ? "y" : "ies"}`);
    } catch (error) {
      logger.error(`doc-sources watch: ${error instanceof Error ? error.message : String(error)}`);
      if (runOptions !== null) syncWatchers(rootAnchors(runOptions.sources));
    }
  };

  const scheduler = createSerialScheduler(() => {
    if (closed || runOptions === null) return;
    let result: DocSourcesRunResult;
    try {
      result = runDocSources(runOptions);
    } catch (error) {
      // Validation/rendering failures leave the previous output untouched.
      logger.error(`doc-sources watch: ${error instanceof Error ? error.message : String(error)}`);
      syncWatchers(rootAnchors(runOptions.sources).concat([...active.keys()].map((dir) => ({ dir }))));
      return;
    }
    runCount++;
    syncWatchers([...result.watch, ...rootAnchors(runOptions.sources)]);
    for (const diagnostic of result.diagnostics) {
      if (diagnostic.level === "warn") logger.warn(diagnostic.message);
    }
    if (result.written.length > 0 || result.removed.length > 0) logger.info(summarize(result));
  }, debounceMs);

  const onStateChange = () => {
    if (closed) return;
    prime();
  };
  fs.watchFile(stateFile, { interval: options.statePollMs ?? 1000, persistent: true }, onStateChange);
  prime();

  return {
    watchedDirs: () => [...active.keys()].sort(),
    idle: () => scheduler.idle(),
    runs: () => runCount,
    async close() {
      closed = true;
      fs.unwatchFile(stateFile, onStateChange);
      await scheduler.close();
      for (const entry of active.values()) entry.close();
      active.clear();
    },
  };
}
