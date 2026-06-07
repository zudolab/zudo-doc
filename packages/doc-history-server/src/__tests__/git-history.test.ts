import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock node:child_process so we can observe the options (especially `cwd`)
// passed to every git invocation without touching a real repo. This locks in
// the #1907 fix: under `pnpm --filter`, process.cwd() is the package dir, so
// all git commands must run with cwd = repo root or repo-relative pathspecs
// match nothing (0 entries).
const FAKE_REPO_ROOT = "/fake/repo/root";

const execFileSyncMock = vi.fn();

vi.mock("node:child_process", () => ({
  execFileSync: (...args: unknown[]) => execFileSyncMock(...args),
  // getFileCommitsMetaAsync (#1920) uses promisify(execFile); route async git
  // calls through the same mock so they observe the same cwd/stdout behaviour
  // as the sync path. Without an execFile export here, the module-level
  // promisify(execFile) throws at import.
  execFile: (...args: unknown[]) => {
    const callback = args[args.length - 1] as (
      err: Error | null,
      result: { stdout: string; stderr: string },
    ) => void;
    const [cmd, gitArgs, opts] = args as [string, string[], unknown];
    const stdout = String(execFileSyncMock(cmd, gitArgs, opts) ?? "");
    callback(null, { stdout, stderr: "" });
  },
  // getDocHistoryAsync's batchFetchContentsAsync (#1986) imports `spawn`. The
  // sync tests here never exercise the async batch path, but a full-module
  // factory mock must still export every binding git-history.ts imports —
  // otherwise `spawn` is undefined at module load. Async-path behaviour is
  // covered by git-history-async.test.ts; here `spawn` only needs to exist.
  spawn: () => {
    throw new Error(
      "spawn() should not be called by the sync git-history tests",
    );
  },
}));

// Default behaviour: `rev-parse --show-toplevel` returns the fake root; any
// other git command returns an empty string (so getDocHistory early-returns
// with no entries — we only care about the cwd here).
function installDefaultGit(): void {
  execFileSyncMock.mockImplementation(
    (_cmd: string, gitArgs: string[]) => {
      if (gitArgs[0] === "rev-parse") return `${FAKE_REPO_ROOT}\n`;
      return "";
    },
  );
}

beforeEach(() => {
  vi.resetModules(); // reset the module-level repoRootCache between cases
  execFileSyncMock.mockReset();
  installDefaultGit();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** All recorded git invocations except the `rev-parse --show-toplevel` probe. */
function gitCalls(): Array<{ args: string[]; opts: Record<string, unknown> }> {
  return execFileSyncMock.mock.calls
    .map((call) => ({
      args: call[1] as string[],
      opts: (call[2] ?? {}) as Record<string, unknown>,
    }))
    .filter((c) => c.args[0] !== "rev-parse");
}

describe("git-history cwd handling (#1907)", () => {
  it("getDocHistory runs git with cwd = repo root regardless of process.cwd()", async () => {
    const { getDocHistory } = await import("../git-history.js");
    getDocHistory("/some/abs/path/src/content/docs/page.mdx", "page");

    const calls = gitCalls();
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.opts["cwd"]).toBe(FAKE_REPO_ROOT);
    }
  });

  it("getFileCommits runs git with cwd = repo root", async () => {
    const { getFileCommits } = await import("../git-history.js");
    getFileCommits("/some/abs/path/page.mdx");

    const calls = gitCalls();
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.opts["cwd"]).toBe(FAKE_REPO_ROOT);
    }
  });

  it("getFirstCommit runs git with cwd = repo root", async () => {
    const { getFirstCommit } = await import("../git-history.js");
    getFirstCommit("/some/abs/path/page.mdx");

    const calls = gitCalls();
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.opts["cwd"]).toBe(FAKE_REPO_ROOT);
    }
  });

  it("getCommitInfo runs git with cwd = repo root", async () => {
    const { getCommitInfo } = await import("../git-history.js");
    getCommitInfo("deadbeef", "/some/abs/path/page.mdx");

    const calls = gitCalls();
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.opts["cwd"]).toBe(FAKE_REPO_ROOT);
    }
  });

  it("getFileCommitsMeta runs git with cwd = repo root", async () => {
    const { getFileCommitsMeta } = await import("../git-history.js");
    getFileCommitsMeta("/some/abs/path/page.mdx");

    const calls = gitCalls();
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.opts["cwd"]).toBe(FAKE_REPO_ROOT);
    }
  });

  it("getFileAtCommit runs every git command (including the rename fallbacks) with cwd = repo root", async () => {
    // Force the happy-path `git show` to fail so the rename-fallback chain
    // (which fires extra git commands) is exercised too.
    execFileSyncMock.mockImplementation(
      (_cmd: string, gitArgs: string[]) => {
        if (gitArgs[0] === "rev-parse") return `${FAKE_REPO_ROOT}\n`;
        if (gitArgs[0] === "show") throw new Error("missing object");
        return ""; // log fallbacks return empty -> no further show calls
      },
    );

    const { getFileAtCommit } = await import("../git-history.js");
    getFileAtCommit("deadbeef", "/some/abs/path/page.mdx");

    const calls = gitCalls();
    // At minimum: the failing `show` + the two rename-detection `log` calls.
    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const c of calls) {
      expect(c.opts["cwd"]).toBe(FAKE_REPO_ROOT);
    }
  });

  it("the cat-file --batch content fetch also runs with cwd = repo root", async () => {
    // Drive getDocHistory down the batched-content path by returning a real
    // metadata block from `git log` so it proceeds to cat-file --batch.
    execFileSyncMock.mockImplementation(
      (_cmd: string, gitArgs: string[]) => {
        if (gitArgs[0] === "rev-parse") return `${FAKE_REPO_ROOT}\n`;
        if (gitArgs[0] === "log") {
          // metadata format: %H%n%aI%n%aN%n%s%n  (record + blank-line separator)
          return "abc123\n2024-01-01T00:00:00Z\nAuthor\nmsg\n";
        }
        if (gitArgs[0] === "cat-file") {
          // header + body for one blob, then EOF
          return Buffer.from("abc123 blob 5\nhello\n");
        }
        return "";
      },
    );

    const { getDocHistory } = await import("../git-history.js");
    getDocHistory("/some/abs/path/page.mdx", "page");

    const catFile = gitCalls().filter((c) => c.args[0] === "cat-file");
    expect(catFile.length).toBeGreaterThan(0);
    for (const c of catFile) {
      expect(c.opts["cwd"]).toBe(FAKE_REPO_ROOT);
    }
  });
});
