// Subprocess tests for `bin/run-parallel.mjs`, the package-owned replacement for
// npm-run-all2's `run-p` (removed because it was the sole source of four
// advisories: shell-quote quadratic DoS, brace-expansion@2 DoS x3).
//
// These run the real bin against a throwaway package.json the same way a consumer
// would, because the whole contract is process behaviour — exit codes and whether
// siblings actually die. None of it is observable from a pure unit test.
//
// The behaviour locked here was checked against npm-run-all2@7.0.2, and it is
// load-bearing: packages/zudo-doc/CLAUDE.md (#3129) documents the resulting
// dev-session teardown cascade as ACCEPTED behaviour, so a regression that made a
// failure quiet would silently invalidate that contract. Note that the exit CODE
// is an intentional improvement over run-p rather than parity -- see the comment
// in the abort test.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync, spawn as spawnProc } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.resolve(__dirname, "../../bin/run-parallel.mjs");

// Kept well under vitest.config.ts's 30s testTimeout so this specific, diagnosable
// deadline fires before the blunt one (see the ordering invariant documented there).
const SPAWN_TIMEOUT = 20_000;

// The long task outlives run-parallel on purpose: the teardown assertion is that
// its marker never appears, which only holds if the grandchild was truly killed.
const LONG_TASK_MS = 4000;
const ORPHAN_GRACE_MS = LONG_TASK_MS + 2500;

let dir: string;

const write = (file: string) =>
  `node -e "require('fs').writeFileSync('${file}','1')"`;
const writeAfter = (file: string, ms: number) =>
  `node -e "setTimeout(()=>require('fs').writeFileSync('${file}','1'),${ms})"`;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "run-parallel-"));
  await fs.writeJson(path.join(dir, "package.json"), {
    name: "run-parallel-fixture",
    version: "1.0.0",
    private: true,
    scripts: {
      "ok:a": write("a.done"),
      "ok:b": write("b.done"),
      "fail:three": 'node -e "process.exit(3)"',
      // Dies BY a signal rather than exiting, to exercise the 128+signum path.
      "suicide:term": 'node -e "process.kill(process.pid,\'SIGTERM\')"',
      // A coordinator nested inside a coordinator — the #3129 two-hop shape.
      nested: `node "${BIN}" fail:three`,
      long: writeAfter("long.done", LONG_TASK_MS),
    },
  });
});

afterEach(async () => {
  await fs.remove(dir);
});

const run = (...args: string[]) =>
  spawnSync(process.execPath, [BIN, ...args], {
    cwd: dir,
    encoding: "utf8",
    timeout: SPAWN_TIMEOUT,
  });

const exists = (file: string) => fs.pathExists(path.join(dir, file));

describe("run-parallel", () => {
  it("runs every task and exits 0 when all succeed", async () => {
    const result = run("ok:a", "ok:b");
    expect(result.status).toBe(0);
    expect(await exists("a.done")).toBe(true);
    expect(await exists("b.done")).toBe(true);
  });

  it("aborts siblings and exits with the failing task's code", async () => {
    const result = run("fail:three", "long");

    // DELIBERATE DIVERGENCE, not parity: run-p always exits 1 here, because its
    // bin/common/bootstrap.js ends with
    //   .then(() => process.exit(0), () => process.exit(1))
    // discarding the code its own error object carries. Verified by running
    // run-p 7.0.2 against a task exiting 2 -- it printed `exited with 2` and
    // returned 1. Propagating the real code keeps a signal kill distinguishable.
    expect(result.status).toBe(3);
    // CLAUDE.md #3129 quotes this exact wording as the cascade's signature.
    expect(result.stderr).toContain('ERROR: "fail:three" exited with 3.');

    // The real assertion: `pnpm run long` sits between us and the node process
    // that writes the marker. Killing only the direct child would strand that
    // grandchild, which would then still write long.done after LONG_TASK_MS.
    // Orphaned watchers are not hypothetical here — they accumulate until
    // inotify_init fails with EMFILE (#3129).
    await delay(ORPHAN_GRACE_MS);
    expect(await exists("long.done")).toBe(false);
  });

  it("does NOT abort siblings when a task exits zero", async () => {
    // npm-run-all2 aborts on a zero exit only under `--race`, which is off by
    // default — so a short task finishing must leave a long one running.
    const result = run("ok:a", "long");
    expect(result.status).toBe(0);
    expect(await exists("a.done")).toBe(true);
    expect(await exists("long.done")).toBe(true);
  });

  it("rejects flags rather than treating them as script names", () => {
    const result = run("--continue-on-error", "ok:a");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("flags are not supported");
    // #3129 rejects continue-on-error outright; failing loudly here keeps a
    // stale invocation from being mistaken for a script of that name.
  });

  it("rejects globs, which are deliberately not implemented", () => {
    const result = run("dev:*");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("glob patterns are not supported");
  });

  it("errors when given no tasks", () => {
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no scripts given");
  });
  it("reports 128+signum when a task is killed by a signal", async () => {
    // The arithmetic that makes a signal kill non-zero (and so abort siblings).
    // 143 = 128 + SIGTERM(15).
    const result = run("suicide:term", "long");
    expect(result.status).toBe(143);
    expect(result.stderr).toContain('ERROR: "suicide:term" exited with 143.');
    await delay(ORPHAN_GRACE_MS);
    expect(await exists("long.done")).toBe(false);
  });

  it("forwards a signal aimed at the coordinator alone to its children", async () => {
    // Ctrl+C reaches children directly via the shared process group, but a signal
    // sent to this pid only does not -- without forwarding, every child would keep
    // running. This is the case that used to leak.
    const child = spawnProc(process.execPath, [BIN, "long"], {
      cwd: dir,
      stdio: "ignore",
    });
    await delay(1500);
    // ChildProcess.pid is optional in the type: it is undefined when the spawn
    // itself failed, which would make the assertions below vacuously pass.
    const { pid } = child;
    if (pid === undefined) throw new Error("coordinator failed to spawn");
    process.kill(pid, "SIGTERM");
    await delay(ORPHAN_GRACE_MS);
    expect(await exists("long.done")).toBe(false);
  });

  it("propagates a failure through a nested coordinator (the #3129 two-hop cascade)", async () => {
    // Root `pnpm dev` nests one run-parallel inside another; #3129 depends on a
    // fatal exit travelling BOTH hops. Anything that swallowed the inner failure
    // would leave a half-dead dev session looking healthy.
    const result = run("nested", "long");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('ERROR: "fail:three" exited with 3.');
    expect(result.stderr).toContain('ERROR: "nested" exited with');
    await delay(ORPHAN_GRACE_MS);
    expect(await exists("long.done")).toBe(false);
  });

  it("ships the bin from the package so scaffolded projects resolve it", async () => {
    // The whole no-new-devDependency argument rests on this mapping existing and
    // on `bin` being packed; a rename or a files/ regression would silently break
    // every generated project's dev script.
    const pkg = await fs.readJson(path.resolve(__dirname, "../../package.json"));
    expect(pkg.bin["run-parallel"]).toBe("./bin/run-parallel.mjs");
    expect(pkg.files).toContain("bin");
    expect(await fs.pathExists(BIN)).toBe(true);
  });
});
