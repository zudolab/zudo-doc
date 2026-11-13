// Regression tests for the Actions release path (#4762): server-side admission,
// GITHUB_TOKEN tag creation, explicit publish dispatch and release finalization.
// Every GitHub, git and registry interaction is a mock; a pass here is not
// evidence of a real tag, dispatch or npm publication.
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { PACKAGES, compareAdmission, decideTag, mainPushApplicability, matchingPublishRuns, validateAdmissionInputs } from "../release/lib.mjs";
import { main as releaseMain } from "../release/release.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPO = "zudolab/zudo-doc";
const SHA = "c7210d5cbb26c3b765271b71c0c8effd01f54995";
const OTHER = "1111111111111111111111111111111111111111";
const BASE = "e1d2437680f24d0fce8f52644f22354bef76fc9e";
const CAND = "bf770e06f169908c3647bb69060b0d207d3bcb43";
const MERGE = "fdf479c4438fc8d80910cda4698983817b87ce1f";
const TREE = "35f3c03c1770b7d1a466e600ec7d9c856bce76c2";
const CTREE = "2222222222222222222222222222222222222222";
const VERSION = "11.0.0";
const ZIP = Buffer.from("a2-diagnostics-zip-bytes");
const DIGEST = `sha256:${createHash("sha256").update(ZIP).digest("hex")}`;
const [HISTORY, ZUDO, CREATE] = PACKAGES;

const ok = (stdout) => ({ status: 0, stdout: typeof stdout === "string" ? stdout : JSON.stringify(stdout), stderr: "" });
const fail = (stderr) => ({ status: 1, stdout: "", stderr });
const b64 = (s) => Buffer.from(s).toString("base64");

const A2_LOG = [
  "2026-11-11T11:48:28.4829728Z HEAD is now at fdf479c4 Merge bf770e06 into e1d24376",
  "2026-11-11T11:48:28.4928335Z fdf479c4438fc8d80910cda4698983817b87ce1f",
  "2026-11-11T11:48:28.6929838Z A2 decision: RUN (toolchain: package.json; 7 matched input path(s))",
  "2026-11-11T11:48:48.6026007Z       Tests  20 passed | 122 skipped (142)",
].join("\n");

const tmpDirs = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "release-actions-"));
  tmpDirs.push(d);
  return d;
};

function jsonResponse(status, body) {
  return { status, ok: status >= 200 && status < 300, statusText: String(status), text: async () => JSON.stringify(body) };
}

function provenance(pkg, version, sha, run = 1) {
  const statement = {
    predicate: {
      buildDefinition: {
        externalParameters: { workflow: { ref: `refs/tags/${pkg.tagPrefix}${version}`, repository: "https://github.com/zudolab/zudo-doc", path: `.github/workflows/${pkg.workflow}` } },
        resolvedDependencies: [{ digest: { gitCommit: sha } }],
      },
      runDetails: { metadata: { invocationId: `https://github.com/zudolab/zudo-doc/actions/runs/${run}/attempts/1` } },
    },
  };
  return { attestations: [{ predicateType: "https://slsa.dev/provenance/v1", bundle: { dsseEnvelope: { payload: b64(JSON.stringify(statement)) } } }] };
}

/** npm[name] = { versions: {v: {sha, run}}, tags: {}, unknown?: true } */
function fakeRegistry(npm) {
  return async (url) => {
    const path = decodeURIComponent(new URL(url).pathname);
    let m;
    if ((m = /^\/-\/package\/(.+)\/dist-tags$/.exec(path))) {
      const p = npm[m[1]];
      if (p?.unknown) return jsonResponse(503, {});
      return jsonResponse(200, { ...(p?.tags ?? {}) });
    }
    if ((m = /^\/-\/npm\/v1\/attestations\/(.+)@([^@]+)$/.exec(path))) {
      const p = npm[m[1]];
      const v = p?.versions?.[m[2]];
      if (p?.unknown) return jsonResponse(503, {});
      if (!v) return jsonResponse(404, {});
      return jsonResponse(200, provenance(PACKAGES.find((x) => x.name === m[1]), m[2], v.sha, v.run));
    }
    const name = Object.keys(npm).find((n) => path.startsWith(`/${n}/`));
    if (!name) return jsonResponse(404, {});
    const p = npm[name];
    if (p.unknown) return jsonResponse(503, {});
    const v = path.slice(name.length + 2);
    return p.versions[v] ? jsonResponse(200, { name, version: v, _npmUser: { name: "GitHub Actions" } }) : jsonResponse(404, {});
  };
}

const emptyNpm = () => Object.fromEntries(PACKAGES.map((p) => [p.name, { versions: {}, tags: { latest: "10.0.3" } }]));

/**
 * One fake GitHub/git/npm world for every Actions-path command. `s` is mutable
 * state that a test tweaks before (or while) running a command.
 */
function world(over = {}) {
  const dir = tmp();
  const s = {
    tags: {}, // tag -> peeled commit SHA
    npm: emptyNpm(),
    a2Step: "success",
    a2Decision: "RUN (toolchain: package.json; 7 matched input path(s))",
    runHead: CAND,
    artifactDigest: DIGEST,
    zipBytes: ZIP,
    mergeCommit: SHA,
    integrationTree: TREE,
    compare: "ahead",
    deploy: { status: "completed", conclusion: "success" },
    versionAt: VERSION,
    tagPost: () => null, // return an ExecResult to override POST git/refs
    dispatch: () => null, // return an ExecResult to override `gh workflow run`
    dispatchStartsRun: true,
    releases: Object.fromEntries(PACKAGES.map((p) => [`${p.tagPrefix}${VERSION}`, { draft: true }])),
    runs: [],
    ...over,
  };
  let nextRun = 500;
  let nextTagObj = 1;
  const tagObjects = {};
  const writes = [];
  const calls = [];
  const startRun = (pkg, tag, event, sha = s.tags[tag]) => {
    const run = { id: nextRun++, run_attempt: 1, event, path: `.github/workflows/${pkg.workflow}`, head_branch: tag, head_sha: sha, status: "queued", conclusion: null, html_url: `https://gh/runs/${nextRun}`, pkg };
    s.runs.push(run);
    return run;
  };
  const finishRun = (run) => {
    run.status = "completed";
    run.conclusion = "success";
    const version = run.head_branch.slice(run.pkg.tagPrefix.length);
    const entry = s.npm[run.pkg.name];
    entry.versions[version] ??= { sha: run.head_sha, run: run.id };
    entry.tags[version.includes("-") ? "next" : "latest"] = version;
  };
  const commits = () => ({
    [MERGE]: { sha: MERGE, tree: { sha: TREE }, parents: [{ sha: BASE }, { sha: CAND }] },
    [CAND]: { sha: CAND, tree: { sha: CTREE }, parents: [{ sha: BASE }] },
    [SHA]: { sha: SHA, tree: { sha: s.integrationTree }, parents: [{ sha: BASE }, { sha: CAND }] },
  });
  const deployRun = () => ({ id: 77, path: ".github/workflows/main-deploy.yml", name: "Production Deploy", head_sha: SHA, event: "push", head_branch: "main", run_attempt: 1, html_url: "https://gh/runs/77", ...s.deploy });

  const api = (path) => {
    const p = path.replace(`repos/${REPO}/`, "");
    let m;
    if (p === "actions/runs/7/attempts/1") return ok({ id: 7, path: ".github/workflows/pr-checks.yml", event: "pull_request", run_attempt: 1, status: "completed", conclusion: "success", head_sha: s.runHead, html_url: "https://gh/runs/7" });
    if (p.startsWith("actions/runs/7/attempts/1/jobs")) {
      return ok({
        jobs: [
          {
            id: 9,
            name: "A2 No-Stub Parity Gate",
            conclusion: "success",
            run_attempt: 1,
            started_at: "2026-11-11T11:48:25Z",
            completed_at: "2026-11-11T11:48:50Z",
            steps: [
              { name: "Select A2 from changed build inputs", conclusion: "success" },
              { name: "Run A2 no-stub parity slow-suite subset", conclusion: s.a2Step, started_at: "2026-11-11T11:48:43Z", completed_at: "2026-11-11T11:48:48Z" },
            ],
          },
          { id: 10, name: "Type Check", conclusion: "success", run_attempt: 1 },
        ],
      });
    }
    if (p.startsWith("actions/runs/7/artifacts")) return ok({ artifacts: [{ id: 5, name: "a2-route-parity-diagnostics", digest: s.artifactDigest, created_at: "2026-11-11T11:48:49Z", expired: false, workflow_run: { id: 7 } }] });
    if (p === "actions/jobs/9/logs") return ok(A2_LOG.replace(/A2 decision: .*/, `A2 decision: ${s.a2Decision}`));
    if ((m = /^git\/commits\/([0-9a-f]{40})$/.exec(p))) return commits()[m[1]] ? ok(commits()[m[1]]) : fail("HTTP 404: Not Found");
    if (p.startsWith("contents/.required-checks-manifest")) return ok({ content: b64("A2 No-Stub Parity Gate\nType Check\n") });
    if (p === `compare/${SHA}...main`) return ok({ status: s.compare });
    if (p === "pulls/42") return ok({ merged: true, merge_commit_sha: s.mergeCommit });
    if (p === `contents/.github/workflows?ref=${SHA}`) return ok([{ name: "main-deploy.yml", path: ".github/workflows/main-deploy.yml" }]);
    if (p === `contents/.github/workflows/main-deploy.yml?ref=${SHA}`) return ok({ content: b64("on:\n  push:\n    branches: [main]\n") });
    if (p.startsWith(`actions/runs?head_sha=${SHA}`)) return ok({ workflow_runs: [deployRun()] });
    if (p.startsWith("actions/runs/77/attempts/1/jobs")) return ok({ jobs: [{ name: "Deploy", conclusion: s.deploy.conclusion ?? "success" }] });
    if ((m = /^actions\/workflows\/([^/]+)\/runs/.exec(p))) return ok({ workflow_runs: s.runs.filter((r) => r.path === `.github/workflows/${m[1]}` || r.anyWorkflow) });
    if ((m = /^actions\/runs\/(\d+)$/.exec(p))) {
      const run = s.runs.find((r) => r.id === Number(m[1]));
      if (run.status !== "completed") finishRun(run);
      return ok(run);
    }
    if (p.startsWith("rulesets")) return ok([{ name: "main-keep", target: "branch", enforcement: "active" }]);
    throw new Error(`unexpected gh api ${path}`);
  };

  const exec = (cmd, args, opts = {}) => {
    const line = [cmd, ...args].join(" ");
    calls.push(line);
    if (cmd === "gh" && args[0] === "api" && args[1] === "-X" && args[2] === "POST") {
      writes.push(line);
      const body = JSON.parse(opts.input);
      if (args[3].endsWith("/git/tags")) {
        const id = `ab${String(nextTagObj++).padStart(38, "0")}`;
        tagObjects[id] = body;
        return ok({ sha: id });
      }
      if (args[3].endsWith("/git/refs")) {
        const custom = s.tagPost(body);
        if (custom) return custom;
        const tag = body.ref.replace("refs/tags/", "");
        if (s.tags[tag]) return fail('gh: Reference already exists (HTTP 422)');
        s.tags[tag] = tagObjects[body.sha].object;
        return ok({ ref: body.ref });
      }
    }
    if (cmd === "gh" && args[0] === "api") {
      if (args[1] === "-X") return api(args[3]);
      if (opts.stdoutFile) {
        writeFileSync(opts.stdoutFile, s.zipBytes);
        return ok("");
      }
      return api(args[1]);
    }
    if (cmd === "unzip") {
      const out = args[args.indexOf("-d") + 1];
      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, "manifest.json"), JSON.stringify({ sourceHead: MERGE }));
      return ok("");
    }
    if (cmd === "git" && args[0] === "fetch") return ok("");
    if (cmd === "git" && args[0] === "show") return ok(JSON.stringify({ version: s.versionAt }));
    if (cmd === "git" && args[0] === "ls-remote") {
      const tag = args[3].replace("refs/tags/", "");
      return ok(s.tags[tag] ? `${s.tags[tag]}\trefs/tags/${tag}^{}` : "");
    }
    if (cmd === "git" && (args[0] === "push" || args[0] === "tag")) {
      writes.push(line);
      return ok("");
    }
    if (cmd === "gh" && args[0] === "workflow" && args[1] === "run") {
      writes.push(line);
      const pkg = PACKAGES.find((x) => x.workflow === args[2]);
      const tag = args[args.indexOf("--ref") + 1];
      const custom = s.dispatch(pkg, tag);
      if (s.dispatchStartsRun) startRun(pkg, tag, "workflow_dispatch");
      return custom ?? ok("");
    }
    if (cmd === "gh" && args[0] === "release" && args[1] === "view") {
      const r = s.releases[args[2]];
      return r ? ok({ tagName: args[2], isDraft: r.draft, isPrerelease: false, name: `${PACKAGES.find((x) => args[2].startsWith(x.tagPrefix)).name} ${VERSION}` }) : fail("release not found");
    }
    if (cmd === "gh" && args[0] === "release" && args[1] === "edit") {
      writes.push(line);
      if (args.includes("--draft=false")) s.releases[args[2]].draft = false;
      return ok("");
    }
    if (cmd === "gh" && args[0] === "release" && args[1] === "list") return ok([{ tagName: `v${VERSION}`, isLatest: false }]);
    throw new Error(`unexpected exec ${line}`);
  };

  let clock = Date.parse("2026-11-12T00:00:00Z");
  const logs = [];
  const deps = {
    exec,
    fetchImpl: (url, init) => fakeRegistry(s.npm)(url, init),
    sleep: async () => {
      clock += 15_000;
    },
    now: () => clock,
    log: (l) => logs.push(l),
    cwd: dir,
    env: {},
    readFile: (p) => readFileSync(p, "utf8"),
    writeFile: (p, c) => {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, c);
    },
    exists: (p) => {
      try {
        readFileSync(p);
        return true;
      } catch {
        return false;
      }
    },
    pollMs: 1,
  };
  return { s, dir, deps, logs, writes, calls, startRun };
}

const declared = (o = {}) => ({
  version: VERSION,
  integration: SHA,
  pr: "42",
  run: "7",
  attempt: "1",
  candidate: CAND,
  base: BASE,
  "artifact-id": "5",
  "artifact-digest": DIGEST,
  ...o,
});
const admitArgs = (w, o = {}) => ["admit", ...Object.entries(declared(o)).flatMap(([k, v]) => [`--${k}`, v]), "--out", w.dir];
const admission = (w) => JSON.parse(readFileSync(join(w.dir, "admission.json"), "utf8"));
const allTagsAt = (sha) => Object.fromEntries(PACKAGES.map((p) => [`${p.tagPrefix}${VERSION}`, sha]));

/** Admission that passed, as the later jobs receive it from the same run. */
async function admitted(over) {
  const w = world(over);
  expect(await releaseMain(admitArgs(w), w.deps)).toBe(0);
  return w;
}

// ── pure decisions ───────────────────────────────────────────────────────────

describe("admission decisions", () => {
  it("rejects moving refs and malformed evidence identifiers before any request", () => {
    expect(validateAdmissionInputs(declared())).toEqual([]);
    expect(validateAdmissionInputs(declared({ integration: "main" })).join()).toMatch(/--integration must be a full 40-hex SHA/);
    expect(validateAdmissionInputs(declared({ candidate: "HEAD" })).join()).toMatch(/--candidate/);
    expect(validateAdmissionInputs(declared({ attempt: "0" })).join()).toMatch(/--attempt/);
    expect(validateAdmissionInputs(declared({ "artifact-digest": "abc" })).join()).toMatch(/artifact-digest/);
    expect(validateAdmissionInputs(declared({ version: "latest" })).join()).toMatch(/semver/);
  });

  const a2 = { ok: true, prNumber: 42, run: { id: 7, attempt: 1, headSha: CAND }, candidate: CAND, base: BASE, a2: { artifact: { id: 5, digest: DIGEST }, testedTree: TREE }, artifactDownload: { sha256: DIGEST } };
  const integration = { ok: true, integration: SHA, integrationTree: TREE, prNumber: 42 };

  it("accepts only when every declared value equals the re-derived one", () => {
    expect(compareAdmission({ declared: declared(), a2, integration }).errors).toEqual([]);
  });

  it("refuses self-reported values that the re-derived evidence does not support", () => {
    const e = (d, x = a2, i = integration) => compareAdmission({ declared: declared(d), a2: x, integration: i }).errors.join("\n");
    expect(e({ run: "8" })).toMatch(/PR Checks run/);
    expect(e({ attempt: "2" })).toMatch(/run attempt/);
    expect(e({ candidate: OTHER })).toMatch(/candidate head/);
    expect(e({ base: OTHER })).toMatch(/base/);
    expect(e({ "artifact-id": "6" })).toMatch(/artifact id/);
    expect(e({ "artifact-digest": `sha256:${"0".repeat(64)}` })).toMatch(/digest/);
    expect(e({ integration: OTHER })).toMatch(/accepted integration/);
    expect(e({}, { ...a2, artifactDownload: { sha256: "sha256:ff" } })).toMatch(/downloaded bytes/);
    expect(e({}, { ...a2, ok: false })).toMatch(/A2 evidence .* not verified/);
    expect(e({}, a2, { ...integration, ok: false })).toMatch(/integration binding .* not verified/);
    expect(e({}, a2, { ...integration, integrationTree: OTHER })).toMatch(/!= A2-tested tree/);
  });

  it("keeps a same-SHA tag, creates an absent one and refuses one elsewhere", () => {
    expect(decideTag({ tag: "v1.0.0", existing: SHA, integration: SHA }).action).toBe("keep");
    expect(decideTag({ tag: "v1.0.0", existing: null, integration: SHA }).action).toBe("create");
    const r = decideTag({ tag: "v1.0.0", existing: OTHER, integration: SHA });
    expect(r.action).toBe("refuse");
    expect(r.reason).toMatch(/never moved.*fresh A2 evidence and integration approval/);
  });

  it("identifies publish runs by exact workflow, tag and SHA", () => {
    const tag = `${ZUDO.tagPrefix}${VERSION}`;
    const base = { head_branch: tag, head_sha: SHA, path: `.github/workflows/${ZUDO.workflow}`, event: "workflow_dispatch", conclusion: null };
    const runs = [
      { id: 1, ...base },
      { id: 2, ...base, head_sha: OTHER },
      { id: 3, ...base, head_branch: `v${VERSION}` },
      { id: 4, ...base, path: `.github/workflows/${CREATE.workflow}` },
      { id: 5, ...base, conclusion: "skipped" },
      { id: 6, ...base, event: "push" },
      { id: 7, ...base, event: "release" },
    ];
    expect(matchingPublishRuns(ZUDO, tag, SHA, runs).map((r) => r.id)).toEqual([1, 7]);
  });
});

// ── admit (read-only) ────────────────────────────────────────────────────────

describe("admit re-derives evidence server-side and never writes", () => {
  it("admits a verified release with absent tags and versions", async () => {
    const w = world();
    expect(await releaseMain(admitArgs(w), w.deps)).toBe(0);
    const a = admission(w);
    expect(a).toMatchObject({ ok: true, version: VERSION, integration: SHA, errors: [] });
    expect(a.observed).toMatchObject({ pr: 42, run: { id: 7, attempt: 1 }, candidate: CAND, base: BASE, artifact: { id: 5, digest: DIGEST }, downloadSha256: DIGEST, a2Source: MERGE, testedTree: TREE, integrationTree: TREE });
    expect(Object.values(a.tags)).toEqual(["absent", "absent", "absent"]);
    expect(w.writes).toEqual([]);
  });

  it("does not trust a declared digest that differs from the artifact", async () => {
    const w = world();
    expect(await releaseMain(admitArgs(w, { "artifact-digest": `sha256:${"0".repeat(64)}` }), w.deps)).toBe(1);
    expect(admission(w).errors.join()).toMatch(/A2 artifact digest/);
    expect(w.writes).toEqual([]);
  });

  it("blocks when downloaded bytes do not match the recorded artifact digest", async () => {
    const w = world({ zipBytes: Buffer.from("tampered") });
    expect(await releaseMain(admitArgs(w), w.deps)).toBe(1);
    expect(JSON.parse(readFileSync(join(w.dir, "a2-evidence.json"), "utf8")).errors.join()).toMatch(/downloaded artifact/);
  });

  it("blocks when A2 did not execute (green job, skipped test step)", async () => {
    const w = world({ a2Step: "skipped", a2Decision: "SKIP (no A2 build input changed)" });
    expect(await releaseMain(admitArgs(w), w.deps)).toBe(1);
    expect(admission(w).errors.join()).toMatch(/A2 evidence did not verify/);
    expect(JSON.parse(readFileSync(join(w.dir, "a2-evidence.json"), "utf8")).errors.join()).toMatch(/skipped A2 blocks release/);
  });

  it("blocks a run whose head is not the declared candidate", async () => {
    const w = world({ runHead: OTHER });
    expect(await releaseMain(admitArgs(w), w.deps)).toBe(1);
    expect(JSON.parse(readFileSync(join(w.dir, "a2-evidence.json"), "utf8")).errors.join()).toMatch(/frozen candidate/);
  });

  it("blocks while the exact-SHA main workflow is not finished, and on failure", async () => {
    const pending = world({ deploy: { status: "in_progress", conclusion: null } });
    expect(await releaseMain(admitArgs(pending), pending.deps)).toBe(1);
    expect(admission(pending).errors.join()).toMatch(/integration binding did not verify/);
    expect(JSON.parse(readFileSync(join(pending.dir, "integration.json"), "utf8")).errors.join()).toMatch(/in_progress/);
    const failed = world({ deploy: { status: "completed", conclusion: "failure" } });
    expect(await releaseMain(admitArgs(failed), failed.deps)).toBe(1);
  });

  it("blocks an integration that is not the PR merge result, or whose tree differs", async () => {
    const notMerge = world({ mergeCommit: OTHER });
    expect(await releaseMain(admitArgs(notMerge), notMerge.deps)).toBe(1);
    expect(JSON.parse(readFileSync(join(notMerge.dir, "integration.json"), "utf8")).errors.join()).toMatch(/PR merge result/);
    const tree = world({ integrationTree: OTHER });
    expect(await releaseMain(admitArgs(tree), tree.deps)).toBe(1);
    expect(JSON.parse(readFileSync(join(tree.dir, "integration.json"), "utf8")).errors.join()).toMatch(/A2-tested tree/);
  });

  it("blocks a package version that is not the fixed version at the integration", async () => {
    const w = world({ versionAt: "10.0.3" });
    expect(await releaseMain(admitArgs(w), w.deps)).toBe(1);
    expect(admission(w)).toMatchObject({ ok: false, errors: [expect.stringMatching(/is 10.0.3, not 11.0.0/)] });
  });

  it("records a git/GitHub failure after the evidence step as unknown in admission.json", async () => {
    const w = world();
    const exec = w.deps.exec;
    w.deps.exec = (cmd, args, opts) => (cmd === "git" && args[0] === "ls-remote" ? fail("fatal: unable to access remote") : exec(cmd, args, opts));
    expect(await releaseMain(admitArgs(w), w.deps)).toBe(2);
    expect(admission(w)).toMatchObject({ ok: false, errors: [expect.stringMatching(/ls-remote failed/)] });
  });

  it("resumes same-SHA tags and refuses a tag at another SHA", async () => {
    const resume = world({ tags: allTagsAt(SHA) });
    expect(await releaseMain(admitArgs(resume), resume.deps)).toBe(0);
    expect(Object.values(admission(resume).tags)).toEqual(Array(3).fill("present-same-sha (resume)"));
    const moved = world({ tags: { [`${ZUDO.tagPrefix}${VERSION}`]: OTHER } });
    expect(await releaseMain(admitArgs(moved), moved.deps)).toBe(1);
    expect(admission(moved).errors.join()).toMatch(/already targets 1111.*never moved/);
  });

  it("treats an uncertain registry as unknown (exit 2), never as absent", async () => {
    const npm = emptyNpm();
    npm[HISTORY.name].unknown = true;
    const w = world({ npm });
    expect(await releaseMain(admitArgs(w), w.deps)).toBe(2);
    expect(admission(w)).toMatchObject({ ok: false, registry: { "history-server": "unknown" } });
  });

  it("refuses a version already published from another source", async () => {
    const npm = emptyNpm();
    npm[CREATE.name].versions[VERSION] = { sha: OTHER, run: 3 };
    const w = world({ npm });
    expect(await releaseMain(admitArgs(w), w.deps)).toBe(1);
    expect(admission(w).errors.join()).toMatch(/already exists from another source/);
  });

  it("rejects a moving ref as the integration without any GitHub request", async () => {
    const w = world();
    expect(await releaseMain(admitArgs(w, { integration: "main" }), w.deps)).toBe(1);
    expect(w.calls).toEqual([]);
  });
});

// ── tags via the API (contents: write) ───────────────────────────────────────

describe("tag --via api", () => {
  const tagArgs = (w) => ["tag", "--version", VERSION, "--evidence", w.dir, "--via", "api"];
  const posts = (w) => w.writes.filter((c) => c.startsWith("gh api -X POST"));

  it("creates three annotated tags at the integration and reads them back", async () => {
    const w = await admitted();
    expect(await releaseMain(tagArgs(w), w.deps)).toBe(0);
    expect(w.s.tags).toEqual(allTagsAt(SHA));
    expect(posts(w)).toHaveLength(6);
    expect(w.writes.some((c) => c.startsWith("git push"))).toBe(false);
  });

  it("resumes a partial tag set without touching existing tags", async () => {
    const w = await admitted({ tags: { [`${HISTORY.tagPrefix}${VERSION}`]: SHA } });
    expect(await releaseMain(tagArgs(w), w.deps)).toBe(0);
    expect(posts(w).filter((c) => c.endsWith("/git/refs --input -"))).toHaveLength(2);
    expect(w.logs.join()).toMatch(/zudo-doc-history-server-11.0.0: already at .* \(kept; resuming\)/);
  });

  it("refuses before any write when one tag sits at another SHA", async () => {
    const w = await admitted();
    w.s.tags[`v${VERSION}`] = OTHER;
    expect(await releaseMain(tagArgs(w), w.deps)).toBe(1);
    expect(posts(w)).toEqual([]);
  });

  it("keeps a tag that a concurrent run created at the same SHA, refuses one elsewhere", async () => {
    const same = await admitted();
    same.s.tagPost = (body) => (body.ref.endsWith(`zudo-doc-v${VERSION}`) ? ((same.s.tags[`zudo-doc-v${VERSION}`] = SHA), fail("gh: Reference already exists (HTTP 422)")) : null);
    expect(await releaseMain(tagArgs(same), same.deps)).toBe(0);
    expect(same.logs.join()).toMatch(/created concurrently/);
    const elsewhere = await admitted();
    elsewhere.s.tagPost = (body) => (body.ref.endsWith(`zudo-doc-v${VERSION}`) ? ((elsewhere.s.tags[`zudo-doc-v${VERSION}`] = OTHER), fail("gh: Reference already exists (HTTP 422)")) : null);
    expect(await releaseMain(tagArgs(elsewhere), elsewhere.deps)).toBe(1);
    expect(elsewhere.s.tags[`v${VERSION}`]).toBeUndefined();
  });

  it("reports a 403 verbatim with observable rulesets, asserts no cause, and does not route around it", async () => {
    const w = await admitted();
    w.s.tagPost = () => fail("gh: Resource not accessible by integration (HTTP 403)");
    expect(await releaseMain(tagArgs(w), w.deps)).toBe(1);
    const log = w.logs.join("\n");
    expect(log).toMatch(/Actual error: gh: Resource not accessible by integration \(HTTP 403\)/);
    expect(log).toMatch(/Observable rulesets for this token: main-keep \(target=branch, enforcement=active\)/);
    expect(log).toMatch(/Cause is NOT asserted/);
    expect(w.writes.some((c) => /^git (tag|push)/.test(c))).toBe(false);
    expect(posts(w).filter((c) => c.endsWith("/git/refs --input -"))).toHaveLength(1);
  });

  it("treats a transient failure as unknown, and the re-run resumes", async () => {
    const w = await admitted();
    let failures = 1;
    w.s.tagPost = (body) => (body.ref.endsWith(`zudo-doc-v${VERSION}`) && failures-- > 0 ? fail("HTTP 502: Bad Gateway") : null);
    expect(await releaseMain(tagArgs(w), w.deps)).toBe(2);
    expect(w.s.tags[`v${VERSION}`]).toBeUndefined();
    expect(await releaseMain(tagArgs(w), w.deps)).toBe(0);
    expect(w.s.tags).toEqual(allTagsAt(SHA));
  });

  it("re-checks main right before writing and refuses if the integration left main", async () => {
    const w = await admitted();
    w.s.compare = "diverged";
    expect(await releaseMain(tagArgs(w), w.deps)).toBe(1);
    expect(w.logs.join()).toMatch(/no longer on main/);
    expect(posts(w)).toEqual([]);
  });

  it("acts only on an admission for the same version and integration", async () => {
    const none = world();
    writeFileSync(join(none.dir, "integration.json"), JSON.stringify({ ok: true, integration: SHA, a2TestedTree: TREE }));
    expect(await releaseMain(tagArgs(none), none.deps)).toBe(1);
    expect(none.logs.join()).toMatch(/admission\.json/);
    const w = await admitted();
    writeFileSync(join(w.dir, "admission.json"), JSON.stringify({ ...admission(w), integration: OTHER }));
    expect(await releaseMain(tagArgs(w), w.deps)).toBe(1);
    expect(posts(w)).toEqual([]);
  });
});

// ── explicit dispatch (actions: write) ───────────────────────────────────────

describe("publish --initiation dispatch", () => {
  const pubArgs = (w) => ["publish", "--version", VERSION, "--evidence", w.dir, "--initiation", "dispatch"];
  const dispatches = (w) => w.writes.filter((c) => c.startsWith("gh workflow run"));

  async function tagged(over) {
    const w = await admitted(over);
    w.s.tags = allTagsAt(SHA);
    return w;
  }

  it("dispatches each publish workflow on its tag in order, without touching releases", async () => {
    const w = await tagged();
    expect(await releaseMain(pubArgs(w), w.deps)).toBe(0);
    expect(dispatches(w)).toEqual(PACKAGES.map((p) => `gh workflow run ${p.workflow} --repo ${REPO} --ref ${p.tagPrefix}${VERSION} -f dry_run=false`));
    expect(w.calls.some((c) => c.startsWith("gh release"))).toBe(false);
    const pub = JSON.parse(readFileSync(join(w.dir, "publication.json"), "utf8"));
    expect(Object.values(pub.packages).map((p) => [p.state, p.runs[0].initiation])).toEqual(Array(3).fill(["complete", "dispatch"]));
  });

  it("attaches to the run an ambiguous dispatch actually started, without re-sending", async () => {
    const w = await tagged();
    w.s.dispatch = (pkg) => (pkg === HISTORY ? fail("HTTP 502: Bad Gateway") : null);
    expect(await releaseMain(pubArgs(w), w.deps)).toBe(0);
    expect(dispatches(w).filter((c) => c.includes(HISTORY.workflow))).toHaveLength(1);
    expect(w.logs.join()).toMatch(/checking whether a run started anyway/);
  });

  it("stops as unknown when an ambiguous dispatch shows no run, and resumes on re-run", async () => {
    const w = await tagged({ dispatchStartsRun: false });
    w.s.dispatch = () => fail("HTTP 502: Bad Gateway");
    expect(await releaseMain(pubArgs(w), w.deps)).toBe(2);
    expect(dispatches(w)).toHaveLength(1);
    w.s.dispatch = () => null;
    w.s.dispatchStartsRun = true;
    expect(await releaseMain(pubArgs(w), w.deps)).toBe(0);
    expect(dispatches(w)).toHaveLength(4);
  });

  it("reports a refused dispatch and points to the Actions UI instead of another route", async () => {
    const w = await tagged({ dispatchStartsRun: false });
    w.s.dispatch = () => fail("HTTP 403: Resource not accessible by integration");
    expect(await releaseMain(pubArgs(w), w.deps)).toBe(1);
    expect(w.logs.join()).toMatch(/was refused \(HTTP 403\).*Not retried through another route.*Actions UI/);
    expect(dispatches(w)).toHaveLength(1);
  });

  it("does not wait on a definite non-permission rejection (e.g. 422)", async () => {
    const w = await tagged({ dispatchStartsRun: false });
    w.s.dispatch = () => fail("could not create workflow dispatch event: HTTP 422: Unexpected inputs provided");
    expect(await releaseMain(pubArgs(w), w.deps)).toBe(1);
    expect(w.logs.join()).toMatch(/was rejected \(HTTP 422\).*not re-sent/);
    expect(w.logs.join()).not.toMatch(/checking whether a run started anyway/);
  });

  it("attaches to an active run of the exact workflow/tag/SHA and ignores look-alikes", async () => {
    const w = await tagged();
    const tag = `${HISTORY.tagPrefix}${VERSION}`;
    w.startRun(HISTORY, tag, "workflow_dispatch", OTHER); // same tag, other SHA
    const otherWf = w.startRun(ZUDO, tag, "workflow_dispatch", SHA); // other workflow
    otherWf.path = `.github/workflows/${CREATE.workflow}`;
    otherWf.anyWorkflow = true;
    const active = w.startRun(HISTORY, tag, "release", SHA);
    expect(await releaseMain(pubArgs(w), w.deps)).toBe(0);
    expect(dispatches(w).filter((c) => c.includes(HISTORY.workflow))).toEqual([]);
    expect(JSON.parse(readFileSync(join(w.dir, "publication.json"), "utf8")).packages["history-server"].runs[0]).toMatchObject({ id: active.id, initiation: "existing-run" });
  });

  it("never republishes versions that already exist from this integration", async () => {
    const npm = Object.fromEntries(PACKAGES.map((p, i) => [p.name, { versions: { [VERSION]: { sha: SHA, run: 90 + i } }, tags: { latest: VERSION } }]));
    const w = await tagged({ npm });
    expect(await releaseMain(pubArgs(w), w.deps)).toBe(0);
    expect(dispatches(w)).toEqual([]);
    const pub = JSON.parse(readFileSync(join(w.dir, "publication.json"), "utf8"));
    expect(Object.values(pub.packages).map((p) => p.freshPublication)).toEqual([false, false, false]);
  });

  it("stops on registry uncertainty without dispatching", async () => {
    const w = await tagged();
    w.s.npm[HISTORY.name].unknown = true;
    expect(await releaseMain(pubArgs(w), w.deps)).toBe(2);
    expect(dispatches(w)).toEqual([]);
  });

  it("refuses to dispatch without a matching admission", async () => {
    const w = await tagged();
    writeFileSync(join(w.dir, "admission.json"), JSON.stringify({ ...admission(w), ok: false }));
    expect(await releaseMain(pubArgs(w), w.deps)).toBe(1);
    expect(dispatches(w)).toEqual([]);
  });
});

// ── finalize-releases (contents: write) ──────────────────────────────────────

describe("finalize-releases", () => {
  async function published() {
    const w = await admitted();
    w.s.tags = allTagsAt(SHA);
    expect(await releaseMain(["publish", "--version", VERSION, "--evidence", w.dir, "--initiation", "dispatch"], w.deps)).toBe(0);
    return w;
  }

  it("publishes the drafts only after npm verification and marks create-zudo-doc Latest", async () => {
    const w = await published();
    expect(await releaseMain(["finalize-releases", "--version", VERSION, "--evidence", w.dir], w.deps)).toBe(0);
    expect(w.writes.filter((c) => c.startsWith("gh release edit"))).toEqual([
      ...PACKAGES.map((p) => `gh release edit ${p.tagPrefix}${VERSION} --repo ${REPO} --draft=false --latest=false`),
      `gh release edit v${VERSION} --repo ${REPO} --latest`,
    ]);
  });

  it("keeps the drafts when a package is not verified on npm", async () => {
    const w = await published();
    w.s.npm[ZUDO.name].tags.latest = "10.0.3";
    expect(await releaseMain(["finalize-releases", "--version", VERSION, "--evidence", w.dir], w.deps)).toBe(1);
    expect(w.writes.filter((c) => c.startsWith("gh release edit"))).toEqual([]);
  });

  it("refuses without a completed publication record", async () => {
    const w = await admitted();
    w.s.tags = allTagsAt(SHA);
    writeFileSync(join(w.dir, "publication.json"), JSON.stringify({ version: VERSION, integration: SHA, packages: {} }));
    expect(await releaseMain(["finalize-releases", "--version", VERSION, "--evidence", w.dir], w.deps)).toBe(1);
  });
});

// ── coordinator helper (read-only) ───────────────────────────────────────────

describe("actions-inputs", () => {
  it("prints the dispatch inputs from verified local evidence and makes no request", async () => {
    const w = await admitted();
    const before = w.calls.length;
    w.logs.length = 0;
    expect(await releaseMain(["actions-inputs", "--version", VERSION, "--evidence", w.dir], w.deps)).toBe(0);
    expect(w.calls.length).toBe(before);
    const inputs = JSON.parse(w.logs[0]);
    expect(inputs).toEqual({ version: VERSION, integration_sha: SHA, pr_number: "42", a2_run_id: "7", a2_run_attempt: "1", candidate_sha: CAND, base_sha: BASE, a2_artifact_id: "5", a2_artifact_digest: DIGEST, stage: "admit" });
    expect(w.logs[1]).toMatch(/gh workflow run release-actions\.yml --repo zudolab\/zudo-doc --ref main/);
  });

  it("refuses unverified evidence", async () => {
    const w = world();
    writeFileSync(join(w.dir, "a2-evidence.json"), JSON.stringify({ ok: false }));
    writeFileSync(join(w.dir, "integration.json"), JSON.stringify({ ok: true, integration: SHA }));
    expect(await releaseMain(["actions-inputs", "--version", VERSION, "--evidence", w.dir], w.deps)).toBe(1);
  });
});

describe("GitHub uncertainty in the orchestrator", () => {
  it("treats a rate-limited 403 as unknown (exit 2), not as a denial", async () => {
    const w = world();
    const exec = w.deps.exec;
    w.deps.exec = (cmd, args, opts) => (cmd === "gh" && args[1] === "repos/zudolab/zudo-doc/actions/runs/7/attempts/1" ? fail("HTTP 403: API rate limit exceeded") : exec(cmd, args, opts));
    expect(await releaseMain(admitArgs(w), w.deps)).toBe(2);
  });
});

// ── workflow contract ────────────────────────────────────────────────────────

describe("release-actions.yml contract", () => {
  const y = readFileSync(join(ROOT, ".github/workflows/release-actions.yml"), "utf8");
  const job = (name) => {
    const start = y.indexOf(`\n  ${name}:\n`);
    const rest = y.slice(start + 1);
    const next = rest.slice(1).search(/\n {2}[a-z-]+:\n/);
    return next < 0 ? rest : rest.slice(0, next + 1);
  };

  it("is dispatch-only on main, serialized, and grants nothing at workflow level", () => {
    expect(y).toMatch(/^on:\n {2}workflow_dispatch:/m);
    expect(y).not.toMatch(/^\s+(push|pull_request|pull_request_target|release|workflow_run|schedule):/m);
    expect(mainPushApplicability(y)).toBe("no");
    expect(y).toMatch(/^permissions: \{\}$/m);
    expect(y).toMatch(/concurrency:\n {2}group: release-actions\n {2}cancel-in-progress: false/);
    expect(job("admit")).toContain("if: ${{ github.ref == 'refs/heads/main' }}");
  });

  it("keeps artifact paths free of '..' and does not hide a failed readback behind tee", () => {
    expect(/RELEASE_EVIDENCE: (\S+)/.exec(y)?.[1]).not.toContain("..");
    expect(job("finalize")).toMatch(/- name: Read back\n(?: {8}.*\n)*? {8}shell: bash\n/);
  });

  it("uploads the dot-directory evidence with hidden files included", () => {
    const uploads = y.split(/\n(?= {6}- name: )/).filter((step) => step.includes("actions/upload-artifact@"));
    expect(uploads).toHaveLength(2);
    for (const step of uploads) {
      expect(step).toContain("${{ env.RELEASE_EVIDENCE }}");
      expect(step).toMatch(/\n {10}include-hidden-files: true\n/);
    }
  });

  it("separates read-only admission, contents write and actions write", () => {
    expect(job("admit")).toMatch(/permissions:\n {6}contents: read\n {6}actions: read\n {6}pull-requests: read\n/);
    expect(job("tags")).toMatch(/permissions:\n {6}contents: write\n {4}steps:/);
    expect(job("draft-releases")).toMatch(/permissions:\n {6}contents: write\n {4}steps:/);
    expect(job("publish")).toMatch(/permissions:\n {6}actions: write\n {6}contents: read\n {4}steps:/);
    expect(job("finalize")).toMatch(/permissions:\n {6}contents: write\n(?: {6}#.*\n)? {6}actions: read\n {4}steps:/);
    expect(y).not.toMatch(/id-token: write/);
    expect(job("tags")).toContain("--via api");
    expect(job("publish")).toContain("--initiation dispatch");
  });

  it("uses no stored credential, PAT or npm write, and keeps inputs out of shell text", () => {
    expect(y).not.toMatch(/secrets\.|NPM_TOKEN|NODE_AUTH_TOKEN|npm publish|npm dist-tag|git push/);
    for (const run of y.match(/run: [|>]?[^\n]*(?:\n {10,}[^\n]*)*/g) ?? []) expect(run).not.toMatch(/\$\{\{\s*inputs\./);
    for (const uses of y.match(/uses: \S+/g) ?? []) expect(uses).toMatch(/^uses: (\.\/|[\w.-]+\/[\w.-]+@[0-9a-f]{40}$)/);
    for (const c of y.match(/persist-credentials: \S+/g) ?? []) expect(c).toBe("persist-credentials: false");
  });

  it("dispatches the unchanged publish workflow identities", () => {
    for (const pkg of PACKAGES) {
      const pw = readFileSync(join(ROOT, ".github/workflows", pkg.workflow), "utf8");
      expect(pw).toMatch(/workflow_dispatch:/);
      expect(pw).toMatch(/^ {4}permissions:\n {6}contents: read\n {6}id-token: write$/m);
      expect(pw).not.toMatch(/^\s+environment:/m);
    }
  });
});
