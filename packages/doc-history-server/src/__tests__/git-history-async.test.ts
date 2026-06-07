import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

// #1986: getDocHistoryAsync issues each git command via execFile / spawn
// instead of execFileSync, so the CLI's per-file semaphore actually
// parallelizes (the sync getDocHistory blocked the event loop, making the
// concurrency cap a no-op). These cases prove (1) byte-for-byte output parity
// with the sync getDocHistory, (2) the heavy git work never touches
// execFileSync (i.e. it really is async), and (3) every git call runs with
// cwd = repo root (#1907).

const FAKE_REPO_ROOT = "/fake/repo/root";
const REL = "src/content/docs/page.mdx";
const ABS = `${FAKE_REPO_ROOT}/${REL}`;
const HASH_A = "a".repeat(40); // newest
const HASH_B = "b".repeat(40); // oldest

// `git log --follow --format=%H%n%aI%n%aN%n%s%n -n N` — blank-line-separated
// 4-line records, newest first.
const META_LOG = `${HASH_A}\n2024-01-02T00:00:00Z\nAlice\nupdate page\n\n${HASH_B}\n2024-01-01T00:00:00Z\nBob\ncreate page\n`;
// `git log --follow --format=%H --name-only -n N` — <hash>\n\n<path> blocks.
const NAMEONLY_LOG = `${HASH_A}\n\n${REL}\n${HASH_B}\n\n${REL}\n`;
// `git cat-file --batch` raw output: "<obj> blob <size>\n<content>\n" per pair,
// in the same order as the request (newest A, then oldest B).
const CATFILE_OUT = Buffer.from(
  `${HASH_A} blob 7\nnewest\n\n${HASH_B} blob 7\noldest\n\n`,
  "utf-8",
);

/** Resolve a fake git response for a given argv (shared by sync + async + spawn). */
function fakeGit(args: string[]): Buffer | string {
  if (args[0] === "rev-parse") return `${FAKE_REPO_ROOT}\n`;
  if (args[0] === "log") {
    if (args.includes("--name-only") && args.includes("--format=%H")) {
      return NAMEONLY_LOG;
    }
    if (args.some((a) => a.startsWith("--format=%H%n"))) return META_LOG;
    return "";
  }
  if (args[0] === "cat-file") return CATFILE_OUT;
  if (args[0] === "show") return "fallback-show-content";
  return "";
}

const mocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
  execFile: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: mocks.execFileSync,
  execFile: mocks.execFile,
  spawn: mocks.spawn,
}));

function installFakeGit(): void {
  mocks.execFileSync.mockImplementation(
    (_cmd: string, args: string[]) => fakeGit(args),
  );

  // promisify(execFile) calls execFile(file, args, opts, callback) and (without
  // a custom symbol) resolves with the value passed as the 2nd callback arg.
  mocks.execFile.mockImplementation((...callArgs: unknown[]) => {
    const callback = callArgs[callArgs.length - 1] as (
      err: Error | null,
      result: { stdout: string; stderr: string },
    ) => void;
    const args = callArgs[1] as string[];
    const out = fakeGit(args);
    const stdout = typeof out === "string" ? out : out.toString("utf-8");
    callback(null, { stdout, stderr: "" });
  });

  // spawn("git", ["cat-file","--batch"], opts): emit the fixed batch buffer on
  // stdout, then close. stdin must accept write/end/on.
  mocks.spawn.mockImplementation(
    (_cmd: string, args: string[]) => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stdin: { write: () => void; end: () => void; on: () => void };
      };
      child.stdout = new EventEmitter();
      child.stdin = { write: () => {}, end: () => {}, on: () => {} };
      // Emit after the synchronous executor has attached its listeners.
      queueMicrotask(() => {
        child.stdout.emit("data", fakeGit(args) as Buffer);
        child.emit("close", 0);
      });
      return child;
    },
  );
}

beforeEach(() => {
  vi.resetModules(); // reset the module-level repoRootCache between cases
  mocks.execFileSync.mockReset();
  mocks.execFile.mockReset();
  mocks.spawn.mockReset();
  installFakeGit();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getDocHistoryAsync (#1986)", () => {
  it("produces output identical to the sync getDocHistory", async () => {
    const { getDocHistory, getDocHistoryAsync } = await import(
      "../git-history.js"
    );

    const sync = getDocHistory(ABS, "page", 50);
    const asyncResult = await getDocHistoryAsync(ABS, "page", 50);

    expect(asyncResult).toEqual(sync);
    // Sanity: it actually parsed the fixture (2 commits, real content).
    expect(asyncResult.entries).toHaveLength(2);
    expect(asyncResult.entries[0]).toMatchObject({
      hash: HASH_A,
      author: "Alice",
      content: "newest\n",
    });
    expect(asyncResult.entries[1]).toMatchObject({
      hash: HASH_B,
      content: "oldest\n",
    });
    expect(asyncResult).toMatchObject({ slug: "page", filePath: REL });
  });

  it("does the heavy git work via execFile / spawn, never execFileSync", async () => {
    const { getDocHistoryAsync } = await import("../git-history.js");
    await getDocHistoryAsync(ABS, "page", 50);

    // The only execFileSync call permitted is the cached `rev-parse` repo-root
    // probe — everything else (log, log --name-only, cat-file) is async.
    const syncCalls = mocks.execFileSync.mock.calls.map(
      (c) => (c[1] as string[])[0],
    );
    expect(syncCalls.every((cmd) => cmd === "rev-parse")).toBe(true);

    const asyncCmds = mocks.execFile.mock.calls.map(
      (c) => (c[1] as string[])[0],
    );
    expect(asyncCmds).toContain("log"); // metadata + name-only walks
    expect(mocks.spawn).toHaveBeenCalledTimes(1); // cat-file --batch
    expect((mocks.spawn.mock.calls[0]![1] as string[])).toEqual([
      "cat-file",
      "--batch",
    ]);
  });

  it("runs every async git command with cwd = repo root (#1907)", async () => {
    const { getDocHistoryAsync } = await import("../git-history.js");
    await getDocHistoryAsync(ABS, "page", 50);

    for (const call of mocks.execFile.mock.calls) {
      const opts = call[2] as { cwd?: string };
      expect(opts.cwd).toBe(FAKE_REPO_ROOT);
    }
    const spawnOpts = mocks.spawn.mock.calls[0]![2] as { cwd?: string };
    expect(spawnOpts.cwd).toBe(FAKE_REPO_ROOT);
  });

  it("returns empty entries for a file with no git history", async () => {
    const { getDocHistoryAsync } = await import("../git-history.js");
    // Make the metadata log empty (untracked / not yet committed).
    mocks.execFile.mockImplementation((...callArgs: unknown[]) => {
      const callback = callArgs[callArgs.length - 1] as (
        err: Error | null,
        result: { stdout: string; stderr: string },
      ) => void;
      callback(null, { stdout: "", stderr: "" });
    });

    const result = await getDocHistoryAsync(ABS, "page", 50);
    expect(result).toEqual({ slug: "page", filePath: REL, entries: [] });
  });
});
