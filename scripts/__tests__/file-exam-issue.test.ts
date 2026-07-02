import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, chmodSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// file-exam-issue.sh shells out to the real `gh` CLI. To unit-test its dedup
// / --green / per-workflow-scoping logic without hitting the network (or
// requiring a real GitHub token), these tests stub `gh` with a fake
// executable placed first on PATH. The fake logs every invocation (so tests
// can assert which gh subcommands ran) and, for `gh issue list`, returns a
// canned JSON payload controlled per-test via FAKE_ISSUE_LIST.

const SCRIPT_PATH = resolve(__dirname, "../file-exam-issue.sh");

const FAKE_GH_SCRIPT = `#!/usr/bin/env bash
set -euo pipefail
LOG="\${FAKE_GH_LOG:?FAKE_GH_LOG not set}"
printf '%s\\n' "$*" >> "$LOG"

if [[ "\${1:-}" == "issue" && "\${2:-}" == "list" ]]; then
  echo "\${FAKE_ISSUE_LIST:-[]}"
  exit 0
fi

exit 0
`;

describe("file-exam-issue.sh", () => {
  let workDir: string;
  let fakeBinDir: string;
  let logFile: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "file-exam-issue-test-"));
    fakeBinDir = join(workDir, "bin");
    execFileSync("mkdir", ["-p", fakeBinDir]);
    const ghPath = join(fakeBinDir, "gh");
    writeFileSync(ghPath, FAKE_GH_SCRIPT);
    chmodSync(ghPath, 0o755);
    logFile = join(workDir, "gh-calls.log");
    writeFileSync(logFile, "");
  });

  afterEach(() => {
    if (existsSync(workDir)) {
      rmSync(workDir, { recursive: true });
    }
  });

  function runScript(
    args: string[],
    opts: { issueList?: unknown[] } = {},
  ): { stdout: string; log: string } {
    const stdout = execFileSync("bash", [SCRIPT_PATH, ...args], {
      encoding: "utf-8",
      timeout: 15_000,
      env: {
        ...process.env,
        PATH: `${fakeBinDir}:${process.env.PATH}`,
        FAKE_GH_LOG: logFile,
        FAKE_ISSUE_LIST: JSON.stringify(opts.issueList ?? []),
        GITHUB_TOKEN: "dummy-token-for-tests",
      },
    });
    const log = readFileSync(logFile, "utf-8");
    return { stdout, log };
  }

  const RUN_URL = "https://github.com/zudolab/zudo-doc/actions/runs/999";
  const WORKFLOW_A = "Nightly Exam / Full E2E Tests";
  const WORKFLOW_B = "Nightly Exam / create-zudo-doc Slow Tests";

  // -------------------------------------------------------------------------
  // Failure mode (default)
  // -------------------------------------------------------------------------

  it("creates a new issue when no open issue exists for this workflow", () => {
    const { log } = runScript(["--run-url", RUN_URL, "--workflow", WORKFLOW_A], {
      issueList: [],
    });
    expect(log).toContain("issue create");
    expect(log).toContain(`[exam] Nightly suite failure: ${WORKFLOW_A}`);
    expect(log).not.toContain("issue comment");
  });

  it("comments on the existing open issue scoped to this workflow", () => {
    const { log } = runScript(["--run-url", RUN_URL, "--workflow", WORKFLOW_A], {
      issueList: [
        { number: 42, title: `[exam] Nightly suite failure: ${WORKFLOW_A}` },
      ],
    });
    expect(log).toContain("issue comment 42");
    expect(log).not.toContain("issue create");
  });

  it("per-workflow dedup: does not append to a different workflow's open issue", () => {
    const { log } = runScript(["--run-url", RUN_URL, "--workflow", WORKFLOW_A], {
      issueList: [
        { number: 7, title: `[exam] Nightly suite failure: ${WORKFLOW_B}` },
      ],
    });
    // WORKFLOW_B's issue exists but is NOT scoped to WORKFLOW_A — must create
    // a fresh issue for WORKFLOW_A, not comment on #7.
    expect(log).not.toContain("issue comment 7");
    expect(log).toContain("issue create");
    expect(log).toContain(`[exam] Nightly suite failure: ${WORKFLOW_A}`);
  });

  // -------------------------------------------------------------------------
  // --green mode
  // -------------------------------------------------------------------------

  it("--green closes the open issue scoped to this workflow", () => {
    const { log } = runScript(
      ["--run-url", RUN_URL, "--workflow", WORKFLOW_A, "--green"],
      {
        issueList: [
          { number: 42, title: `[exam] Nightly suite failure: ${WORKFLOW_A}` },
        ],
      },
    );
    expect(log).toContain("issue close 42");
    expect(log).toContain("--reason completed");
    // Green mode never creates a label or files a new failure issue.
    expect(log).not.toContain("label create");
    expect(log).not.toContain("issue create");
  });

  it("--green is a no-op when no issue is open for this workflow", () => {
    const { log, stdout } = runScript(
      ["--run-url", RUN_URL, "--workflow", WORKFLOW_A, "--green"],
      { issueList: [] },
    );
    expect(log).not.toContain("issue close");
    expect(log).not.toContain("issue comment");
    expect(log).not.toContain("issue create");
    expect(stdout).toContain("nothing to close");
  });

  it("--green per-workflow dedup: does not close a different workflow's open issue", () => {
    const { log } = runScript(
      ["--run-url", RUN_URL, "--workflow", WORKFLOW_B, "--green"],
      {
        issueList: [
          { number: 9, title: `[exam] Nightly suite failure: ${WORKFLOW_A}` },
        ],
      },
    );
    expect(log).not.toContain("issue close 9");
    expect(log).not.toContain("issue close");
  });
});
