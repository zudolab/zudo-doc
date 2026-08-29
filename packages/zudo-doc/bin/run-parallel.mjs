#!/usr/bin/env node
// packages/zudo-doc/bin/run-parallel.mjs
//
// Runs several package.json scripts in parallel. Drop-in replacement for the
// `run-p <task>...` form this project used from npm-run-all2, which was removed
// because it was the sole source of four security advisories (shell-quote
// quadratic-complexity DoS; brace-expansion@2 DoS x3) that nothing else pulled.
//
// Only the literal-name form is supported -- `run-parallel a b c`. npm-run-all2's
// globs (`dev:*`), flags, and `{@}` placeholders are deliberately NOT implemented;
// every call site in this repo and in generated projects uses the plain form.
//
// Behaviour is matched against npm-run-all2@7.0.2 lib/run-tasks.js, not assumed:
//
//   - A task exiting NON-ZERO aborts every sibling and this process exits with
//     that task's code. A task exiting ZERO does NOT abort siblings (that is
//     run-p's `--race`, off by default).
//   - A task killed by a signal reports 128 + signum, per the POSIX convention
//     Node documents for process exit codes -- non-zero, so it aborts too.
//   - The failure line matches run-p's wording, because packages/zudo-doc/CLAUDE.md
//     (#3129) quotes it verbatim as the signature of the accepted teardown cascade:
//         ERROR: "dev:dts" exited with 1.
//
// The teardown cascade is the POINT, not a bug: root `pnpm dev` nests one of these
// inside another, so a fatal `dev:dts` exit takes down the whole dev session loudly
// rather than leaving a dead watcher emitting stale output. Do NOT add a
// --continue-on-error equivalent; #3129 rejects it explicitly (frozen .d.ts files
// typecheck cleanly against stale types -- a quiet lie beats no crash at all).
//
// Two implementation choices that look incidental and are not:
//
//   1. Children are spawned WITHOUT `detached`, so they stay in this process's
//      group -- exactly what run-p did. That keeps Ctrl+C working (the terminal
//      signals the whole foreground group) and, critically, lets a child read the
//      inherited TTY stdin: `zfb dev` is Vite-based and binds stdin for its
//      keyboard shortcuts. A detached child is not in the foreground group, so
//      that same read would raise SIGTTIN and stop the process.
//   2. Teardown walks the full descendant tree instead of signalling just the
//      direct child. `pnpm run x` sits between us and the real watcher, and does
//      not reliably forward SIGTERM; killing only the direct child strands the
//      watcher. Orphaned watchers are not hypothetical here -- they accumulate
//      until `inotify_init` fails with EMFILE (see the #3129 section).
//
// Trailing arguments are intentionally NOT forwarded to the tasks. run-p swallowed
// them too, which is the whole reason a separate `dev:network` script exists
// (verified in issue #2940) -- forwarding them here would silently change what
// `pnpm dev -- --host 0.0.0.0` does.

import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const SIGNAL_NUMBERS = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGQUIT: 3,
  SIGILL: 4,
  SIGTRAP: 5,
  SIGABRT: 6,
  SIGFPE: 8,
  SIGKILL: 9,
  SIGSEGV: 11,
  SIGPIPE: 13,
  SIGALRM: 14,
  SIGTERM: 15,
};

function usage(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.stderr.write(
    "Usage: run-parallel <script-name>...\n" +
      "Only literal script names are supported (no globs, flags, or forwarded args).\n",
  );
  process.exit(1);
}

const tasks = process.argv.slice(2);

if (tasks.length === 0) {
  usage("no scripts given.");
}
for (const task of tasks) {
  // Reject anything that looks like an npm-run-all2 feature we did not port, so a
  // stale `run-p --continue-on-error` or `dev:*` fails loudly instead of being
  // mistaken for a script literally named `--continue-on-error`.
  if (task.startsWith("-")) {
    usage(`flags are not supported, got ${JSON.stringify(task)}.`);
  }
  if (task.includes("*")) {
    usage(`glob patterns are not supported, got ${JSON.stringify(task)}.`);
  }
}

/**
 * Resolve the package-manager command used to run a script, mirroring how
 * npm-run-all2 did it: prefer `npm_execpath` (set by every package manager while
 * running a script), and run it through the current Node binary when it points at
 * a JS file, since a `.cjs` shim is not directly executable on every platform.
 */
function resolveRunner() {
  const execpath = process.env.npm_execpath;
  if (execpath) {
    if (/\.(c|m)?js$/.test(path.extname(execpath))) {
      return { command: process.execPath, prefix: [execpath, "run"] };
    }
    return { command: execpath, prefix: ["run"] };
  }
  const agent = process.env.npm_config_user_agent ?? "";
  const name = agent.startsWith("pnpm")
    ? "pnpm"
    : agent.startsWith("yarn")
      ? "yarn"
      : "npm";
  return { command: name, prefix: ["run"] };
}

/**
 * Collect a process and all of its descendants, deepest last, so a caller can
 * signal the whole tree. Reads /proc directly on Linux (no subprocess, and this
 * runs on a teardown path where spawning is least welcome) and falls back to `ps`
 * elsewhere, notably macOS.
 */
function collectTree(rootPid) {
  const childrenByParent = new Map();
  const record = (pid, ppid) => {
    if (!Number.isInteger(pid) || !Number.isInteger(ppid)) return;
    const siblings = childrenByParent.get(ppid);
    if (siblings) siblings.push(pid);
    else childrenByParent.set(ppid, [pid]);
  };

  try {
    if (process.platform === "linux") {
      for (const entry of readdirSync("/proc")) {
        if (!/^\d+$/.test(entry)) continue;
        let stat;
        try {
          stat = readFileSync(`/proc/${entry}/stat`, "utf8");
        } catch {
          continue; // the process exited between readdir and read
        }
        // The comm field is parenthesised and may itself contain spaces or
        // parentheses, so split after the LAST ')' rather than on whitespace.
        const tail = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
        record(Number(entry), Number(tail[1]));
      }
    } else {
      const out = execFileSync("ps", ["-Ao", "pid=,ppid="], {
        encoding: "utf8",
      });
      for (const line of out.split("\n")) {
        const [pid, ppid] = line.trim().split(/\s+/);
        record(Number(pid), Number(ppid));
      }
    }
  } catch {
    // Enumeration failed; fall through and signal just the root below.
  }

  const ordered = [];
  const walk = (pid) => {
    ordered.push(pid);
    for (const child of childrenByParent.get(pid) ?? []) walk(child);
  };
  walk(rootPid);
  return ordered;
}

const runner = resolveRunner();

/** @type {Map<string, import("node:child_process").ChildProcess>} */
const running = new Map();
let firstFailure = null;
let tearingDown = false;

function terminate(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  for (const pid of collectTree(child.pid).reverse()) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // ESRCH: already gone. EPERM: not ours to signal. Neither is actionable
      // on a teardown path, and neither should mask the original failure.
    }
  }
}

function tearDown() {
  if (tearingDown) return;
  tearingDown = true;
  for (const child of running.values()) terminate(child);
}

for (const task of tasks) {
  const child = spawn(runner.command, [...runner.prefix, task], {
    stdio: "inherit",
    // No `detached` -- see the header note. Children share this process group so
    // Ctrl+C reaches them and they can read the inherited TTY stdin.
  });
  running.set(task, child);

  child.on("error", (error) => {
    running.delete(task);
    if (!firstFailure) {
      firstFailure = { task, code: 1 };
      process.stderr.write(`ERROR: "${task}" failed to start: ${error.message}\n`);
    }
    tearDown();
  });

  child.on("close", (code, signal) => {
    running.delete(task);
    const exitCode =
      code === null ? 128 + (SIGNAL_NUMBERS[signal] ?? 0) : code;

    if (exitCode !== 0 && !firstFailure) {
      firstFailure = { task, code: exitCode };
      process.stderr.write(`ERROR: "${task}" exited with ${exitCode}.\n`);
      tearDown();
    }

    if (running.size === 0) {
      process.exitCode = firstFailure ? firstFailure.code : 0;
    }
  });
}

// Ctrl+C already reached the children directly (same process group), so do not
// signal them again -- just stop launching work and let their `close` handlers
// settle the exit code.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    tearingDown = true;
  });
}
