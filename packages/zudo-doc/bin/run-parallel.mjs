#!/usr/bin/env node
// packages/zudo-doc/bin/run-parallel.mjs
//
// Runs several package.json scripts in parallel. Replaces the `run-p <task>...`
// form this project used from npm-run-all2, which was removed because it was the
// sole source of four security advisories (shell-quote quadratic-complexity DoS;
// brace-expansion@2 DoS x3) that nothing else in the tree pulled.
//
// Only the literal-name form is supported -- `run-parallel a b c`. npm-run-all2's
// globs (`dev:*`), flags, and `{@}` placeholders are deliberately NOT implemented;
// every call site here and in generated projects uses the plain form.
//
// Behaviour was checked against npm-run-all2@7.0.2 rather than assumed. It matches
// on the points that matter, and deviates on two, on purpose:
//
//   MATCHED
//   - A task exiting NON-ZERO aborts every sibling. A task exiting ZERO does not
//     (that is run-p's `--race`, off by default).
//   - A task killed by a signal reports 128 + signum, per the POSIX convention
//     Node documents for exit codes -- non-zero, so it aborts too.
//   - Only the FIRST failure is reported; siblings killed by the resulting
//     teardown stay quiet.
//   - The failure line matches run-p's wording, because packages/zudo-doc/CLAUDE.md
//     (#3129) quotes it verbatim as the signature of the accepted cascade:
//         ERROR: "dev:dts" exited with 1.
//
//   DELIBERATELY DIFFERENT
//   - Exit code: run-p ALWAYS exits 1 on failure. Its bin/common/bootstrap.js ends
//     with `.then(() => process.exit(0), () => process.exit(1))`, discarding the
//     code its own error object carries -- verified by running run-p 7.0.2 against
//     a task exiting 2: it printed `exited with 2` and returned 1. This script
//     propagates the real code instead, so a signal kill stays distinguishable
//     (137 for SIGKILL) rather than flattening to 1. Both are non-zero, so the
//     #3129 cascade behaves identically either way.
//   - Trailing args: run-p silently swallowed them, which is why a separate
//     `dev:network` script exists (#2940). Silently ignoring a flag the user
//     clearly meant is exactly the "quiet lie" #3129 argues against, so this
//     script fails loudly and names the remedy instead.
//
// The teardown cascade is the POINT, not a bug: root `pnpm dev` nests one of these
// inside another, so a fatal `dev:dts` exit takes down the whole dev session loudly
// rather than leaving a dead watcher emitting stale output. Do NOT add a
// --continue-on-error equivalent; #3129 rejects it explicitly (frozen .d.ts files
// typecheck cleanly against stale types).
//
// Two implementation choices that look incidental and are not:
//
//   1. Children are spawned WITHOUT `detached`, exactly as run-p did, so they stay
//      in this process's group. That keeps terminal job control working and lets a
//      child read the inherited TTY stdin: `zfb dev` is Vite-based and binds stdin
//      for its keyboard shortcuts. A child in its own group is not the terminal's
//      foreground group, so that same read raises SIGTTIN and stops it.
//   2. Teardown walks the full descendant tree rather than signalling just the
//      direct child. `pnpm run x` sits between us and the real watcher and does not
//      reliably forward SIGTERM, so signalling only the child strands it. Orphaned
//      watchers are not hypothetical here -- they accumulate until `inotify_init`
//      fails with EMFILE (see the #3129 section).

import { spawn, execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Platform-reported numbers rather than a hand-copied table, so the 128+signum
// arithmetic cannot drift from the host's actual signal set.
const SIGNAL_NUMBERS = os.constants.signals;

function usage(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.stderr.write(
    "Usage: run-parallel <script-name>...\n" +
      "Only literal script names are supported: no globs, no flags, and no\n" +
      "forwarded arguments. To pass flags to one script, run it directly:\n" +
      "  <npm|pnpm|yarn|bun> run <script> -- <flags>\n",
  );
  process.exit(1);
}

const tasks = process.argv.slice(2);

if (tasks.length === 0) {
  usage("no scripts given.");
}
for (const task of tasks) {
  // Reject anything resembling an npm-run-all2 feature that was not ported, so a
  // stale `run-p --continue-on-error`, or a `pnpm dev -- --host 0.0.0.0` that used
  // to be swallowed, fails loudly instead of being taken for a script name.
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
 * a JS file, since a `.cjs` shim is not directly executable everywhere.
 */
function resolveRunner() {
  const execpath = process.env.npm_execpath;
  if (execpath) {
    if (/\.(c|m)?js$/.test(path.extname(execpath))) {
      return { command: process.execPath, prefix: [execpath, "run"] };
    }
    return { command: execpath, prefix: ["run"] };
  }
  // Fallback covers all four package managers create-zudo-doc can scaffold.
  const agent = process.env.npm_config_user_agent ?? "";
  const name =
    ["pnpm", "yarn", "bun"].find((pm) => agent.startsWith(pm)) ?? "npm";
  return { command: name, prefix: ["run"] };
}

/**
 * Collect a process and all of its descendants, parents before children, so a
 * caller can signal the whole tree. Reads /proc directly on Linux (no subprocess,
 * and this runs on a teardown path where spawning is least welcome) and falls back
 * to `ps` elsewhere, notably macOS.
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
let signalCount = 0;

function signalTree(child, signal) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  // `pid` is undefined when the spawn itself failed. There is no tree to walk,
  // and passing it through would print a bogus "could not signal pid undefined"
  // line (or run `taskkill /pid undefined`) on an already-failing teardown.
  if (child.pid === undefined) return;

  if (process.platform === "win32") {
    // Windows has no process groups to signal; taskkill /T walks the tree.
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } catch {
      // Already gone, or not ours to kill. Nothing actionable on teardown.
    }
    return;
  }

  // collectTree yields parents before children; reversing signals the deepest
  // descendants first, so an intermediate `pnpm run x` is not left briefly
  // holding a still-live grandchild it does not forward signals to.
  for (const pid of collectTree(child.pid).reverse()) {
    try {
      process.kill(pid, signal);
    } catch (error) {
      // ESRCH just means it already exited, which is the common case in a tree
      // that is collapsing anyway. Anything else is worth a line, but must never
      // mask the original failure by throwing here.
      if (error.code !== "ESRCH") {
        process.stderr.write(
          `run-parallel: could not signal pid ${pid}: ${error.code ?? error.message}\n`,
        );
      }
    }
  }
}

function tearDown(signal = "SIGTERM") {
  if (tearingDown) return;
  tearingDown = true;
  for (const child of running.values()) signalTree(child, signal);
}

for (const task of tasks) {
  const child = spawn(runner.command, [...runner.prefix, task], {
    stdio: "inherit",
    // No `detached` -- see the header note. Children share this process group so
    // terminal job control works and they can read the inherited TTY stdin.
  });
  running.set(task, child);

  child.on("error", (error) => {
    running.delete(task);
    if (!firstFailure) {
      firstFailure = { task, code: 1 };
      process.stderr.write(
        `ERROR: "${task}" failed to start: ${error.message}\n`,
      );
    }
    tearDown();
    if (running.size === 0) process.exitCode = firstFailure.code;
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

// A terminal-generated Ctrl+C already reached the children directly, since they
// share this process group -- but a signal aimed at this pid alone did not, and
// without forwarding it that case would leave every child running. Re-signalling
// a child that is already dying is harmless (ESRCH is ignored above).
for (const name of ["SIGINT", "SIGTERM", "SIGHUP", "SIGQUIT"]) {
  process.on(name, () => {
    signalCount += 1;
    // Escalate if a second signal arrives: something is refusing to shut down,
    // and hanging here would strand exactly the watchers this script exists to
    // reap. `tearingDown` is reset so the second pass is not short-circuited.
    const forwarded = signalCount > 1 ? "SIGKILL" : name;
    tearingDown = false;
    tearDown(forwarded);
  });
}
