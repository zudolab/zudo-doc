import { execFile, execFileSync, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { DocHistoryEntry, DocHistoryData } from "./types.js";

const execFileAsync = promisify(execFile);

/** Shared options to suppress git stderr noise */
const QUIET: { encoding: "utf-8"; stdio: ["pipe", "pipe", "pipe"] } = {
  encoding: "utf-8",
  stdio: ["pipe", "pipe", "pipe"],
};

/** Cache the repo root to avoid repeated git calls */
let repoRootCache: string | null = null;

function getRepoRoot(): string {
  if (repoRootCache) return repoRootCache;
  // `rev-parse --show-toplevel` walks up from process.cwd(), so it works from
  // any CWD (no explicit cwd needed here).
  repoRootCache = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf-8",
  }).trim();
  return repoRootCache;
}

/**
 * Shared git options pinned to the repo root. Every git command MUST run with
 * cwd = repo root: under `pnpm --filter <pkg>`, process.cwd() is the package
 * dir (packages/doc-history-server/), so the repo-relative pathspecs we build
 * via toRepoRelative() would match nothing and every file would yield 0
 * entries (#1907). Running from the repo root happened to work by accident.
 */
function gitOpts(): typeof QUIET & { cwd: string } {
  return { ...QUIET, cwd: getRepoRoot() };
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
      gitOpts(),
    ).trim();
    return output ? [...new Set(output.split("\n"))] : [];
  } catch {
    return [];
  }
}

/**
 * Get the oldest commit hash that touched a file (the file's "first" commit).
 *
 * Uses --follow + --reverse and takes the first emitted line (the oldest
 * commit). We must NOT pass --max-count=1: git applies the count limit during
 * its newest-first traversal *before* --reverse is applied, so the combination
 * emits nothing (verified empirically on git 2.43.0) — which previously made
 * this function return null for every file, collapsing created==updated dates
 * and attributing every page to its latest committer. git still walks the
 * file's full history once, so this is O(history) for that path, not O(1).
 * Acceptable because the caller is a build-time helper run once per content
 * file, not a hot path.
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
        "--",
        filePath,
      ],
      gitOpts(),
    ).trim();
    if (!output) return null;
    // git log can emit additional follow-related lines on some platforms;
    // the first non-empty line is the oldest commit hash we want.
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
      gitOpts(),
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
 * Parse the output of `git log --follow --format=%H%n%aI%n%aN%n%s%n` into
 * an array of commit metadata records. Records are separated by blank lines
 * (the trailing `%n` in the format adds one blank line after each 4-line block).
 */
function parseCommitLog(
  output: string,
): Array<Omit<DocHistoryEntry, "content">> {
  const records: Array<Omit<DocHistoryEntry, "content">> = [];
  // Split on double-newline separators (each record ends with a blank line)
  const blocks = output.split(/\n\n+/).filter(Boolean);
  for (const block of blocks) {
    const lines = block.split("\n");
    const hash = lines[0]?.trim() ?? "";
    if (!hash) continue;
    records.push({
      hash,
      date: lines[1]?.trim() ?? "",
      author: lines[2]?.trim() ?? "",
      message: lines[3]?.trim() ?? "",
    });
  }
  return records;
}

/** git args for the hash→path `git log --follow --name-only` walk. */
function hashToPathArgs(relPath: string, maxEntries: number): string[] {
  return [
    "log",
    "--follow",
    "--format=%H",
    "--name-only",
    "-n",
    String(maxEntries),
    "--",
    relPath,
  ];
}

/**
 * Pure parser for `git log --follow --format=%H --name-only` output.
 */
function parseHashToPathMap(output: string): Map<string, string> {
  if (!output) return new Map();

  const map = new Map<string, string>();
  // git log --format=%H --name-only output pattern (with --follow):
  //   <hash>\n\n<filepath>\n<hash>\n\n<filepath>\n...
  // The blank line between hash and filepath is git's commit separator
  // emitted even for minimal --format=%H. We collect all non-hash, non-blank
  // lines after each hash until the next hash appears.
  const lines = output.split("\n");
  // Collect all hashes to detect hash lines
  const hashSet = new Set<string>();
  for (const line of lines) {
    const t = line.trim();
    // Full SHA-1 hashes are exactly 40 hex chars
    if (/^[0-9a-f]{40}$/.test(t)) hashSet.add(t);
  }
  let currentHash: string | null = null;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (hashSet.has(t)) {
      currentHash = t;
    } else if (currentHash && !map.has(currentHash)) {
      // First non-hash, non-blank line after a hash = the file path
      map.set(currentHash, t);
    }
  }
  return map;
}

/**
 * Build a map from commit hash → file path at that commit, using
 * `git log --follow --name-only`. Needed to batch-fetch content via
 * git cat-file --batch: the file may have been at a different path before
 * a rename. Runs via execFile (non-blocking) so the CLI's per-file tasks
 * can issue git spawns concurrently.
 *
 * Returns a Map<hash, pathAtCommit>. Only commits that touched the file
 * are included.
 */
async function buildHashToPathMapAsync(
  filePath: string,
  maxEntries: number,
): Promise<Map<string, string>> {
  const relPath = filePath.startsWith("/") ? toRepoRelative(filePath) : filePath;
  try {
    const { stdout } = await execFileAsync(
      "git",
      hashToPathArgs(relPath, maxEntries),
      { ...gitOpts() },
    );
    return parseHashToPathMap(stdout.trim());
  } catch {
    return new Map();
  }
}

/** Build the `<hash>:<path>` stdin request buffer for `git cat-file --batch`. */
function catFileBatchInput(
  pairs: Array<{ hash: string; path: string }>,
): Buffer {
  return Buffer.from(
    pairs.map(({ hash, path }) => `${hash}:${path}`).join("\n"),
    "utf-8",
  );
}

/**
 * Pure parser for `git cat-file --batch` raw output. Operates on the raw
 * Buffer (not a utf-8 string) so the byte-count `<size>` field lines up with
 * buffer offsets — MDX files can contain multi-byte UTF-8 characters where
 * byte count != character count.
 */
function parseBatchContents(
  rawBuf: Buffer,
  pairs: Array<{ hash: string; path: string }>,
): Map<string, string> {
  const result = new Map<string, string>();
  // Parse the Buffer in order — cat-file --batch preserves input order.
  let pos = 0;
  for (const { hash } of pairs) {
    // Find the header line (ends at first \n)
    const newlineIdx = rawBuf.indexOf(0x0a, pos); // 0x0a = '\n'
    if (newlineIdx === -1) break;
    const header = rawBuf.toString("utf-8", pos, newlineIdx);
    pos = newlineIdx + 1;

    if (header.endsWith(" missing")) {
      // No content for this object — caller will use fallback
      continue;
    }

    // Header format: "<objecthash> blob <size>"
    const headerParts = header.split(" ");
    const sizeStr = headerParts[headerParts.length - 1];
    const size = parseInt(sizeStr ?? "0", 10);
    if (isNaN(size)) continue;

    // Read exactly `size` bytes (the content), then skip the trailing \n separator
    const content = rawBuf.toString("utf-8", pos, pos + size);
    pos += size + 1; // +1 for the trailing \n after content block

    result.set(hash, content);
  }
  return result;
}

/**
 * Batch-fetch file contents for multiple (hash, path) pairs using a single
 * `git cat-file --batch` process. Returns a Map<hash, content>.
 *
 * `git cat-file --batch` reads its request list from stdin, which execFile's
 * promisified form can't supply, so this spawns the process and writes the
 * request buffer to stdin directly. Pairs that produce "missing" responses
 * are excluded from the result; the caller should fall back to per-commit
 * logic for those (rename misses).
 */
function batchFetchContentsAsync(
  pairs: Array<{ hash: string; path: string }>,
): Promise<Map<string, string>> {
  if (pairs.length === 0) return Promise.resolve(new Map());

  return new Promise((resolvePromise) => {
    const child = spawn("git", ["cat-file", "--batch"], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: getRepoRoot(),
    });

    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    // Match the sync path's catch→empty-map: any spawn failure yields no
    // batch hits, so the caller falls back to per-commit content fetches.
    child.on("error", () => resolvePromise(new Map()));
    child.on("close", () => {
      try {
        resolvePromise(parseBatchContents(Buffer.concat(chunks), pairs));
      } catch {
        resolvePromise(new Map());
      }
    });

    child.stdin.on("error", () => {
      // EPIPE if git exits before we finish writing — close handler still runs.
    });
    child.stdin.write(catFileBatchInput(pairs));
    child.stdin.end();
  });
}

/** git args for the per-file commit-metadata `git log --follow` walk. */
function commitMetaArgs(relPath: string, maxEntries: number): string[] {
  return [
    "log",
    "--follow",
    "--format=%H%n%aI%n%aN%n%s%n",
    "-n",
    String(maxEntries),
    "--",
    relPath,
  ];
}

/**
 * Get the complete history for a document file.
 *
 * Optimised: uses ONE `git log --follow` for commit metadata and ONE
 * `git log --follow --name-only` for the hash→path map, then a single
 * `git cat-file --batch` for all content fetches. Falls back to
 * per-commit logic only for batch misses (renamed-path entries where the
 * current path didn't exist at that commit).
 *
 * Issues all git commands via execFile / spawn (non-blocking) so the CLI's
 * semaphore-bounded concurrency actually parallelizes across files (#1986).
 */
export async function getDocHistoryAsync(
  filePath: string,
  slug: string,
  maxEntries = 50,
): Promise<DocHistoryData> {
  const relPath = filePath.startsWith("/") ? toRepoRelative(filePath) : filePath;

  // Single spawn: get all commit metadata (hash, date, author, message)
  let metaRecords: Array<Omit<DocHistoryEntry, "content">> = [];
  try {
    const { stdout } = await execFileAsync(
      "git",
      commitMetaArgs(relPath, maxEntries),
      { ...gitOpts() },
    );
    const logOutput = stdout.trim();
    if (logOutput) {
      metaRecords = parseCommitLog(logOutput);
    }
  } catch {
    // fall through to empty
  }

  if (metaRecords.length === 0) {
    return { slug, filePath: relPath, entries: [] };
  }

  // Build hash→path mapping (needed for rename-aware content fetching)
  const hashToPath = await buildHashToPathMapAsync(relPath, maxEntries);

  // Build pairs for batched content fetch, using the correct path at each commit
  const pairs = metaRecords.map((rec) => ({
    hash: rec.hash,
    path: hashToPath.get(rec.hash) ?? relPath,
  }));

  // Batch-fetch all content in a single git cat-file --batch spawn
  const contentMap = await batchFetchContentsAsync(pairs);

  // Assemble entries; fall back to per-commit logic for batch misses
  const entries: DocHistoryEntry[] = await Promise.all(
    metaRecords.map(async (rec) => {
      if (contentMap.has(rec.hash)) {
        return { ...rec, content: contentMap.get(rec.hash)! };
      }
      // Batch miss: rename path not in map or object missing — use fallback
      const content = await getFileAtCommitAsync(rec.hash, filePath);
      return { ...rec, content };
    }),
  );

  return { slug, filePath: relPath, entries };
}

/**
 * Get the file content at a specific commit. Accepts absolute paths and
 * converts to repo-relative for git show. Handles renamed files by falling
 * back through a 3-stage rename-detection chain. Uses execFile (non-blocking).
 * Only hit for batch misses (renamed-path entries), which are rare.
 */
async function getFileAtCommitAsync(
  hash: string,
  filePath: string,
): Promise<string> {
  const isAbsolute = filePath.startsWith("/");
  const relPath = isAbsolute ? toRepoRelative(filePath) : filePath;

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["show", `${hash}:${relPath}`],
      { ...gitOpts() },
    );
    return stdout;
  } catch {
    // File may have been renamed — find the old path at this commit
    try {
      const { stdout: oldPathRaw } = await execFileAsync(
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
        { ...gitOpts() },
      );
      const oldPath = oldPathRaw.trim();
      if (oldPath) {
        const { stdout } = await execFileAsync(
          "git",
          ["show", `${hash}:${oldPath}`],
          { ...gitOpts() },
        );
        return stdout;
      }
    } catch {
      // ignore
    }

    // Last resort: use git log --follow to find the path at this revision
    try {
      const { stdout: followRaw } = await execFileAsync(
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
        { ...gitOpts() },
      );
      const lines = followRaw.trim().split("\n").filter(Boolean);
      // Lines alternate: hash, filename, hash, filename...
      for (let i = 0; i < lines.length - 1; i += 2) {
        if (lines[i] === hash && lines[i + 1]) {
          const { stdout } = await execFileAsync(
            "git",
            ["show", `${hash}:${lines[i + 1]}`],
            { ...gitOpts() },
          );
          return stdout;
        }
      }
    } catch {
      // ignore
    }

    return "";
  }
}

/**
 * Get commit metadata for a file using a single `git log --follow` walk.
 * Returns an array of records newest-first (no -n limit = full history).
 * Used by pre-build meta to get both newest and oldest in one spawn.
 */
export function getFileCommitsMeta(
  filePath: string,
): Array<Omit<DocHistoryEntry, "content">> {
  const relPath = filePath.startsWith("/") ? toRepoRelative(filePath) : filePath;
  try {
    const output = execFileSync(
      "git",
      [
        "log",
        "--follow",
        "--format=%H%n%aI%n%aN%n%s%n",
        "--",
        relPath,
      ],
      gitOpts(),
    ).trim();
    if (!output) return [];
    return parseCommitLog(output);
  } catch {
    return [];
  }
}

/**
 * Get commit metadata for a file using a single `git log --follow` walk
 * (async variant). Runs via execFile (non-blocking) so callers can issue
 * multiple git spawns concurrently. Returns an array of records newest-first
 * (no -n limit). Used by the pre-build parallelization path.
 */
export async function getFileCommitsMetaAsync(
  filePath: string,
): Promise<Array<Omit<DocHistoryEntry, "content">>> {
  const relPath = filePath.startsWith("/") ? toRepoRelative(filePath) : filePath;
  try {
    const { stdout } = await execFileAsync(
      "git",
      [
        "log",
        "--follow",
        "--format=%H%n%aI%n%aN%n%s%n",
        "--",
        relPath,
      ],
      // Use the same opts as the sync variant (stdio suppressed, cwd = repo root).
      // maxBuffer default (1 MB) is intentionally kept — matching execFileSync's
      // behaviour: a file whose full history exceeds 1 MB would throw, get caught,
      // and return [], keeping the key absent from the manifest (same semantics
      // as the sync path's catch→[]).
      { ...gitOpts() },
    );
    if (!stdout.trim()) return [];
    return parseCommitLog(stdout.trim());
  } catch {
    return [];
  }
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
        // Storage half of the doc-history "" <-> "index" sentinel (#1891).
        // The leading-slash regex strips nested `x/index` → `x` but
        // deliberately KEEPS a bare root `index` as `index` (no leading slash
        // to match): doc-history JSON is stored/served under "index" because an
        // empty path segment is unroutable (server regex below + the
        // `<locale>/<slug>.json` composition both reject ""). The canonical
        // ROUTE slug for the same page is "" (→ /docs/) — see
        // src/utils/slug.ts `toRouteSlug` / `toHistorySlug` in the host repo;
        // this package cannot import across the boundary (see its CLAUDE.md),
        // so the one-line rule is duplicated here with this pointer.
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
