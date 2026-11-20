// Input discovery: the second pipeline stage. One filesystem policy applies to
// every source, bundled or custom:
//
// - mapping roots are the only places the walk starts; a configured root may
//   itself be a symlink;
// - a symlink below a root is followed only when its real target lies inside
//   one of the configured roots (every mapping root and preset root), so
//   shared trees such as linked skills must be configured explicitly;
// - every output root (content directories, the managed asset directory,
//   build/state directories) is excluded, including when it is reached
//   through an alias;
// - directories already on the current walk path are skipped (cycles).
//
// The visited directory list doubles as the development watcher's input set.

import fs from "node:fs";
import path from "node:path";
import { excludesDirectory, matchesAny } from "./glob.js";
import type { DocSourcesDiagnostic, NormalizedMapping, NormalizedSource } from "./model.js";

export interface DiscoveredFile {
  mapping: NormalizedMapping;
  /** POSIX path relative to the mapping root (logical, through symlinks). */
  rel: string;
  /** Logical absolute path. */
  abs: string;
  /** Real absolute path. */
  real: string;
  kind: "document" | "skill-page" | "asset";
  /** For skill pages: the skill directory (relative to the mapping root). */
  skillDir?: string;
}

export interface WatchTarget {
  /** Absolute directory to watch (non-recursively). */
  dir: string;
  /** When set, only events for this direct child name matter. */
  name?: string;
}

export interface DiscoveryResult {
  files: DiscoveredFile[];
  /** Every regular file seen below each skill directory, keyed by real skill dir. */
  skillTrees: Map<string, string[]>;
  watch: WatchTarget[];
  diagnostics: DocSourcesDiagnostic[];
}

export class DocSourcesDiscoveryError extends Error {
  constructor(message: string) {
    super(`docSources: ${message}`);
    this.name = "DocSourcesDiscoveryError";
  }
}

function realOrNull(p: string): string | null {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return null;
  }
}

export function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function nearestExistingAncestor(p: string): { dir: string; name: string } | null {
  let current = p;
  for (;;) {
    const parent = path.dirname(current);
    if (parent === current) return null;
    if (realOrNull(parent) !== null) return { dir: parent, name: path.basename(current) };
    current = parent;
  }
}

/** Parent-directory anchors that notice each mapping root appearing or disappearing. */
export function rootAnchors(sources: NormalizedSource[]): WatchTarget[] {
  const targets: WatchTarget[] = [];
  for (const source of sources) {
    for (const root of [...source.requiredRoots, ...source.mappings.map((m) => m.root)]) {
      const anchor = nearestExistingAncestor(root);
      if (anchor !== null) targets.push(anchor);
    }
  }
  return targets;
}

export function discover(
  sources: NormalizedSource[],
  excludedRoots: string[],
): DiscoveryResult {
  const files: DiscoveredFile[] = [];
  const skillTrees = new Map<string, string[]>();
  const diagnostics: DocSourcesDiagnostic[] = [];
  const watchDirs = new Map<string, WatchTarget>();
  const addWatch = (target: WatchTarget) => {
    const key = `${target.dir}\u0000${target.name ?? ""}`;
    if (!watchDirs.has(key)) watchDirs.set(key, target);
  };

  const excluded = new Set<string>();
  for (const root of excludedRoots) {
    excluded.add(path.resolve(root));
    const real = realOrNull(root);
    if (real !== null) excluded.add(real);
  }
  const isExcluded = (p: string) => [...excluded].some((root) => isInside(p, root));

  const allowed: string[] = [];
  for (const source of sources) {
    for (const required of source.requiredRoots) {
      const real = realOrNull(required);
      if (real === null) {
        throw new DocSourcesDiscoveryError(
          `source "${source.id}" root "${required}" does not exist`,
        );
      }
      allowed.push(real);
    }
    for (const mapping of source.mappings) {
      const real = realOrNull(mapping.root);
      if (real !== null) allowed.push(real);
    }
  }
  const isAllowed = (p: string) => allowed.some((root) => isInside(p, root));

  for (const source of sources) {
    for (const mapping of source.mappings) {
      const label = `source "${source.id}" mapping "${mapping.id}"`;
      // Watch the root's parent for this name so a missing root appearing, or
      // an existing root being removed or replaced, triggers regeneration.
      const anchor = nearestExistingAncestor(mapping.root);
      if (anchor !== null) addWatch(anchor);

      const realRoot = realOrNull(mapping.root);
      if (realRoot === null || !fs.statSync(realRoot).isDirectory()) {
        if (mapping.missing === "error") {
          throw new DocSourcesDiscoveryError(
            `${label} root "${mapping.root}" does not exist (set missing: "skip" for an optional source)`,
          );
        }
        diagnostics.push({ level: "info", message: `${label}: root is missing, skipped` });
        continue;
      }
      if (isExcluded(realRoot)) {
        throw new DocSourcesDiscoveryError(
          `${label} root "${mapping.root}" lies inside a documentation output directory`,
        );
      }

      const seenFiles: Array<{ rel: string; abs: string; real: string }> = [];
      const walk = (dirAbs: string, dirReal: string, rel: string, ancestors: Set<string>) => {
        addWatch({ dir: dirReal });
        let entries: fs.Dirent[];
        try {
          entries = fs.readdirSync(dirAbs, { withFileTypes: true });
        } catch (error) {
          diagnostics.push({ level: "warn", message: `${label}: cannot read "${rel || "."}": ${String(error)}` });
          return;
        }
        entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        for (const entry of entries) {
          const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
          const childAbs = path.join(dirAbs, entry.name);
          let childReal = path.join(dirReal, entry.name);
          let isDir = entry.isDirectory();
          let isFile = entry.isFile();
          if (entry.isSymbolicLink()) {
            const target = realOrNull(childAbs);
            if (target === null) {
              diagnostics.push({ level: "warn", message: `${label}: broken symlink "${childRel}" skipped` });
              continue;
            }
            if (!isAllowed(target)) {
              diagnostics.push({
                level: "warn",
                message: `${label}: symlink "${childRel}" points outside the configured roots and was skipped; configure its target as a mapping root to publish it`,
              });
              continue;
            }
            childReal = target;
            const stat = fs.statSync(target);
            isDir = stat.isDirectory();
            isFile = stat.isFile();
          }
          if (isExcluded(childReal)) continue;
          if (isDir) {
            if (excludesDirectory(childRel, mapping.exclude)) continue;
            if (ancestors.has(childReal)) {
              diagnostics.push({ level: "warn", message: `${label}: symlink cycle at "${childRel}" skipped` });
              continue;
            }
            const next = new Set(ancestors);
            next.add(childReal);
            walk(childAbs, childReal, childRel, next);
          } else if (isFile) {
            if (matchesAny(childRel, mapping.exclude)) continue;
            if (matchesAny(childRel, mapping.include)) {
              files.push({ mapping, rel: childRel, abs: childAbs, real: childReal, kind: "document" });
            } else if (
              mapping.assets !== undefined &&
              matchesAny(childRel, mapping.assets.include) &&
              !matchesAny(childRel, mapping.assets.exclude)
            ) {
              files.push({ mapping, rel: childRel, abs: childAbs, real: childReal, kind: "asset" });
            } else if (mapping.renderer === "skill") {
              seenFiles.push({ rel: childRel, abs: childAbs, real: childReal });
            }
          }
        }
      };
      walk(mapping.root, realRoot, "", new Set([realRoot]));

      if (mapping.renderer === "skill") {
        const skillDirs = files
          .filter((f) => f.mapping === mapping && f.kind === "document" &&
            path.posix.basename(f.rel).toLowerCase() === "skill.md")
          .map((f) => path.posix.dirname(f.rel));
        for (const skillDir of skillDirs) {
          const prefix = skillDir === "." ? "" : `${skillDir}/`;
          const tree: string[] = [];
          for (const seen of seenFiles) {
            if (prefix !== "" && !seen.rel.startsWith(prefix)) continue;
            const inner = seen.rel.slice(prefix.length);
            tree.push(inner);
            if (/\.mdx?$/i.test(inner)) {
              files.push({ mapping, ...seen, kind: "skill-page", skillDir });
            }
          }
          skillTrees.set(`${mapping.sourceId}\u0000${mapping.id}\u0000${skillDir}`, tree.sort());
        }
      }
    }
  }

  return { files, skillTrees, watch: [...watchDirs.values()], diagnostics };
}
