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
  // batchFetchContentsAsync in git-history.ts imports `spawn`. These tests
  // never exercise that async path, but a full-module factory mock must export
  // every binding the module imports — otherwise `spawn` is undefined at module
  // load. Async-path behaviour is covered by git-history-async.test.ts.
  spawn: () => {
    throw new Error(
      "spawn() should not be called by the sync git-history tests",
    );
  },
}));

// Default behaviour: `rev-parse --show-toplevel` returns the fake root; any
// other git command returns an empty string. We only care about the cwd.
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
});
