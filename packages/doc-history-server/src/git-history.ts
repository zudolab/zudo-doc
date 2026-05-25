import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { DocHistoryEntry, DocHistoryData } from "./types.js";

/** Shared options to suppress git stderr noise */
const QUIET: { encoding: "utf-8"; stdio: ["pipe", "pipe", "pipe"] } = {
  encoding: "utf-8",
  stdio: ["pipe", "pipe", "pipe"],
};

/** Cache the repo root to avoid repeated git calls */
let repoRootCache: string | null = null;

function getRepoRoot(): string {
  if (repoRootCache) return repoRootCache;
  repoRootCache = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf-8",
  }).trim();
  return repoRootCache;
}

/** Convert an absolute path to a repo-relative path for git commands */
function toRepoRelative(absolutePath: string): string {
  return relative(getRepoRoot(), absolutePath);
}

/**
 * Get the list of commit hashes that touched a file, newest first.
 * Uses --follow to track renames.
 * Limits to maxEntries commits (default 50).
 */
export function getFileCommits(
  filePath: string,
  maxEntries = 50,
): string[] {
  try {
    const output = execFileSync(
      "git",
      [
        "log",
        "--follow",
        "--format=%H",
        "-n",
        String(maxEntries),
        "--",
        filePath,
      ],
      QUIET,
    ).trim();
    return output ? [...new Set(output.split("\n"))] : [];
  } catch {
    return [];
  }
}

/**
 * Get the oldest commit hash that touched a file (the file's "first" commit).
 *
 * Uses --follow + --reverse + --max-count=1. Note that git still has to walk
 * the file's full history once before applying --reverse, so this is O(history)
 * for that file path, not O(1). Acceptable here because the caller is a
 * build-time helper run once per content file, not a hot path.
 *
 * Returns null when the file has no git history (untracked / not yet committed).
 */
export function getFirstCommit(filePath: string): string | null {
  try {
    const output = execFileSync(
      "git",
      [
        "log",
        "--follow",
        "--reverse",
        "--format=%H",
        "--max-count=1",
        "--",
        filePath,
      ],
      QUIET,
    ).trim();
    if (!output) return null;
    // git log can emit additional follow-related lines on some platforms;
    // the first non-empty line is the commit hash we want.
    const first = output.split("\n")[0]?.trim();
    return first ? first : null;
  } catch {
    return null;
  }
}

/**
 * Get metadata for a specific commit on a file.
 * Returns { hash, date, author, message } with full hash for unique identification.
 */
export function getCommitInfo(
  hash: string,
  filePath: string,
): Omit<DocHistoryEntry, "content"> {
  try {
    const output = execFileSync(
      "git",
      ["log", "-1", "--format=%H%n%aI%n%aN%n%s", hash, "--", filePath],
      QUIET,
    ).trim();
    const lines = output.split("\n");
    return {
      hash: lines[0] ?? hash,
      date: lines[1] ?? "",
      author: lines[2] ?? "",
      message: lines[3] ?? "",
    };
  } catch {
    return { hash, date: "", author: "", message: "" };
  }
}

/**
 * Get the file content at a specific commit.
 * Accepts absolute paths and converts to repo-relative for git show.
 * Handles renamed files by falling back to the old path via git log --follow.
 */
export function getFileAtCommit(hash: string, filePath: string): string {
  const isAbsolute = filePath.startsWith("/");
  const relPath = isAbsolute ? toRepoRelative(filePath) : filePath;

  try {
    return execFileSync("git", ["show", `${hash}:${relPath}`], QUIET);
  } catch {
    // File may have been renamed — find the old path at this commit
    try {
      const oldPath = execFileSync(
        "git",
        [
          "log",
          "-1",
          "--follow",
          "--diff-filter=R",
          "--format=",
          "--name-only",
          hash,
          "--",
          relPath,
        ],
        QUIET,
      ).trim();
      if (oldPath) {
        return execFileSync("git", ["show", `${hash}:${oldPath}`], QUIET);
      }
    } catch {
      // ignore
    }

    // Last resort: use git log --follow to find the path at this revision
    try {
      const followOutput = execFileSync(
        "git",
        [
          "log",
          "--follow",
          "--format=%H",
          "--name-only",
          "--diff-filter=AMRC",
          "--",
          relPath,
        ],
        QUIET,
      ).trim();
      const lines = followOutput.split("\n").filter(Boolean);
      // Lines alternate: hash, filename, hash, filename...
      for (let i = 0; i < lines.length - 1; i += 2) {
        if (lines[i] === hash && lines[i + 1]) {
          return execFileSync(
            "git",
            ["show", `${hash}:${lines[i + 1]}`],
            QUIET,
          );
        }
      }
    } catch {
      // ignore
    }

    return "";
  }
}

/**
 * Get the complete history for a document file.
 * Returns DocHistoryData with all entries populated.
 */
export function getDocHistory(
  filePath: string,
  slug: string,
  maxEntries = 50,
): DocHistoryData {
  const commits = getFileCommits(filePath, maxEntries);
  const entries: DocHistoryEntry[] = commits.map((hash) => {
    const info = getCommitInfo(hash, filePath);
    const content = getFileAtCommit(hash, filePath);
    return { ...info, content };
  });
  // Store repo-relative path to avoid leaking absolute server paths
  const relPath = filePath.startsWith("/") ? toRepoRelative(filePath) : filePath;
  return { slug, filePath: relPath, entries };
}

/**
 * Collect all MDX/md files in a content directory.
 * Returns array of { filePath, slug } pairs.
 */
export function collectContentFiles(
  dir: string,
): Array<{ filePath: string; slug: string }> {
  const results: Array<{ filePath: string; slug: string }> = [];

  function walk(currentDir: string, baseDir: string): void {
    let entries;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, baseDir);
      } else if (/\.mdx?$/.test(entry.name) && !entry.name.startsWith("_")) {
        const rel = relative(baseDir, fullPath)
          .replace(/\.mdx?$/, "")
          .replace(/\/index$/, "");
        results.push({ filePath: fullPath, slug: rel });
      }
    }
  }

  walk(dir, dir);
  return results;
}
