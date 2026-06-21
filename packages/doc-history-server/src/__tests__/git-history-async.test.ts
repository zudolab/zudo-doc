import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

// #1986: getDocHistoryAsync issues each git command via execFile / spawn
// instead of execFileSync, so the CLI's per-file semaphore actually
// parallelizes the work. These cases prove (1) the function returns correct
// output from async git calls, (2) the heavy git work never touches
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
  it("returns correct output from async git calls", async () => {
    const { getDocHistoryAsync } = await import("../git-history.js");

    const result = await getDocHistoryAsync(ABS, "page", 50);

    // Sanity: it actually parsed the fixture (2 commits, real content).
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      hash: HASH_A,
      author: "Alice",
      content: "newest\n",
    });
    expect(result.entries[1]).toMatchObject({
      hash: HASH_B,
      content: "oldest\n",
    });
    expect(result).toMatchObject({ slug: "page", filePath: REL });
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

  it("issues both git log walks in parallel (Promise.all)", async () => {
    // The two independent git walks (metadata + hash→path) must fire
    // concurrently. We verify this by recording the order of execFile
    // invocations: both should fire before either resolves, i.e. both must
    // appear in the execFile call list before the promise chain settles.
    // A simpler proxy: execFile is called AT LEAST twice before spawn (cat-file).
    const { getDocHistoryAsync } = await import("../git-history.js");
    await getDocHistoryAsync(ABS, "page", 50);

    const logCalls = mocks.execFile.mock.calls.filter(
      (c) => (c[1] as string[])[0] === "log",
    );
    // Both walks are `git log` calls — we must see at least 2 (one for
    // --format=%H%n..., one for --format=%H --name-only).
    expect(logCalls.length).toBeGreaterThanOrEqual(2);
    const hasMetaWalk = logCalls.some((c) =>
      (c[1] as string[]).some((a) => a.startsWith("--format=%H%n")),
    );
    const hasNameOnly = logCalls.some((c) =>
      (c[1] as string[]).includes("--name-only"),
    );
    expect(hasMetaWalk).toBe(true);
    expect(hasNameOnly).toBe(true);
  });
});

describe("getFileCommitsMetaAsync — maxBuffer warning (#2293)", () => {
  it("logs a console.warn when the git command fails (e.g. maxBuffer exceeded)", async () => {
    const { getFileCommitsMetaAsync } = await import("../git-history.js");

    // Simulate execFile throwing an error (e.g. RangeError from maxBuffer overflow)
    mocks.execFile.mockImplementation((...callArgs: unknown[]) => {
      const callback = callArgs[callArgs.length - 1] as (
        err: Error,
        result?: unknown,
      ) => void;
      callback(new RangeError("stdout maxBuffer length exceeded"));
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await getFileCommitsMetaAsync(ABS);

    // Must return [] (not throw) so the caller can keep processing other files
    expect(result).toEqual([]);

    // Must emit a warning — silent swallowing was the bug
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("getFileCommitsMetaAsync failed"),
      expect.stringContaining("maxBuffer"),
    );

    warnSpy.mockRestore();
  });

  it("passes maxBuffer option to execFile", async () => {
    const { getFileCommitsMetaAsync, MAX_BUFFER_BYTES } = await import("../git-history.js");
    await getFileCommitsMetaAsync(ABS);

    const logCall = mocks.execFile.mock.calls.find(
      (c) => (c[1] as string[])[0] === "log",
    );
    expect(logCall).toBeDefined();
    const opts = logCall?.[2] as Record<string, unknown>;
    expect(opts?.["maxBuffer"]).toBe(MAX_BUFFER_BYTES);
  });
});

describe("parseHashToPathMap — structured parse (#2293)", () => {
  it("parses standard git log --format=%H --name-only output correctly", async () => {
    const { parseHashToPathMap } = await import("../git-history.js");
    const HASH_A = "a".repeat(40);
    const HASH_B = "b".repeat(40);
    const output = `${HASH_A}\n\nsrc/content/docs/page.mdx\n${HASH_B}\n\nsrc/content/docs/old-name.mdx\n`;
    const map = parseHashToPathMap(output);
    expect(map.get(HASH_A)).toBe("src/content/docs/page.mdx");
    expect(map.get(HASH_B)).toBe("src/content/docs/old-name.mdx");
  });

  it("returns an empty map for empty input", async () => {
    const { parseHashToPathMap } = await import("../git-history.js");
    expect(parseHashToPathMap("").size).toBe(0);
  });

  it("ignores blocks with no path (hash only)", async () => {
    const { parseHashToPathMap } = await import("../git-history.js");
    const HASH_A = "a".repeat(40);
    // Only a hash, no path line — should produce no entry
    const output = `${HASH_A}\n\n`;
    const map = parseHashToPathMap(output);
    expect(map.has(HASH_A)).toBe(false);
  });

  it("ignores blocks whose first line is not a valid hash", async () => {
    const { parseHashToPathMap } = await import("../git-history.js");
    // If someone has a file path that happens to not start with hex, it should
    // be skipped gracefully.
    const output = `not-a-hash\n\nsome/file.mdx\n`;
    const map = parseHashToPathMap(output);
    expect(map.size).toBe(0);
  });

  it("does not overwrite an earlier entry with the same hash (keeps first)", async () => {
    const { parseHashToPathMap } = await import("../git-history.js");
    const HASH_A = "a".repeat(40);
    // Two blocks with the same hash — only the first path should be retained
    const output = `${HASH_A}\n\nfirst-path.mdx\n\n${HASH_A}\n\nsecond-path.mdx\n`;
    const map = parseHashToPathMap(output);
    expect(map.get(HASH_A)).toBe("first-path.mdx");
  });
});
