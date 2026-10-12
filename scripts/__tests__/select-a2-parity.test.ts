import { afterEach, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

// Every case runs the real entrypoint against a synthetic Git history, offline:
// the recorded #4524 path set replays without its original commits.
const root = resolve(import.meta.dirname, "../..");
const detector = join(root, "scripts/select-a2-parity.mjs");
const release4524 = JSON.parse(
  readFileSync(join(root, "scripts/__tests__/fixtures/a2-selection-4524-paths.json"), "utf8"),
) as { source: string; releaseCommit: string; paths: string[] };

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function repo(initial: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "a2-selection-"));
  dirs.push(dir);
  const git = (...args: string[]) => {
    // git >= 2.47 detaches auto-maintenance after commit; a background pack write
    // into .git/objects/pack then races afterEach's rmSync (ENOTEMPTY, PR #4544).
    const quiet = ["-c", "maintenance.auto=false", "-c", "gc.auto=0"];
    const run = spawnSync("git", [...quiet, ...args], { cwd: dir, encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
    return run.stdout.trim();
  };
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  const commit = (message: string) => {
    git("add", "-A");
    git("-c", "user.name=Gate Control", "-c", "user.email=gate@example.invalid", "commit", "-qm", message);
    return git("rev-parse", "HEAD");
  };
  git("init", "-q");
  for (const path of initial) write(path, `base ${path}\n`);
  write(".keep", "base\n");
  const base = commit("base");
  return { dir, git, write, commit, base };
}

function select(dir: string, baseSha: string | undefined) {
  const output = join(dir, ".git/github-output");
  const summary = join(dir, ".git/step-summary");
  const env: NodeJS.ProcessEnv = { ...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary };
  delete env.BASE_SHA;
  delete env.HEAD_REF;
  if (baseSha !== undefined) env.BASE_SHA = baseSha;
  const run = spawnSync(process.execPath, [detector], { cwd: dir, encoding: "utf8", env });
  return {
    status: run.status,
    log: run.stdout + run.stderr,
    output: existsSync(output) ? readFileSync(output, "utf8") : "",
    summary: existsSync(summary) ? readFileSync(summary, "utf8") : "",
  };
}

function changeOnly(paths: string[]) {
  const r = repo(paths);
  for (const path of paths) r.write(path, `changed ${path}\n`);
  r.commit("change");
  return select(r.dir, r.base);
}

describe("#4528 A2 input selection (real detector, synthetic histories)", () => {
  it("records the #4524 provenance it replays", () => {
    expect(release4524.source).toBe("https://github.com/zudolab/zudo-doc/pull/4524");
    expect(release4524.releaseCommit).toBe("b4f974598b27064a092eeadb5b2e5559078a8bb9");
    expect(release4524.paths).toHaveLength(31);
  });

  it("runs for the actual #4524 changed-path set", () => {
    const result = changeOnly(release4524.paths);
    expect(result.status, result.log).toBe(0);
    expect(result.output).toContain("run_parity=true\n");
    expect(result.log).toContain("A2 input changed [toolchain]: package.json");
    expect(result.log).toContain("A2 input changed [linked-package]: packages/zudo-doc/package.json");
    expect(result.log).toContain("A2 input changed [toolchain]: pnpm-lock.yaml");
    expect(result.summary).toMatch(/^A2 decision: RUN \(/);
  });

  it.each([
    ["packages/zudo-doc/package.json", "linked-package"],
    ["packages/zudo-doc/src/preset.ts", "linked-package"],
    ["packages/zudo-doc/README.md", "linked-package"],
    ["packages/zudo-doc/CLAUDE.md", "linked-package"],
    ["packages/zudo-doc/src/__tests__/fixtures/route-injection/zfb.config.ts", "linked-package"],
    ["packages/doc-history-server/src/index.ts", "workspace-dependency"],
    ["package.json", "toolchain"],
    ["pnpm-lock.yaml", "toolchain"],
    ["pnpm-workspace.yaml", "toolchain"],
    [".npmrc", "toolchain"],
    [".nvmrc", "toolchain"],
    ["tsconfig.json", "toolchain"],
    ["scripts/parity-html-normalize.mjs", "fixture-contract"],
    ["scripts/__tests__/fixtures/a2-route-reference.json", "fixture-contract"],
    ["scripts/a2-causal-diff.py", "evidence-maintenance"],
    ["scripts/__tests__/a2-causal-diff.test.ts", "evidence-maintenance"],
    ["scripts/__tests__/fixtures/a2-causal-source-packs.json", "evidence-maintenance"],
    [".github/workflows/pr-checks.yml", "gate-execution"],
    [".github/actions/setup-node-pnpm/action.yml", "gate-execution"],
    ["scripts/ensure-workspace-build.mjs", "gate-execution"],
    ["scripts/select-a2-parity.mjs", "gate-execution"],
  ])("runs when only %s changes", (path, category) => {
    const result = changeOnly([path]);
    expect(result.status, result.log).toBe(0);
    expect(result.output).toBe(`run_parity=true\nmatched_category=${category}\nmatched_path=${path}\n`);
    expect(result.summary).toBe(`A2 decision: RUN (${category}: ${path}; 1 matched input path(s))\n`);
  });

  it.each([
    ["README.md"],
    ["src/content/docs/guides/migrating-to-zudo-doc-6.mdx"],
    ["src/content/docs-ja/guides/migrating-to-zudo-doc-6.mdx"],
    ["packages/zudo-doc-other/package.json"],
    ["scripts/parity-html-normalize.mjs.bak"],
    ["scripts/a2-causal-diff.py.bak"],
  ])("skips cheaply when only unrelated %s changes", (path) => {
    const result = changeOnly([path]);
    expect(result.status, result.log).toBe(0);
    expect(result.output).toBe("run_parity=false\nmatched_category=\nmatched_path=\n");
    expect(result.summary).toBe("A2 decision: SKIP (no A2 build input changed)\n");
  });

  it("runs for an added linked-package file", () => {
    const r = repo([]);
    r.write("packages/zudo-doc/src/new-module.ts", "export {};\n");
    r.commit("add");
    expect(select(r.dir, r.base).output).toContain("run_parity=true\n");
  });

  it("runs for a deletion inside a covered path", () => {
    const r = repo(["packages/zudo-doc/src/old.ts"]);
    r.git("rm", "-q", "packages/zudo-doc/src/old.ts");
    r.commit("delete");
    const result = select(r.dir, r.base);
    expect(result.output).toContain("matched_path=packages/zudo-doc/src/old.ts\n");
  });

  it("runs for a rename out of a covered path", () => {
    const r = repo(["packages/zudo-doc/src/moved.ts"]);
    mkdirSync(join(r.dir, "docs"), { recursive: true });
    r.git("mv", "packages/zudo-doc/src/moved.ts", "docs/moved.ts");
    r.commit("rename out");
    const result = select(r.dir, r.base);
    expect(result.output).toContain("run_parity=true\n");
    expect(result.log).toContain("A2 input changed [linked-package]: packages/zudo-doc/src/moved.ts");
  });

  it("runs for a rename into a covered path", () => {
    const r = repo(["notes/helper.ts"]);
    mkdirSync(join(r.dir, "packages/zudo-doc/src"), { recursive: true });
    r.git("mv", "notes/helper.ts", "packages/zudo-doc/src/helper.ts");
    r.commit("rename in");
    expect(select(r.dir, r.base).output).toContain("matched_path=packages/zudo-doc/src/helper.ts\n");
  });

  it("runs when the external reference is the only change", () => {
    const result = changeOnly(["scripts/__tests__/fixtures/a2-route-reference.json"]);
    expect(result.output).toContain("matched_category=fixture-contract\n");
  });

  it("compares against the merge base, not the moving base tip", () => {
    const r = repo(["packages/zudo-doc/src/a.ts"]);
    r.git("checkout", "-qb", "topic");
    r.write("README.md", "topic docs\n");
    r.commit("topic docs");
    r.git("checkout", "-q", "-");
    r.write("packages/zudo-doc/src/a.ts", "base moved on\n");
    const movedBase = r.commit("base advances");
    r.git("checkout", "-q", "topic");
    expect(select(r.dir, movedBase).output).toContain("run_parity=false\n");
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["unknown", "0123456789abcdef0123456789abcdef01234567"],
    ["invalid", "not-a-ref"],
  ])("fails without a decision when the base is %s", (_label, baseSha) => {
    const r = repo([]);
    r.write("README.md", "x\n");
    r.commit("change");
    const result = select(r.dir, baseSha);
    expect(result.status).toBe(2);
    expect(result.log).toContain("::error::A2 selection failed");
    expect(result.output).toBe("");
    expect(result.summary).toBe("");
  });

  it("fails when the diff has no merge base", () => {
    const r = repo([]);
    r.git("checkout", "-q", "--orphan", "unrelated");
    r.write("README.md", "unrelated\n");
    r.commit("unrelated root");
    const result = select(r.dir, r.base);
    expect(result.status).toBe(2);
    expect(result.output).toBe("");
  });

  it("fails outside a Git repository", () => {
    const dir = mkdtempSync(join(tmpdir(), "a2-selection-nogit-"));
    dirs.push(dir);
    const result = select(dir, "HEAD");
    expect(result.status).toBe(2);
    expect(result.output).toBe("");
  });

  it("works from a copied entrypoint with no node_modules", () => {
    const r = repo([]);
    cpSync(detector, join(r.dir, "scripts/select-a2-parity.mjs"));
    r.commit("detector");
    const base = r.git("rev-parse", "HEAD");
    r.write("pnpm-lock.yaml", "lock\n");
    r.commit("lock");
    const env = { ...process.env, BASE_SHA: base, GITHUB_OUTPUT: join(r.dir, ".git/out") };
    const run = spawnSync(process.execPath, ["scripts/select-a2-parity.mjs"], { cwd: r.dir, encoding: "utf8", env });
    expect(run.status, run.stderr).toBe(0);
    expect(readFileSync(join(r.dir, ".git/out"), "utf8")).toContain("matched_path=pnpm-lock.yaml\n");
  });
});
