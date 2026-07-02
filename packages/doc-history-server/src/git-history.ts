import { execFile, execFileSync, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { StringDecoder } from "node:string_decoder";
import type { DocHistoryEntry, DocHistoryData } from "./types.js";

const execFileAsync = promisify(execFile);

/** Shared options to suppress git stderr noise */
const QUIET: { encoding: "utf-8"; stdio: ["pipe", "pipe", "pipe"] } = {
  encoding: "utf-8",
  stdio: ["pipe", "pipe", "pipe"],
};

// Cache the repo-root probe (success OR failure) so a non-git project spawns
// `git rev-parse` exactly once, not once per content file.
let repoRootCache: string | null = null;
let repoRootResolved = false;

/**
 * Resolve the git repo root, or `null` when the current working tree is not a
 * git repository (or git is unavailable). Doc history then degrades to empty
 * instead of crashing the build — e.g. a freshly scaffolded project before its
 * first `git init`. The probe result (success OR failure) is cached.
 *
 * `rev-parse --show-toplevel` walks up from process.cwd(), so it works from any
 * CWD (no explicit cwd needed here).
 */
function getRepoRootOrNull(): string | null {
  if (repoRootResolved) return repoRootCache;
  repoRootResolved = true;
  try {
    repoRootCache = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf-8",
    }).trim();
  } catch {
    // Not a git repository, or git is not installed. Callers guard on
    // isGitRepo() and degrade to empty history rather than throwing. Emit a
    // single hint (this catch runs at most once — see the repoRootResolved
    // gate) so the resulting absence of Created/Updated/Author metadata is
    // explainable instead of mysterious. This replaces the old hard crash in a
    // non-git project (e.g. a freshly scaffolded site before `git init`).
    repoRootCache = null;
    console.warn(
      "doc-history-server: not inside a git repository — doc history will be empty. " +
        "Run `git init` and commit to enable Created/Updated/Author metadata.",
    );
  }
  return repoRootCache;
}

/**
 * True when the current working tree is inside a git repository. Public entry
 * points call this first and return empty results when it is false, so no git
 * command is spawned (and `getRepoRoot()` never throws) outside a repo. This is
 * what lets `pnpm dev` / `pnpm build` succeed in a project that has not been
 * `git init`-ed yet, instead of crashing the doc-history preBuild hook.
 */
export function isGitRepo(): boolean {
  return getRepoRootOrNull() != null;
}

/**
 * Repo root for internal git invocations. Only reached after a public entry
 * point has guarded on `isGitRepo()`, so a null here is a programmer error
 * rather than the expected "no repo" path.
 */
function getRepoRoot(): string {
  const root = getRepoRootOrNull();
  if (root == null) {
    throw new Error(
      "doc-history-server: getRepoRoot() called outside a git repository — guard with isGitRepo() first",
    );
  }
  return root;
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
  if (!isGitRepo()) return [];
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
  if (!isGitRepo()) return null;
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
  if (!isGitRepo()) return { hash, date: "", author: "", message: "" };
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
 *
 * git emits records with the structure:
 *   <40-hex-hash>\n\n<filepath>\n
 * where the blank line (`\n\n`) appears between the hash and the filepath —
 * it is git's commit separator emitted for every --format output even when
 * using the minimal %H format. Consecutive records are delimited by the
 * filepath of the previous record followed immediately by the next hash line
 * (single `\n` between them, not a blank line).
 *
 * Parsing strategy: scan line by line, using a state machine that transitions
 * from EXPECT_HASH → EXPECT_BLANK → EXPECT_PATH and back. The blank-line
 * state is the structural record boundary — it distinguishes the separator
 * git injects after each format output from ordinary non-hash lines. This
 * avoids the previous two-pass approach (collect all hashes → re-classify)
 * and is robust against file paths that happen to be 40-char hex strings.
 */
export function parseHashToPathMap(output: string): Map<string, string> {
  if (!output) return new Map();

  const map = new Map<string, string>();
  const lines = output.split("\n");

  type State = "expect_hash" | "expect_blank" | "expect_path";
  let state: State = "expect_hash";
  let currentHash = "";

  for (const line of lines) {
    const t = line.trim();
    switch (state) {
      case "expect_hash":
        // A record starts with a 40-hex hash line (standard SHA-1)
        if (/^[0-9a-f]{40,64}$/.test(t)) {
          currentHash = t;
          state = "expect_blank";
        }
        break;
      case "expect_blank":
        // git always emits a blank line after the hash (commit separator)
        if (t === "") {
          state = "expect_path";
        } else {
          // Unexpected non-blank after hash — reset and re-try this line
          currentHash = "";
          state = "expect_hash";
        }
        break;
      case "expect_path":
        if (t === "") break; // skip extra blank lines
        // First non-blank line after the separator is the file path
        if (currentHash && !map.has(currentHash)) {
          map.set(currentHash, t);
        }
        // Next line could be the next hash (no blank between path and next hash)
        currentHash = "";
        state = "expect_hash";
        break;
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
    // Guard against NaN, negative sizes, and headers that claim more bytes
    // than the buffer contains. Any of these indicate a corrupt or truncated
    // cat-file response; stop parsing rather than desyncing `pos` and
    // producing garbage for later entries.
    if (isNaN(size) || size < 0 || pos + size > rawBuf.length) break;

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
 * Optimised: uses ONE `git log --follow` for commit metadata AND ONE
 * `git log --follow --name-only` for the hash→path map, run in PARALLEL
 * via Promise.all (they are independent git walks). Then a single
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
  if (!isGitRepo()) return { slug, filePath, entries: [] };
  const relPath = filePath.startsWith("/") ? toRepoRelative(filePath) : filePath;

  // Run the two independent git walks in parallel:
  // (1) commit metadata (hash, date, author, message)
  // (2) hash→path map (needed for rename-aware content fetching)
  // They both do `--follow` traversals of the same file history but emit
  // different fields — neither depends on the other's output.
  const [metaRecords, hashToPath] = await Promise.all([
    execFileAsync("git", commitMetaArgs(relPath, maxEntries), { ...gitOpts() })
      .then(({ stdout }) => (stdout.trim() ? parseCommitLog(stdout.trim()) : []))
      .catch((): Array<Omit<DocHistoryEntry, "content">> => []),
    buildHashToPathMapAsync(relPath, maxEntries),
  ]);

  if (metaRecords.length === 0) {
    return { slug, filePath: relPath, entries: [] };
  }

  // Build pairs for batched content fetch, using the correct path at each commit
  const pairs = metaRecords.map((rec) => ({
    hash: rec.hash,
    path: hashToPath.get(rec.hash) ?? relPath,
  }));

  // Batch-fetch all content in a single git cat-file --batch spawn
  const contentMap = await batchFetchContentsAsync(pairs);

  // Assemble entries; fall back to per-commit logic for batch misses.
  // Batch hits are synchronous (no I/O). Misses (renamed paths not in the
  // batch) are fetched sequentially rather than via Promise.all to bound the
  // number of concurrent git processes: a file with many renames could
  // otherwise spawn dozens of git-show processes inside a single semaphore
  // permit, overwhelming the global git-process budget set in cli.ts.
  // Renames are documented as rare, so sequential fallback is acceptable.
  const entries: DocHistoryEntry[] = [];
  for (const rec of metaRecords) {
    if (contentMap.has(rec.hash)) {
      entries.push({ ...rec, content: contentMap.get(rec.hash)! });
    } else {
      // Batch miss: rename path not in map or object missing — use fallback
      const content = await getFileAtCommitAsync(rec.hash, filePath);
      entries.push({ ...rec, content });
    }
  }

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
  if (!isGitRepo()) return [];
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
 * 32 MB maxBuffer for `getFileCommitsMetaAsync`. The Node default (1 MB) is
 * too small for a doc corpus with long histories: an RangeError / ERR_CHILD_PROCESS_STDIO_MAXBUFFER
 * from execFile's promisified form was previously silently caught and returned
 * [], causing the file to disappear from the manifest without any trace (#2293).
 * 32 MB covers a corpus of ~16 000 commits × 2 KB average format output before
 * the guard kicks in; adjust via the exported MAX_BUFFER_BYTES constant if your
 * project needs a different bound.
 */
export const MAX_BUFFER_BYTES = 32 * 1024 * 1024; // 32 MB

/**
 * Get commit metadata for a file using a single `git log --follow` walk
 * (async variant). Runs via execFile (non-blocking) so callers can issue
 * multiple git spawns concurrently. Returns an array of records newest-first
 * (no -n limit). Used by the pre-build parallelization path.
 *
 * maxBuffer is raised to MAX_BUFFER_BYTES (32 MB) to avoid silent data loss
 * for files with very long histories — previously the default 1 MB limit
 * caused the catch block to swallow the error and return [], dropping the
 * file from the manifest. A warning is now logged on any catch so the
 * failure is visible (#2293).
 *
 * Retained as public API for downstream consumers of
 * `@takazudo/zudo-doc-history-server` — the preBuild meta pass no longer calls
 * this in-repo (superseded by `getAllFilesFirstLastMetaAsync`, #2517), but it
 * stays exported for back-compat.
 */
export async function getFileCommitsMetaAsync(
  filePath: string,
): Promise<Array<Omit<DocHistoryEntry, "content">>> {
  if (!isGitRepo()) return [];
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
      { ...gitOpts(), maxBuffer: MAX_BUFFER_BYTES },
    );
    if (!stdout.trim()) return [];
    return parseCommitLog(stdout.trim());
  } catch (err) {
    // Log a warning instead of silently returning [] — a maxBuffer overflow or
    // git error here drops the file from the pre-build manifest entirely, which
    // is a hard-to-diagnose data-loss class (#2293).
    console.warn(
      `doc-history-server: getFileCommitsMetaAsync failed for "${relPath}" — file will be absent from the manifest.`,
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Single-pass first/last metadata walk (#2517)
//
// The preBuild meta pass needs only {oldest, newest} author+date per current
// content file. Doing that as one `git log --follow` per file is O(pages ×
// history) and blew zfb's 120s plugin-hook budget on large corpora. This walks
// the whole history ONCE with `--name-status`, reconstructing rename chains in
// user-space so the result matches what per-file `--follow` would have found.
// ---------------------------------------------------------------------------

/**
 * NUL byte prefixing each commit-header line in the single-pass walk's
 * `--format`. git never emits a literal NUL inside a `--name-status` record
 * line (paths are emitted raw under `core.quotePath=false` and cannot contain
 * NUL), so a line starting with this byte is unambiguously a commit header
 * rather than a status record — no reliance on git's blank-line separators.
 */
const WALK_COMMIT_SENTINEL = "\x00";

/**
 * git `--format` for the walk: `<NUL><hash>\n<isoDate>\n<authorName>`. The
 * literal token `%x00` (NOT a real NUL) is passed to git — Node's `spawn`
 * rejects argv strings containing a NUL byte, but git expands `%x00` to a NUL
 * in its OUTPUT, which the parser then keys on via WALK_COMMIT_SENTINEL.
 */
const WALK_FORMAT = "%x00%H%n%aI%n%aN";

/** Oldest + newest author/date for a single current-path key. */
export interface FirstLastMeta {
  /** The file's creation-side commit (author = page author, date = createdDate). */
  oldest: { author: string; date: string };
  /** The file's most recent commit (date = updatedDate). */
  newest: { author: string; date: string };
}

/**
 * Stateful accumulator that consumes the walk's stdout line-by-line and
 * reconstructs rename chains. Kept separate from the spawn so the pure parser
 * (`parseFirstLastMeta`) and the streaming walk share identical logic.
 *
 * Walk order is git's default newest-first. Each LIVE file is a "chain" keyed
 * by its CURRENT repo-relative path (exactly what git emits for the file as it
 * exists now) and tracked in `result`. As we descend newest→oldest a chain also
 * has a CURRENT PHYSICAL PATH — the path the file occupied at the commit we are
 * visiting. `physicalToKey` maps that physical path → the chain's key. A record
 * touches a chain ONLY when the record's path equals that chain's current
 * physical path; records on any other path belong to a dead or unrelated file
 * and must NOT mutate (or seal) a live chain. For each touching record we:
 *   - open the chain on first sight (⇒ newest commit that touched it), and
 *   - overwrite `oldest` on every touch (last write wins ⇒ oldest, since we
 *     descend newest→oldest).
 *
 * Rename `R old→new`: attribute to the chain, then re-point its physical path
 * from `new` to `old` (`physicalToKey.delete(new)` + `set(old, key)`) so still
 * older records for `old` chain on, while older records for `new` — now a
 * DIFFERENT file that reused the freed name — no longer reach this chain. This
 * physical-path scoping is the #2517 fix: previously the delete boundary keyed
 * on the CANONICAL key, so an unrelated `D new` OLDER than the rename wrongly
 * sealed a chain that had already renamed AWAY from `new`, truncating it to a
 * too-recent createdDate/author (matches `git log --follow`, which walks the
 * current file back through renames and stops at ITS creation).
 *
 * Delete `D path` on a chain's current physical path: the reuse boundary. In
 * forward time the chain's file is a RECREATION at `path`; everything older on
 * `path` is a different file. We drop the physical mapping (so older records on
 * `path` can't re-attribute) while the surviving `result[key]` entry keeps them
 * from opening a bogus fresh chain — the walk stops here exactly like per-file
 * `--follow`.
 *
 * NOTE — the boundary keys on DELETE, never on ADD. The issue (#2517) proposed
 * sealing on the recreation `A`. On a clean single-root history that is
 * equivalent, but this repo's real history has multiple orphan roots (a
 * `barebone-build-diff` dev tool + squashed bases), so a single unchanged file
 * legitimately appears as `A` on several roots that `--follow` treats as ONE
 * continuous history. Sealing on `A` truncated 261/293 pages to a wrong (newer)
 * createdDate; letting `A` keep attributing carries last-write-wins back to the
 * OLDEST add, reproducing `git log --follow` byte-for-byte (0 deltas) while the
 * physical-path-scoped `D` boundary still guards genuine delete→recreate reuse.
 * See the PR parity table.
 *
 * Copy `C old→new`: attribute to the target but do NOT re-point — `--follow`
 * doesn't track copies, so a docs-ja copy must not inherit EN history.
 */
function createFirstLastMetaAccumulator(): {
  pushLine(line: string): void;
  finish(): Map<string, FirstLastMeta>;
} {
  type State = "expect_hash" | "expect_date" | "expect_author" | "in_records";
  let state: State = "expect_hash";
  let curDate = "";
  let curAuthor = "";

  // Live chains only: current physical path → chain key (the file's current
  // repo-relative path). A path absent from this map is no live chain's current
  // physical location.
  const physicalToKey = new Map<string, string>();
  const result = new Map<string, FirstLastMeta>();

  function attribute(key: string): void {
    const commit = { author: curAuthor, date: curDate };
    const existing = result.get(key);
    if (existing) {
      existing.oldest = commit; // last write wins ⇒ oldest
    } else {
      result.set(key, { oldest: commit, newest: commit }); // first sight ⇒ newest
    }
  }

  function applyRecord(status: string, paths: string[]): void {
    const code = status[0];

    if (code === "R" || code === "C") {
      // `R<score>\told\tnew` / `C<score>\told\tnew`.
      const oldPath = paths[0];
      const newPath = paths[1];
      if (!newPath) return;
      let key = physicalToKey.get(newPath);
      if (key === undefined) {
        // `newPath` reappearing after the live chain renamed off it (or was
        // sealed) is unrelated path-reuse — leave that chain untouched.
        if (result.has(newPath)) return;
        key = newPath; // first sight of a current file's path ⇒ new chain
      }
      attribute(key);
      if (code === "R" && oldPath) {
        // The chain's physical path moves to `oldPath`; `newPath` is no longer
        // this chain's location for any older record.
        physicalToKey.delete(newPath);
        physicalToKey.set(oldPath, key);
      } else {
        // Copy (or a rename missing its old path): the chain stays at newPath.
        physicalToKey.set(newPath, key);
      }
      return;
    }

    // `A`/`M`/`D`/`T`/… `\tpath`.
    const p = paths[0];
    if (!p) return;
    const key = physicalToKey.get(p);

    if (key === undefined) {
      // No live chain occupies `p`. A delete bounds a dead file; an A/M on a
      // path already claimed by a (moved-away or sealed) chain is path-reuse —
      // either way, leave existing chains untouched.
      if (code === "D" || result.has(p)) return;
      // Otherwise this is the newest record for a current file — open its chain.
      physicalToKey.set(p, p);
      attribute(p);
      return;
    }

    if (code === "D") {
      // Reuse boundary on the chain's physical path: stop the chain here.
      physicalToKey.delete(p);
      return;
    }

    attribute(key);
  }

  function pushLine(line: string): void {
    switch (state) {
      case "expect_hash":
        // Skip leading blanks / stray lines until the first commit header.
        if (line.startsWith(WALK_COMMIT_SENTINEL)) state = "expect_date";
        break;
      case "expect_date":
        curDate = line.trim();
        state = "expect_author";
        break;
      case "expect_author":
        curAuthor = line.trim();
        state = "in_records";
        break;
      case "in_records":
        if (line.startsWith(WALK_COMMIT_SENTINEL)) {
          // Next commit begins; its date/author follow.
          state = "expect_date";
          break;
        }
        if (line === "") break; // git's blank separator before the record block
        {
          const fields = line.split("\t");
          const status = fields[0];
          if (status) applyRecord(status, fields.slice(1));
        }
        break;
    }
  }

  return { pushLine, finish: () => result };
}

/**
 * Pure parser + rename reconstruction for the single-pass walk's stdout.
 * Keyed by CURRENT repo-relative path (exactly what git emits). Exported for
 * unit tests; the streaming walk uses the same accumulator incrementally.
 */
export function parseFirstLastMeta(output: string): Map<string, FirstLastMeta> {
  const acc = createFirstLastMetaAccumulator();
  if (output.length > 0) {
    for (const line of output.split("\n")) acc.pushLine(line);
  }
  return acc.finish();
}

/**
 * Walk the WHOLE git history ONCE and return `{oldest, newest}` author/date for
 * every current file, keyed by ABSOLUTE path (`<repoRoot>/<relPath>`) so a
 * consumer whose project root differs from the repo root still matches by the
 * absolute paths its content walker produced.
 *
 * ONE streaming `git log --full-history --name-status --find-renames -l0`
 * spawn, parsed incrementally (never execFile+maxBuffer — that reintroduced the
 * #2293 silent-truncation class — and never concat-all-then-parse, since a
 * full-history buffer can be large in arbitrary consumer repos).
 *
 * `-l0` is mandatory: a bulk `--name-status --find-renames` walk runs rename
 * detection per-commit under the global `diff.renameLimit`; a mass-rename commit
 * that hits the limit emits `D`+`A` instead of `R`, silently dropping pre-rename
 * history (wrong createdDate/author) where per-path `--follow` would find it.
 *
 * `--full-history` is required to MATCH per-file `--follow`: default history
 * simplification prunes commits on merged side-branches that are TREESAME to the
 * first parent, so a bounded directory walk would miss updates that `--follow`
 * (which effectively sees the full per-file history) reports. Without it, most
 * pages collapsed updatedDate onto createdDate. Merges still emit header-only
 * name-status under the default `--diff-merges`, so this does not double-count.
 *
 * `pathspecs` bound the walk to the content dirs (absolute or repo-relative;
 * absolute entries are converted to repo-relative like the other helpers). Pass
 * `[]` to walk full history.
 *
 * cwd = repo root (#1907). Returns an empty Map outside a git repo so callers
 * degrade to an empty manifest instead of crashing.
 */
export function getAllFilesFirstLastMetaAsync(
  pathspecs: string[] = [],
): Promise<Map<string, FirstLastMeta>> {
  if (!isGitRepo()) return Promise.resolve(new Map());

  const repoRoot = getRepoRoot();
  const relSpecs = pathspecs.map((p) =>
    p.startsWith("/") ? toRepoRelative(p) : p,
  );
  const args = [
    "-c",
    "core.quotePath=false", // emit raw UTF-8 paths so keys match content-walker paths
    "log",
    "--full-history",
    "--name-status",
    "--find-renames",
    "-l0",
    `--format=${WALK_FORMAT}`,
  ];
  if (relSpecs.length > 0) args.push("--", ...relSpecs);

  return new Promise((resolvePromise) => {
    const child = spawn("git", args, {
      stdio: ["ignore", "pipe", "ignore"],
      cwd: repoRoot,
    });

    const acc = createFirstLastMetaAccumulator();
    // StringDecoder buffers incomplete multi-byte UTF-8 sequences that straddle
    // chunk boundaries, so a Japanese path split across two data events decodes
    // correctly.
    const decoder = new StringDecoder("utf-8");
    let buf = "";

    child.stdout.on("data", (chunk: Buffer) => {
      buf += decoder.write(chunk);
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        acc.pushLine(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
      }
    });
    // git missing / spawn failure ⇒ empty map; the caller degrades to an empty
    // manifest exactly as the old per-file catch→[] did.
    child.on("error", () => resolvePromise(new Map()));
    child.on("close", () => {
      buf += decoder.end();
      if (buf.length > 0) acc.pushLine(buf); // trailing line without a newline
      const relMap = acc.finish();
      const absMap = new Map<string, FirstLastMeta>();
      for (const [rel, meta] of relMap) absMap.set(join(repoRoot, rel), meta);
      resolvePromise(absMap);
    });
  });
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

/**
 * Back-compat alias for the public `./git-history` subpath: the sync
 * `getDocHistory` was removed when the duplicated sync orchestration
 * family was deleted (#2011). The alias keeps the exported name resolving
 * for existing consumers — note it is now async (returns a Promise).
 */
export const getDocHistory = getDocHistoryAsync;
