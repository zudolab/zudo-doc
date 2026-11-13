// Isolated tests for the tokenless release helpers (#4745). Every registry,
// GitHub, git and npm interaction is a mock; nothing here touches the network.
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  NPM_CLI_PIN,
  PACKAGES,
  compareSemver,
  decideChannel,
  decideStaleNext,
  evaluateExistingVersion,
  extractNotes,
  mainPushApplicability,
  parseA2JobLog,
  parseReleaseTag,
  registryGet,
  verifyA2Evidence,
  verifyIntegration,
} from "../release/lib.mjs";
import { FINALIZE_VISIBILITY_ATTEMPTS, main as stepMain } from "../release/publish-step.mjs";
import { main as releaseMain } from "../release/release.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SHA = "c7210d5cbb26c3b765271b71c0c8effd01f54995";
const OTHER = "1111111111111111111111111111111111111111";
const BASE = "e1d2437680f24d0fce8f52644f22354bef76fc9e";
const CAND = "bf770e06f169908c3647bb69060b0d207d3bcb43";
const MERGE = "fdf479c4438fc8d80910cda4698983817b87ce1f";
const TREE = "35f3c03c1770b7d1a466e600ec7d9c856bce76c2";
const [HISTORY, ZUDO, CREATE] = PACKAGES;

// ── fakes ────────────────────────────────────────────────────────────────────

function jsonResponse(status, body) {
  return { status, ok: status >= 200 && status < 300, statusText: String(status), text: async () => JSON.stringify(body) };
}

function provenanceBody(pkg, version, sha, { run = 1, attempt = 1, workflow = pkg.workflow } = {}) {
  const statement = {
    predicate: {
      buildDefinition: {
        externalParameters: { workflow: { ref: `refs/tags/${pkg.tagPrefix}${version}`, repository: "https://github.com/zudolab/zudo-doc", path: `.github/workflows/${workflow}` } },
        resolvedDependencies: [{ digest: { gitCommit: sha } }],
      },
      runDetails: { metadata: { invocationId: `https://github.com/zudolab/zudo-doc/actions/runs/${run}/attempts/${attempt}` } },
    },
  };
  return { attestations: [{ predicateType: "https://slsa.dev/provenance/v1", bundle: { dsseEnvelope: { payload: Buffer.from(JSON.stringify(statement)).toString("base64") } } }] };
}

/**
 * In-memory registry. `pkgs[name] = { versions: {v: {sha, run}}, tags: {}, unknown?: true }`.
 */
function fakeRegistry(pkgs) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname);
    const find = (name) => pkgs[name];
    let m;
    if ((m = /^\/-\/package\/(.+)\/dist-tags$/.exec(path))) {
      const p = find(m[1]);
      if (p?.unknown) return jsonResponse(503, {});
      return p ? jsonResponse(200, { ...p.tags }) : jsonResponse(404, {});
    }
    if ((m = /^\/-\/npm\/v1\/attestations\/(.+)@([^@]+)$/.exec(path))) {
      const p = find(m[1]);
      const v = p?.versions?.[m[2]];
      if (p?.unknown) return jsonResponse(503, {});
      if (!v || v.noProvenance) return jsonResponse(404, {});
      const pkg = PACKAGES.find((x) => x.name === m[1]);
      return jsonResponse(200, provenanceBody(pkg, m[2], v.sha, v));
    }
    const versionDoc = Object.keys(pkgs).find((n) => path.startsWith(`/${n}/`));
    if (versionDoc) {
      const p = pkgs[versionDoc];
      if (p.unknown) return jsonResponse(503, {});
      const v = path.slice(versionDoc.length + 2);
      const entry = p.versions[v];
      if (!entry || (p.staleReads ?? 0) > 0) {
        if (p.staleReads) p.staleReads--;
        return jsonResponse(404, "version not found");
      }
      return jsonResponse(200, { name: versionDoc, version: v, _npmUser: { name: entry.publisher ?? "GitHub Actions" } });
    }
    const p = find(path.slice(1));
    if (p?.unknown) return jsonResponse(503, {});
    if (!p) return jsonResponse(404, {});
    const versions = Object.fromEntries(Object.keys(p.versions).map((v) => [v, { version: v, _npmUser: { name: p.versions[v].publisher ?? "GitHub Actions" } }]));
    const time = Object.fromEntries(Object.entries(p.versions).map(([v, x]) => [v, x.time ?? "2026-01-01T00:00:00Z"]));
    return jsonResponse(200, { name: path.slice(1), versions, "dist-tags": p.tags, time });
  };
  return { fetchImpl, calls };
}

const noSleep = async () => {};

function stepDeps({ registry, exec, env = {}, files = {}, head = SHA }) {
  const logs = [];
  const execCalls = [];
  const deps = {
    exec: (cmd, args, opts) => {
      execCalls.push([cmd, ...args].join(" "));
      const custom = exec?.(cmd, args, opts);
      if (custom) return custom;
      const line = [cmd, ...args].join(" ");
      if (line === "git rev-parse HEAD") return ok(head);
      if (line.startsWith("git rev-parse --verify refs/tags/")) return ok(head);
      if (line.startsWith("git merge-base --is-ancestor")) return ok("");
      if (line === "git ls-remote --tags origin") return ok("");
      if (line.startsWith("npm config get")) return ok("undefined");
      return ok("");
    },
    fetchImpl: registry.fetchImpl,
    sleep: noSleep,
    env: { ACTIONS_ID_TOKEN_REQUEST_URL: "https://token", ACTIONS_ID_TOKEN_REQUEST_TOKEN: "x", ...env },
    readFile: (p) => {
      for (const [k, v] of Object.entries(files)) if (p.endsWith(k)) return v;
      throw new Error(`unexpected read ${p}`);
    },
    log: (s) => logs.push(s),
    now: () => Date.parse("2026-11-12T00:00:00Z"),
    cwd: "/repo",
    pollAttempts: 2,
    pollDelayMs: 0,
  };
  return { deps, logs, execCalls };
}

function ok(stdout) {
  return { status: 0, stdout, stderr: "" };
}

const pkgJson = (dir, version) => ({ [`${dir}/package.json`]: JSON.stringify({ version }) });
const writesIn = (calls) => calls.filter((c) => /^(npm|pnpm) .*\b(publish|dist-tag (add|rm))\b/.test(c) || /^pnpm --filter \S+ publish/.test(c));

// ── lib ──────────────────────────────────────────────────────────────────────

describe("tag namespaces and versions", () => {
  it("accepts each package's own namespace and derives the channel", () => {
    expect(parseReleaseTag(HISTORY, "zudo-doc-history-server-10.0.4")).toMatchObject({ version: "10.0.4", distTag: "latest" });
    expect(parseReleaseTag(ZUDO, "zudo-doc-v11.0.0-next.1")).toMatchObject({ version: "11.0.0-next.1", distTag: "next" });
    expect(parseReleaseTag(CREATE, "v10.0.4")).toMatchObject({ version: "10.0.4" });
  });

  it("rejects wrong namespaces and malformed versions", () => {
    expect(() => parseReleaseTag(ZUDO, "zudo-doc-history-server-1.0.0")).toThrow(/namespace/);
    expect(() => parseReleaseTag(CREATE, "zudo-doc-v1.0.0")).toThrow(/namespace/);
    expect(() => parseReleaseTag(CREATE, "vintage-1.0.0")).toThrow(/does not match/);
    expect(() => parseReleaseTag(ZUDO, "zudo-doc-v1.0")).toThrow(/does not match/);
    expect(() => parseReleaseTag(HISTORY, "zudo-doc-history-server-01.0.0")).toThrow(/does not match/);
  });

  it("orders versions with semver precedence", () => {
    expect(compareSemver("10.0.4-next.1", "10.0.4")).toBe(-1);
    expect(compareSemver("10.1.0-next.1", "10.0.4")).toBe(1);
    expect(compareSemver("1.0.0-next.10", "1.0.0-next.9")).toBe(1);
    expect(compareSemver("1.0.0-alpha", "1.0.0-alpha.1")).toBe(-1);
    expect(compareSemver("2.0.0", "2.0.0")).toBe(0);
  });

  it("pins a reviewed npm that supports OIDC publish and dist-tag writes", () => {
    const [maj, min] = NPM_CLI_PIN.version.split(".").map(Number);
    expect(maj === 11 ? min >= 21 : maj >= 12 && min >= 2).toBe(true);
    expect(NPM_CLI_PIN.integrity).toMatch(/^sha512-/);
  });
});

describe("registry reads never turn uncertainty into absence", () => {
  it("treats an explicit 404 as absent", async () => {
    const res = await registryGet("/x", { fetchImpl: async () => jsonResponse(404, {}), sleep: noSleep });
    expect(res.state).toBe("absent");
  });

  it("reports repeated 5xx as unknown after bounded retries, keeping each error", async () => {
    let n = 0;
    const res = await registryGet("/x", { fetchImpl: async () => (n++, jsonResponse(503, {})), sleep: noSleep, attempts: 3 });
    expect(res).toMatchObject({ state: "unknown" });
    expect(res.errors).toHaveLength(3);
    expect(n).toBe(3);
  });

  it("reports timeouts and bad JSON as unknown", async () => {
    const timeout = await registryGet("/x", {
      fetchImpl: async () => {
        throw Object.assign(new Error("t"), { name: "TimeoutError" });
      },
      sleep: noSleep,
      attempts: 2,
    });
    expect(timeout.state).toBe("unknown");
    expect(timeout.errors[0]).toMatch(/timeout/);
    const bad = await registryGet("/x", { fetchImpl: async () => ({ status: 200, ok: true, text: async () => "<html>" }), sleep: noSleep, attempts: 1 });
    expect(bad.state).toBe("unknown");
  });
});

describe("channel and stale-next decisions", () => {
  it("keeps a legitimate newer preview and removes only an older one", () => {
    expect(decideStaleNext({ version: "10.0.4", tags: {} })).toMatchObject({ action: "none", outcome: "absent" });
    expect(decideStaleNext({ version: "10.0.4", tags: { next: "10.0.4-next.3" } })).toMatchObject({ action: "remove" });
    expect(decideStaleNext({ version: "10.0.4", tags: { next: "11.0.0-next.1" } })).toMatchObject({ action: "keep", outcome: "kept-newer-preview" });
    expect(decideStaleNext({ version: "11.0.0-next.2", tags: { next: "11.0.0-next.1" } })).toMatchObject({ action: "skip" });
  });

  it("never moves a channel backward", () => {
    expect(decideChannel({ version: "10.0.4", distTag: "latest", tags: { latest: "10.0.4" } }).action).toBe("ok");
    expect(decideChannel({ version: "10.0.4", distTag: "latest", tags: { latest: "10.0.3" } }).action).toBe("set");
    expect(decideChannel({ version: "10.0.4", distTag: "latest", tags: { latest: "11.0.0" } }).action).toBe("conflict");
  });

  it("does not count an existing version as this source without provenance proof", () => {
    const base = { pkg: ZUDO, version: "10.0.4", expectedSha: SHA, expectedTag: "zudo-doc-v10.0.4" };
    const prov = { state: "ok", sourceCommit: SHA, workflowPath: ".github/workflows/publish-zudo-doc.yml", workflowRef: "refs/tags/zudo-doc-v10.0.4", repository: "https://github.com/zudolab/zudo-doc", errors: [] };
    expect(evaluateExistingVersion({ ...base, provenance: prov }).verdict).toBe("matches");
    expect(evaluateExistingVersion({ ...base, provenance: { ...prov, sourceCommit: OTHER } }).verdict).toBe("mismatch");
    expect(evaluateExistingVersion({ ...base, provenance: { ...prov, workflowPath: ".github/workflows/coordinator.yml" } }).verdict).toBe("mismatch");
    expect(evaluateExistingVersion({ ...base, provenance: { state: "absent", errors: [] } }).verdict).toBe("unproven");
    expect(evaluateExistingVersion({ ...base, provenance: { state: "unknown", errors: ["503"] } }).verdict).toBe("unknown");
  });

  it("extracts release notes after the frontmatter", () => {
    expect(extractNotes("---\ntitle: 1.0.0\n---\n\nReleased: x\n\n- No package-specific changes.\n")).toBe("Released: x\n\n- No package-specific changes.\n");
  });
});

// ── A2 evidence ──────────────────────────────────────────────────────────────

const A2_LOG = [
  "2026-11-11T11:48:28.4829728Z HEAD is now at fdf479c4 Merge bf770e06 into e1d24376",
  "2026-11-11T11:48:28.4928335Z fdf479c4438fc8d80910cda4698983817b87ce1f",
  "2026-11-11T11:48:28.6929838Z A2 decision: RUN (toolchain: package.json; 7 matched input path(s))",
  "2026-11-11T11:48:48.6024968Z  Test Files  1 passed | 3 skipped (4)",
  "2026-11-11T11:48:48.6026007Z       Tests  20 passed | 122 skipped (142)",
].join("\n");

function a2Input(overrides = {}) {
  const a2Job = {
    id: 9,
    name: "A2 No-Stub Parity Gate",
    conclusion: "success",
    run_attempt: 1,
    started_at: "2026-11-11T11:48:25Z",
    completed_at: "2026-11-11T11:48:50Z",
    steps: [
      { name: "Select A2 from changed build inputs", conclusion: "success", started_at: "2026-11-11T11:48:28Z", completed_at: "2026-11-11T11:48:28Z" },
      { name: "Run A2 no-stub parity slow-suite subset", conclusion: "success", started_at: "2026-11-11T11:48:43Z", completed_at: "2026-11-11T11:48:48Z" },
    ],
  };
  return {
    candidate: CAND,
    base: BASE,
    attempt: 1,
    run: { id: 7, path: ".github/workflows/pr-checks.yml", event: "pull_request", run_attempt: 1, status: "completed", conclusion: "success", head_sha: CAND },
    jobs: [a2Job, { name: "Type Check", conclusion: "success", run_attempt: 1 }],
    artifacts: [{ id: 5, name: "a2-route-parity-diagnostics", digest: "sha256:ab", created_at: "2026-11-11T11:48:49Z", expired: false, workflow_run: { id: 7 } }],
    jobLog: A2_LOG,
    manifest: { sourceHead: MERGE },
    testedCommit: { sha: MERGE, tree: TREE, parents: [BASE, CAND] },
    requiredChecks: ["A2 No-Stub Parity Gate", "Type Check"],
    ...overrides,
  };
}

describe("A2 release evidence", () => {
  it("parses checkout source, decision and tests from the job log", () => {
    expect(parseA2JobLog(A2_LOG)).toMatchObject({ checkoutSha: MERGE, passed: 20, decision: expect.stringMatching(/^A2 decision: RUN/) });
  });

  it("verifies an executed A2 on the tested synthetic merge", () => {
    const r = verifyA2Evidence(a2Input());
    expect(r.errors).toEqual([]);
    expect(r.record.a2).toMatchObject({ sourceHead: MERGE, testedTree: TREE, artifact: { id: 5, digest: "sha256:ab" } });
  });

  it("blocks a green job whose A2 test step was skipped", () => {
    const input = a2Input();
    input.jobs[0].steps[1] = { name: "Run A2 no-stub parity slow-suite subset", conclusion: "skipped" };
    input.jobLog = A2_LOG.replace(/A2 decision: RUN[^\n]*/, "A2 decision: SKIP (no A2 build input changed)").replace(/Tests .*/, "");
    const r = verifyA2Evidence(input);
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/skipped A2 blocks release/);
    expect(r.errors.join("\n")).toMatch(/not RUN/);
  });

  it("blocks a run for a different candidate, attempt, or tested merge", () => {
    expect(verifyA2Evidence(a2Input({ candidate: OTHER })).errors.join()).toMatch(/head_sha/);
    expect(verifyA2Evidence(a2Input({ attempt: 2 })).errors.join()).toMatch(/attempt/);
    expect(verifyA2Evidence(a2Input({ testedCommit: { sha: MERGE, tree: TREE, parents: [OTHER, CAND] } })).errors.join()).toMatch(/parents/);
    expect(verifyA2Evidence(a2Input({ manifest: { sourceHead: OTHER } })).errors.join()).toMatch(/sourceHead/);
    expect(verifyA2Evidence(a2Input({ testedCommit: null })).errors.join()).toMatch(/unavailable/);
    expect(verifyA2Evidence(a2Input({ artifacts: [] })).errors.join()).toMatch(/exactly one/);
    expect(verifyA2Evidence(a2Input({ run: { ...a2Input().run, event: "push" } })).errors.join()).toMatch(/pull_request/);
  });

  it("blocks a missing or non-successful required check", () => {
    expect(verifyA2Evidence(a2Input({ requiredChecks: ["A2 No-Stub Parity Gate", "E2E Tests"] })).errors.join()).toMatch(/E2E Tests/);
  });
});

describe("a2-evidence CLI", () => {
  it("requires the PR number so the integration can be bound to its merge result", async () => {
    const logs = [];
    const code = await releaseMain(["a2-evidence", "--run", "1", "--attempt", "1", "--candidate", CAND, "--base", BASE, "--out", "x"], { log: (l) => logs.push(l), exec: () => { throw new Error("no external calls expected"); } });
    expect(code).toBe(1);
    expect(logs.join()).toMatch(/Missing --pr/);
  });
});

describe("release preflight capability report", () => {
  const SECRET = "ghs_abcdefghijklmnopqrstuvwxyz0123456789";
  const ok200 = (body) => ({ status: 0, stdout: JSON.stringify(body), stderr: "" });
  const fail = (stderr) => ({ status: 1, stdout: "", stderr });
  const READS = {
    repo: "repos/zudolab/zudo-doc",
    commits: "repos/zudolab/zudo-doc/commits?per_page=1",
    runs: "repos/zudolab/zudo-doc/actions/runs?per_page=1",
    jobs: "repos/zudolab/zudo-doc/actions/runs/77/jobs?per_page=1",
    artifacts: "repos/zudolab/zudo-doc/actions/artifacts?per_page=1",
  };
  const goodApi = {
    [READS.repo]: () => ok200({ full_name: "zudolab/zudo-doc", permissions: { admin: false, maintain: false, push: false, pull: true } }),
    [READS.commits]: () => ok200([{ sha: SHA }]),
    [READS.runs]: () => ok200({ total_count: 1, workflow_runs: [{ id: 77 }] }),
    [READS.jobs]: () => ok200({ total_count: 1, jobs: [{ id: 5 }] }),
    [READS.artifacts]: () => ok200({ total_count: 0, artifacts: [] }),
  };

  function preflight({ api = {}, auth = ok(""), remote = ok("https://github.com/zudolab/zudo-doc.git"), registry = "ok" } = {}) {
    const logs = [];
    const execCalls = [];
    const fetchCalls = [];
    const routes = { ...goodApi, ...api };
    const deps = {
      exec: (cmd, args) => {
        execCalls.push({ cmd, args });
        const line = [cmd, ...args].join(" ");
        if (line === "git remote get-url origin") return remote;
        if (line === "node --version") return ok("v24.11.0");
        if (line === "unzip -v") return ok("UnZip 6.00");
        if (line === "gh auth status") return auth;
        if (cmd === "gh" && args[0] === "api") {
          const route = routes[args[args.length - 1]];
          if (!route) throw new Error(`unexpected gh api ${line}`);
          return route();
        }
        throw new Error(`unexpected exec ${line}`);
      },
      fetchImpl: async (url, init) => {
        fetchCalls.push({ url, method: init?.method ?? "GET" });
        if (registry === "ok") return jsonResponse(200, { name: "create-zudo-doc", versions: {}, "dist-tags": {} });
        if (registry === "absent") return jsonResponse(404, {});
        return jsonResponse(503, {});
      },
      sleep: noSleep,
      log: (s) => logs.push(s),
      env: { GH_TOKEN: SECRET },
    };
    return {
      run: () => releaseMain(["preflight"], deps),
      out: () => logs.join("\n"),
      row: (name) => logs.join("\n").split("\n").find((l) => l.startsWith(`| ${name} |`)) ?? "",
      execCalls,
      fetchCalls,
    };
  }

  it("does not report Actions access from a repository-metadata read alone", async () => {
    const p = preflight({ api: { [READS.runs]: () => fail("gh: Resource not accessible by integration (HTTP 403)") } });
    expect(await p.run()).toBe(1);
    expect(p.row("read: repository metadata")).toContain("| observed |");
    expect(p.row("read: workflow runs (metadata)")).toContain("| denied | HTTP 403");
    expect(p.row("read: workflow jobs (metadata)")).toContain("| unknown |");
    expect(p.out()).not.toMatch(/runs, jobs, logs, artifacts/);
    expect(p.out()).toMatch(/missing or denied — stop here/);
  });

  it("keeps writes unverified even when the role has push/maintain/admin", async () => {
    const p = preflight({ api: { [READS.repo]: () => ok200({ permissions: { admin: true, maintain: true, push: true, pull: true } }) } });
    expect(await p.run()).toBe(0);
    for (const name of ["write: contents (tags, releases)", "write: actions (workflow_dispatch)"]) {
      expect(p.row(name)).toContain("| inferred |");
      expect(p.row(name)).toMatch(/not verified/);
      expect(p.row(name)).not.toMatch(/\| (ok|observed) \|/);
    }
    expect(p.out()).toMatch(/does not establish tag\/release authorization, workflow_dispatch success or npm OIDC publication/);
    expect(p.out()).not.toMatch(/read-only session/);
  });

  it("treats missing role metadata as unknown, not as no permission", async () => {
    const p = preflight({ api: { [READS.repo]: () => ok200({ full_name: "zudolab/zudo-doc" }) } });
    expect(await p.run()).toBe(0);
    expect(p.row("write: contents (tags, releases)")).toContain("| unknown | role metadata unavailable");
    expect(p.row("write: actions (workflow_dispatch)")).toContain("| unknown |");
    expect(p.out()).toMatch(/write capability unknown/);
    expect(p.out()).not.toMatch(/read-only session/);
  });

  it("reports each advertised read independently", async () => {
    const p = preflight({
      api: {
        [READS.commits]: () => ok200([]),
        [READS.jobs]: () => fail("gh: Must have admin rights to Repository. (HTTP 403)"),
        [READS.artifacts]: () => ok200({ total_count: 2, artifacts: [{ id: 1, archive_download_url: "https://signed.example/download?sig=SECRETSIG" }] }),
      },
    });
    expect(await p.run()).toBe(1);
    expect(p.row("read: commits")).toContain("| observed |");
    expect(p.row("read: workflow runs (metadata)")).toContain("| observed |");
    expect(p.row("read: workflow jobs (metadata)")).toContain("| denied | HTTP 403; sample run 77");
    expect(p.row("read: artifact list (metadata)")).toContain("| observed |");
    expect(p.row("read: artifact list (metadata)")).toMatch(/not a download/);
    expect(p.row("read: artifact download")).toContain("| unknown | not exercised");
    expect(p.row("read: job logs")).toContain("| unknown | not exercised");
    expect(p.out()).not.toMatch(/SECRETSIG|signed\.example/);
  });

  it("never turns a missing sample, a 404, a rate limit or a transport failure into a denial", async () => {
    const noSample = preflight({ api: { [READS.runs]: () => ok200({ total_count: 0, workflow_runs: [] }) } });
    expect(await noSample.run()).toBe(0);
    expect(noSample.row("read: workflow jobs (metadata)")).toContain("| unknown | no sample run to read");

    const cases = [
      ["gh: Not Found (HTTP 404)", /\| unknown \| HTTP 404 \(absent or not visible/],
      ["gh: API rate limit exceeded for installation ID 1. (HTTP 403)", /\| unknown \| rate limited/],
      ["gh: You have exceeded a secondary rate limit (HTTP 429)", /\| unknown \| rate limited/],
      ["gh: Server Error (HTTP 502)", /\| unknown \| HTTP 502/],
      ['Get "https://api.github.com/x": dial tcp: lookup api.github.com: no such host', /\| unknown \| transport failure/],
    ];
    for (const [stderr, expected] of cases) {
      const p = preflight({ api: { [READS.artifacts]: () => fail(stderr) } });
      expect(await p.run()).toBe(2);
      expect(p.row("read: artifact list (metadata)")).toMatch(expected);
      expect(p.out()).not.toMatch(/\| denied \|/);
      expect(p.out()).toMatch(/could not be established \(unknown, not a denial\)/);
    }
    const npmDown = preflight({ registry: "down" });
    expect(await npmDown.run()).toBe(2);
    expect(npmDown.row("npm registry read")).toContain("| unknown |");
  });

  it("passes a usable read-only session and says what it does not establish", async () => {
    const p = preflight();
    expect(await p.run()).toBe(0);
    expect(p.row("write: contents (tags, releases)")).toContain("| missing | account role lacks push/maintain/admin");
    expect(p.out()).toMatch(/read-only session\. Evidence and status work/);
    expect(p.out()).toMatch(/nonpublishing checks above succeeded/);
  });

  it("fails on a definite missing prerequisite", async () => {
    for (const remote of ["https://github.com/someone/fork.git", "https://github.com/notzudolab/zudo-doc.git"]) {
      const p = preflight({ remote: ok(remote) });
      expect(await p.run()).toBe(1);
      expect(p.row("git checkout of zudolab/zudo-doc")).toContain("| missing |");
    }
    const noCredential = preflight({ api: Object.fromEntries(Object.values(READS).map((r) => [r, () => fail("To get started with GitHub CLI, please run:  gh auth login")])) });
    expect(await noCredential.run()).toBe(1);
    expect(noCredential.row("read: repository metadata")).toContain("| missing | gh has no credential");
    const npmAbsent = preflight({ registry: "absent" });
    expect(await npmAbsent.run()).toBe(1);
    expect(npmAbsent.row("npm registry read")).toContain("| missing |");
  });

  it("retries one unparseable body before reporting it unknown", async () => {
    let n = 0;
    const p = preflight({ api: { [READS.commits]: () => (n++ === 0 ? ok("<html>proxy error</html>") : ok200([{ sha: SHA }])) } });
    expect(await p.run()).toBe(0);
    expect(p.row("read: commits")).toContain("| observed |");
    expect(n).toBe(2);
  });

  it("lets the API reads, not `gh auth status`, decide GitHub access", async () => {
    const authFails = fail("github.com\n  X Failed to log in to github.com using token (GH_TOKEN)");
    const usable = preflight({ auth: authFails });
    expect(await usable.run()).toBe(0);
    expect(usable.row("gh auth status")).toContain("| unknown | gh reports no usable credential (X Failed to log in");
    expect(usable.row("read: workflow runs (metadata)")).toContain("| observed |");

    const unauthenticated = preflight({ auth: authFails, api: Object.fromEntries(Object.values(READS).map((r) => [r, () => fail("gh: Bad credentials (HTTP 401)")])) });
    expect(await unauthenticated.run()).toBe(1);
    expect(unauthenticated.row("read: repository metadata")).toContain("| denied | HTTP 401");
  });

  it("issues only read-only requests and discloses no credential on any path", async () => {
    const leaky = `https://x-access-token:${SECRET}@github.com/zudolab/zudo-doc.git`;
    const variants = [
      preflight({ remote: ok(leaky) }),
      preflight({ auth: fail(`github.com: token ${SECRET} is invalid; Authorization: Bearer ${SECRET}`) }),
      preflight({ api: { [READS.repo]: () => fail(`gh: Bad credentials (HTTP 401) token ${SECRET}`) } }),
      preflight({ api: { [READS.runs]: () => fail("gh: Server Error (HTTP 500)") }, registry: "down" }),
      preflight({ api: { [READS.repo]: () => ok200({ permissions: { admin: true } }) } }),
    ];
    for (const p of variants) {
      await p.run();
      expect(p.out()).not.toContain(SECRET);
      expect(p.out()).not.toMatch(/Bearer\s+\S{8,}|Authorization:\s*\S{8,}/i);
      for (const { cmd, args } of p.execCalls) {
        const line = [cmd, ...args].join(" ");
        if (cmd === "gh" && args[0] === "api") expect(args.slice(0, 3)).toEqual(["api", "-X", "GET"]);
        expect(line).not.toMatch(/\b(publish|dist-tag|workflow run|release (create|edit|delete)|tag -a|push)\b|-X (POST|PATCH|PUT|DELETE)|--method/);
        expect(cmd).not.toMatch(/^(npm|pnpm)$/);
      }
      for (const f of p.fetchCalls) expect(f.method).toBe("GET");
    }
  });
});

describe("accepted integration binding", () => {
  const a2 = { a2: { testedTree: TREE } };
  const wf = [{ path: ".github/workflows/main-deploy.yml", applicability: "always" }, { path: ".github/workflows/pr-checks.yml", applicability: "no" }];
  const run = { id: 1, path: ".github/workflows/main-deploy.yml", head_sha: SHA, event: "push", head_branch: "main", status: "completed", conclusion: "success", run_attempt: 1 };

  it("binds when the tree matches and Production Deploy succeeded at the exact SHA", () => {
    const r = verifyIntegration({ integration: SHA, integrationTree: TREE, onMain: true, a2, workflows: wf, runs: [run], jobsByRun: { 1: [{ name: "Deploy", conclusion: "success" }] } });
    expect(r.errors).toEqual([]);
  });

  it("blocks tree mismatch, off-main, missing, pending, or failed main workflows", () => {
    const v = (o) => verifyIntegration({ integration: SHA, integrationTree: TREE, onMain: true, a2, workflows: wf, runs: [run], jobsByRun: {}, ...o }).errors.join("\n");
    expect(v({ integrationTree: OTHER })).toMatch(/!= A2-tested tree/);
    expect(v({ onMain: false })).toMatch(/not on origin\/main/);
    expect(v({ runs: [] })).toMatch(/no push run/);
    expect(v({ runs: [{ ...run, status: "in_progress", conclusion: null }] })).toMatch(/in_progress/);
    expect(v({ runs: [{ ...run, conclusion: "failure" }] })).toMatch(/failure/);
    expect(v({ runs: [{ ...run, head_sha: OTHER }] })).toMatch(/no push run/);
    expect(v({ prMergeCommit: OTHER })).toMatch(/PR merge result/);
  });

  it("honours branch globs and branches-ignore scope", () => {
    expect(mainPushApplicability("on:\n  push:\n    branches: ['**']\n")).toBe("always");
    expect(mainPushApplicability("on:\n  push:\n    branches-ignore: [gh-pages]\n    paths: ['src/main/**']\n")).toBe("conditional");
    expect(mainPushApplicability("on:\n  push:\n    branches-ignore:\n      - main\n")).toBe("no");
    expect(mainPushApplicability("on:\n  push:\n    tags: ['v*']\n")).toBe("no");
  });

  it("classifies the repository's real workflows", () => {
    const read = (f) => readFileSync(join(ROOT, ".github/workflows", f), "utf8");
    expect(mainPushApplicability(read("main-deploy.yml"))).toBe("always");
    expect(mainPushApplicability(read("pr-checks.yml"))).toBe("no");
    expect(mainPushApplicability(read("exam.yml"))).toBe("no");
    expect(mainPushApplicability(read("preview-deploy.yml"))).toBe("no");
    for (const p of PACKAGES) expect(mainPushApplicability(read(p.workflow))).toBe("no");
  });
});

// ── publish-step (in-workflow) ───────────────────────────────────────────────

describe("publish-step guard", () => {
  const files = pkgJson("packages/zudo-doc", "10.0.4");

  it("dry-run classifies an absent version without any registry write", async () => {
    const registry = fakeRegistry({ "@takazudo/zudo-doc": { versions: {}, tags: { latest: "10.0.3" } } });
    const { deps, logs, execCalls } = stepDeps({ registry, files });
    expect(await stepMain(["guard", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4", "--dry-run"], deps)).toBe(0);
    expect(logs.join("\n")).toMatch(/absent on the registry → publish/);
    expect(writesIn(execCalls)).toEqual([]);
  });

  it("rejects a wrong namespace, version, SHA, or a split lockstep tag", async () => {
    const registry = fakeRegistry({});
    expect(await stepMain(["guard", "--package", "zudo-doc", "--tag", "v10.0.4"], stepDeps({ registry, files }).deps)).toBe(1);
    expect(await stepMain(["guard", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.5"], stepDeps({ registry, files }).deps)).toBe(1);
    const wrongSha = stepDeps({ registry, files, exec: (c, a) => (a[0] === "rev-parse" && a[1] === "--verify" ? ok(OTHER) : undefined) });
    expect(await stepMain(["guard", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4"], wrongSha.deps)).toBe(1);
    expect(wrongSha.logs.join()).toMatch(/!= tag/);
    const split = stepDeps({ registry, files, exec: (c, a) => (a[0] === "ls-remote" ? ok(`${OTHER}\trefs/tags/v10.0.4\n${SHA}\trefs/tags/zudo-doc-v10.0.4`) : undefined) });
    expect(await stepMain(["guard", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4"], split.deps)).toBe(1);
    expect(split.logs.join()).toMatch(/Lockstep tag v10.0.4/);
    const offMain = stepDeps({ registry, files, exec: (c, a) => (a[0] === "merge-base" ? { status: 1, stdout: "", stderr: "" } : undefined) });
    expect(await stepMain(["guard", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4"], offMain.deps)).toBe(1);
  });

  it("fails closed (exit 2) when the registry state is unknown", async () => {
    const registry = fakeRegistry({ "@takazudo/zudo-doc": { unknown: true, versions: {}, tags: {} } });
    const { deps, logs } = stepDeps({ registry, files });
    expect(await stepMain(["guard", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4"], deps)).toBe(2);
    expect(logs.join("\n")).toMatch(/UNKNOWN \(not absent\)/);
  });

  it("resumes an existing version from this source and refuses a foreign one", async () => {
    const mine = fakeRegistry({ "@takazudo/zudo-doc": { versions: { "10.0.4": { sha: SHA } }, tags: {} } });
    const resume = stepDeps({ registry: mine, files });
    expect(await stepMain(["guard", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4"], resume.deps)).toBe(0);
    expect(resume.logs.join()).toMatch(/NOT a fresh publication/);
    const foreign = fakeRegistry({ "@takazudo/zudo-doc": { versions: { "10.0.4": { sha: OTHER } }, tags: {} } });
    expect(await stepMain(["guard", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4"], stepDeps({ registry: foreign, files }).deps)).toBe(1);
    const unindexed = fakeRegistry({ "@takazudo/zudo-doc": { versions: { "10.0.4": { sha: SHA, noProvenance: true } }, tags: {} } });
    const u = stepDeps({ registry: unindexed, files });
    expect(await stepMain(["guard", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4"], u.deps)).toBe(2);
    expect(writesIn(u.execCalls)).toEqual([]);
  });
});

describe("publish-step publish is tokenless", () => {
  const registry = fakeRegistry({});

  it("refuses a static npm token and never runs publish", async () => {
    const { deps, execCalls, logs } = stepDeps({ registry, env: { NODE_AUTH_TOKEN: "secret" } });
    expect(await stepMain(["publish", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4"], deps)).toBe(1);
    expect(logs.join()).toMatch(/Static npm credential present \(NODE_AUTH_TOKEN\)/);
    expect(writesIn(execCalls)).toEqual([]);
  });

  it("refuses a token stored in an npmrc file (npm will not print protected keys)", async () => {
    const { deps, execCalls, logs } = stepDeps({
      registry,
      files: { "/repo/.npmrc": "auto-install-peers=true\n//registry.npmjs.org/:_authToken=npm_secret\n" },
      exec: (c, a) => (a[0] === "config" && a[1] === "get" ? ok(`/home/${a[2]}`) : undefined),
    });
    deps.readFile = (p) => {
      if (p === "/repo/.npmrc") return "auto-install-peers=true\n//registry.npmjs.org/:_authToken=npm_secret\n";
      throw new Error("ENOENT");
    };
    expect(await stepMain(["publish", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4"], deps)).toBe(1);
    expect(logs.join()).toMatch(/credential in \/repo\/.npmrc/);
    expect(writesIn(execCalls)).toEqual([]);
  });

  it("refuses without an OIDC token endpoint — there is no token fallback", async () => {
    const { deps, execCalls } = stepDeps({ registry });
    deps.env = {};
    expect(await stepMain(["publish", "--package", "history-server", "--tag", "zudo-doc-history-server-10.0.4"], deps)).toBe(1);
    expect(writesIn(execCalls)).toEqual([]);
  });

  it("publishes pnpm packages through pnpm (workspace rewrite) and create-zudo-doc through npm", async () => {
    const a = stepDeps({ registry });
    expect(await stepMain(["publish", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4"], a.deps)).toBe(0);
    expect(writesIn(a.execCalls)).toEqual(["pnpm --filter @takazudo/zudo-doc publish --access public --provenance --no-git-checks --tag latest"]);
    const b = stepDeps({ registry });
    expect(await stepMain(["publish", "--package", "create-zudo-doc", "--tag", "v10.1.0-next.1"], b.deps)).toBe(0);
    expect(writesIn(b.execCalls)).toEqual(["npm publish --access public --provenance --tag next"]);
  });

  it("propagates the original failure and points at the trusted publisher", async () => {
    const { deps, logs } = stepDeps({ registry, exec: (c, a) => (a.includes("publish") ? { status: 1, stdout: "", stderr: "ENEEDAUTH" } : undefined) });
    expect(await stepMain(["publish", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4"], deps)).toBe(1);
    expect(logs.join("\n")).toMatch(/Workflow filename: publish-zudo-doc.yml/);
  });
});

describe("publish-step finalize and next maintenance", () => {
  it("repairs a lagging channel via OIDC dist-tag and reports a resumed version as not fresh", async () => {
    const reg = { "@takazudo/zudo-doc": { versions: { "10.0.4": { sha: SHA } }, tags: { latest: "10.0.3" } } };
    const registry = fakeRegistry(reg);
    const { deps, logs, execCalls } = stepDeps({
      registry,
      exec: (c, a) => {
        if (a[0] === "dist-tag" && a[1] === "add") {
          reg["@takazudo/zudo-doc"].tags.latest = "10.0.4";
          return ok("");
        }
        return undefined;
      },
    });
    expect(await stepMain(["finalize", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4", "--mode", "resume"], deps)).toBe(0);
    expect(writesIn(execCalls)).toEqual(["npm dist-tag add @takazudo/zudo-doc@10.0.4 latest"]);
    expect(logs.join()).toMatch(/pre-existing version \(resumed finalization; not a fresh publication\)/);
  });

  it("does not move a channel held by a newer version", async () => {
    const registry = fakeRegistry({ "@takazudo/zudo-doc": { versions: { "10.0.4": { sha: SHA } }, tags: { latest: "11.0.0" } } });
    const { deps, execCalls } = stepDeps({ registry });
    expect(await stepMain(["finalize", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4"], deps)).toBe(1);
    expect(writesIn(execCalls)).toEqual([]);
  });

  it("reports a not-yet-visible version as unknown (exit 2), not absent", async () => {
    const registry = fakeRegistry({ "@takazudo/zudo-doc": { versions: {}, tags: {} } });
    expect(await stepMain(["finalize", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4"], stepDeps({ registry }).deps)).toBe(2);
  });

  // #4785: 11.0.0's finalize gave up after 12 probes (~2 min) while npm was
  // still propagating a successful publish.
  it("waits several minutes for a freshly published version before finalizing", async () => {
    const reg = { "@takazudo/zudo-doc": { versions: { "10.0.4": { sha: SHA } }, tags: { latest: "10.0.4" }, staleReads: 30 } };
    const { deps, execCalls } = stepDeps({ registry: fakeRegistry(reg) });
    delete deps.pollAttempts;
    delete deps.pollDelayMs;
    const slept = [];
    deps.sleep = async (ms) => void slept.push(ms);
    expect(FINALIZE_VISIBILITY_ATTEMPTS * 10_000).toBeGreaterThanOrEqual(5 * 60_000);
    expect(await stepMain(["finalize", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4"], deps)).toBe(0);
    expect(slept.slice(0, 30)).toEqual(Array(30).fill(10_000));
    expect(writesIn(execCalls)).toEqual([]);
  });

  it("times out as UNKNOWN (exit 2) after the full visibility wait, without any write", async () => {
    const registry = fakeRegistry({ "@takazudo/zudo-doc": { versions: {}, tags: { latest: "10.0.3" } } });
    const { deps, logs, execCalls } = stepDeps({ registry });
    delete deps.pollAttempts;
    const slept = [];
    deps.sleep = async (ms) => void slept.push(ms);
    expect(await stepMain(["finalize", "--package", "zudo-doc", "--tag", "zudo-doc-v10.0.4"], deps)).toBe(2);
    expect(slept).toHaveLength(FINALIZE_VISIBILITY_ATTEMPTS - 1);
    expect(registry.calls.filter((u) => u.endsWith("/10.0.4"))).toHaveLength(FINALIZE_VISIBILITY_ATTEMPTS);
    expect(logs.join("\n")).toMatch(/state UNKNOWN, not absent\. Re-run to resume/);
    expect(writesIn(execCalls)).toEqual([]);
  });

  it("removes only a stale next and records the outcome", async () => {
    const reg = { create: { versions: { "10.0.4": { sha: SHA } }, tags: { latest: "10.0.4", next: "10.0.4-next.2" } } };
    const registry = fakeRegistry({ "create-zudo-doc": reg.create });
    const { deps, logs, execCalls } = stepDeps({ registry, exec: (c, a) => (a[1] === "rm" ? (delete reg.create.tags.next, ok("")) : undefined) });
    expect(await stepMain(["cleanup-next", "--package", "create-zudo-doc", "--tag", "v10.0.4"], deps)).toBe(0);
    expect(writesIn(execCalls)).toEqual(["npm dist-tag rm create-zudo-doc next"]);
    expect(logs.join()).toMatch(/removed stale next=10.0.4-next.2/);
  });

  it("keeps a newer preview and leaves next alone when it changes mid-decision", async () => {
    const newer = stepDeps({ registry: fakeRegistry({ "create-zudo-doc": { versions: {}, tags: { next: "11.0.0-next.1" } } }) });
    expect(await stepMain(["cleanup-next", "--package", "create-zudo-doc", "--tag", "v10.0.4"], newer.deps)).toBe(0);
    expect(writesIn(newer.execCalls)).toEqual([]);
    expect(newer.logs.join()).toMatch(/kept-newer-preview/);

    let reads = 0;
    const racing = {
      fetchImpl: async (url) => (url.includes("/dist-tags") ? jsonResponse(200, { next: reads++ === 0 ? "10.0.4-next.2" : "11.0.0-next.1" }) : jsonResponse(404, {})),
    };
    const race = stepDeps({ registry: racing });
    expect(await stepMain(["cleanup-next", "--package", "create-zudo-doc", "--tag", "v10.0.4"], race.deps)).toBe(0);
    expect(writesIn(race.execCalls)).toEqual([]);
    expect(race.logs.join()).toMatch(/race-left-in-place/);
  });

  it("restores next when a newer preview landed during removal", async () => {
    const tags = { next: "10.0.4-next.2" };
    const registry = fakeRegistry({ "create-zudo-doc": { versions: { "10.0.4": { sha: SHA }, "10.1.0-next.1": { sha: SHA, time: "2026-11-12T00:00:01Z" } }, tags } });
    const { deps, logs, execCalls } = stepDeps({ registry, exec: (c, a) => (a[0] === "dist-tag" ? (a[1] === "rm" ? delete tags.next : (tags.next = "10.1.0-next.1"), ok("")) : undefined) });
    expect(await stepMain(["cleanup-next", "--package", "create-zudo-doc", "--tag", "v10.0.4"], deps)).toBe(0);
    expect(writesIn(execCalls)).toEqual(["npm dist-tag rm create-zudo-doc next", "npm dist-tag add create-zudo-doc@10.1.0-next.1 next"]);
    expect(logs.join()).toMatch(/race-restored/);
  });

  it("isolates maintenance failures with an accurate outcome", async () => {
    const unreadable = stepDeps({ registry: fakeRegistry({ "create-zudo-doc": { unknown: true, versions: {}, tags: {} } }) });
    expect(await stepMain(["cleanup-next", "--package", "create-zudo-doc", "--tag", "v10.0.4"], unreadable.deps)).toBe(2);
    expect(unreadable.logs.join()).toMatch(/: unknown/);
    const failing = stepDeps({
      registry: fakeRegistry({ "create-zudo-doc": { versions: {}, tags: { next: "10.0.4-next.2" } } }),
      exec: (c, a) => (a[1] === "rm" ? { status: 1, stdout: "", stderr: "E403" } : undefined),
    });
    expect(await stepMain(["cleanup-next", "--package", "create-zudo-doc", "--tag", "v10.0.4"], failing.deps)).toBe(1);
    expect(failing.logs.join()).toMatch(/: failed/);
  });
});

// ── orchestrator ─────────────────────────────────────────────────────────────

const tmpDirs = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A fake GitHub + registry world for the orchestrator. */
function world({ npm, releases = {}, tags = {}, failRuns = new Set(), releaseEventsTrigger = true }) {
  const dir = mkdtempSync(join(tmpdir(), "release-orch-"));
  tmpDirs.push(dir);
  writeFileSync(join(dir, "integration.json"), JSON.stringify({ ok: true, integration: SHA }));
  let clock = Date.parse("2026-11-12T00:00:00Z");
  let nextRunId = 100;
  const runs = [];
  const registry = fakeRegistry(npm);
  const actions = [];
  const startRun = (pkg, tag, event) => {
    const id = nextRunId++;
    const run = { id, run_attempt: 1, event, head_branch: tag, head_sha: SHA, status: "queued", conclusion: null, created_at: new Date(clock).toISOString(), html_url: `https://gh/runs/${id}`, pkg };
    runs.push(run);
    return run;
  };
  const complete = (run) => {
    run.status = "completed";
    if (failRuns.has(run.pkg.key)) {
      run.conclusion = "failure";
      return;
    }
    run.conclusion = "success";
    const version = run.head_branch.slice(run.pkg.tagPrefix.length);
    const entry = npm[run.pkg.name];
    if (!entry.versions[version]) entry.versions[version] = { sha: SHA, run: run.id, attempt: 1 };
    entry.tags[version.includes("-") ? "next" : "latest"] = version;
  };
  const exec = (cmd, args) => {
    const line = [cmd, ...args].join(" ");
    if (cmd === "git" && args[0] === "ls-remote") {
      const tag = args[3].replace("refs/tags/", "");
      return ok(tags[tag] ? `${tags[tag]}\trefs/tags/${tag}^{}` : "");
    }
    if (cmd === "gh" && args[0] === "release" && args[1] === "view") {
      const r = releases[args[2]];
      return r ? ok(JSON.stringify({ tagName: args[2], isDraft: r.draft, isPrerelease: false, name: r.name })) : { status: 1, stdout: "", stderr: "release not found" };
    }
    if (cmd === "gh" && args[0] === "release" && args[1] === "edit") {
      actions.push(line);
      if (args.includes("--draft=false")) {
        releases[args[2]].draft = false;
        const pkg = PACKAGES.find((p) => args[2].startsWith(p.tagPrefix) && /^\d/.test(args[2].slice(p.tagPrefix.length)));
        if (releaseEventsTrigger) startRun(pkg, args[2], "release");
      }
      return ok("");
    }
    if (cmd === "gh" && args[0] === "release" && args[1] === "list") return ok(JSON.stringify([{ tagName: "v10.0.4", isLatest: true }]));
    if (cmd === "gh" && args[0] === "workflow" && args[1] === "run") {
      actions.push(line);
      const pkg = PACKAGES.find((p) => p.workflow === args[2]);
      startRun(pkg, args[args.indexOf("--ref") + 1], "workflow_dispatch");
      return ok("");
    }
    if (cmd === "gh" && args[0] === "api") {
      const path = args[1];
      let m;
      if ((m = /actions\/workflows\/([^/]+)\/runs/.exec(path))) {
        return ok(JSON.stringify({ workflow_runs: runs.filter((r) => r.pkg.workflow === m[1]) }));
      }
      if ((m = /actions\/runs\/(\d+)$/.exec(path))) {
        const run = runs.find((r) => r.id === Number(m[1]));
        if (run.status !== "completed") complete(run);
        return ok(JSON.stringify(run));
      }
    }
    throw new Error(`unexpected exec ${line}`);
  };
  const logs = [];
  const deps = {
    exec,
    fetchImpl: registry.fetchImpl,
    sleep: async () => {
      clock += 15_000;
    },
    now: () => clock,
    log: (s) => logs.push(s),
    cwd: dir,
    env: {},
    readFile: (p) => readFileSync(p, "utf8"),
    writeFile: (p, s) => {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, s);
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
  return { dir, deps, logs, actions, runs, npm };
}

const allTags = Object.fromEntries(PACKAGES.map((p) => [`${p.tagPrefix}10.0.4`, SHA]));
const drafts = () => Object.fromEntries(PACKAGES.map((p) => [`${p.tagPrefix}10.0.4`, { draft: true, name: `${p.name} 10.0.4` }]));

describe("release orchestrator publication", () => {
  it("publishes in order history-server → zudo-doc → create-zudo-doc", async () => {
    const w = world({ npm: Object.fromEntries(PACKAGES.map((p) => [p.name, { versions: {}, tags: { latest: "10.0.3" } }])), releases: drafts(), tags: allTags });
    expect(await releaseMain(["publish", "--version", "10.0.4", "--evidence", w.dir], w.deps)).toBe(0);
    expect(w.actions.filter((a) => a.includes("--draft=false"))).toEqual(PACKAGES.map((p) => `gh release edit ${p.tagPrefix}10.0.4 --repo zudolab/zudo-doc --draft=false`));
    const ev = JSON.parse(readFileSync(join(w.dir, "publication.json"), "utf8"));
    expect(Object.values(ev.packages).map((p) => [p.state, p.freshPublication])).toEqual([["complete", true], ["complete", true], ["complete", true]]);
  });

  it("resumes a partial publication without republishing and finishes an interrupted finalization", async () => {
    const npm = {
      [HISTORY.name]: { versions: { "10.0.4": { sha: SHA, run: 1 } }, tags: { latest: "10.0.4" } },
      [ZUDO.name]: { versions: { "10.0.4": { sha: SHA, run: 2 } }, tags: { latest: "10.0.3" } },
      [CREATE.name]: { versions: {}, tags: { latest: "10.0.3" } },
    };
    const releases = drafts();
    releases[`${HISTORY.tagPrefix}10.0.4`].draft = false;
    releases[`${ZUDO.tagPrefix}10.0.4`].draft = false;
    const w = world({ npm, releases, tags: allTags });
    expect(await releaseMain(["publish", "--version", "10.0.4", "--evidence", w.dir], w.deps)).toBe(0);
    expect(w.actions).toEqual([
      "gh workflow run publish-zudo-doc.yml --repo zudolab/zudo-doc --ref zudo-doc-v10.0.4 -f dry_run=false",
      "gh release edit v10.0.4 --repo zudolab/zudo-doc --draft=false",
    ]);
    const ev = JSON.parse(readFileSync(join(w.dir, "publication.json"), "utf8"));
    expect(ev.packages["history-server"]).toMatchObject({ state: "complete", freshPublication: false });
    expect(ev.packages["zudo-doc"]).toMatchObject({ state: "complete", freshPublication: false });
    expect(ev.packages["create-zudo-doc"]).toMatchObject({ state: "complete", freshPublication: true });
  });

  it("dispatches explicitly when a release event starts no workflow", async () => {
    const w = world({ npm: Object.fromEntries(PACKAGES.map((p) => [p.name, { versions: {}, tags: {} }])), releases: drafts(), tags: allTags, releaseEventsTrigger: false });
    expect(await releaseMain(["publish", "--version", "10.0.4", "--evidence", w.dir], w.deps)).toBe(0);
    expect(w.actions.filter((a) => a.startsWith("gh workflow run"))).toHaveLength(3);
  });

  it("polls through a stale 'absent' read after a successful run instead of publishing again", async () => {
    const npm = Object.fromEntries(PACKAGES.map((p) => [p.name, { versions: {}, tags: {} }]));
    const w = world({ npm, releases: drafts(), tags: allTags });
    const originalExec = w.deps.exec;
    let armed = true;
    w.deps.exec = (cmd, args) => {
      const r = originalExec(cmd, args);
      if (armed && cmd === "gh" && args[0] === "api" && /actions\/runs\/\d+$/.test(args[1])) {
        armed = false;
        npm[HISTORY.name].staleReads = 3;
      }
      return r;
    };
    expect(await releaseMain(["publish", "--version", "10.0.4", "--evidence", w.dir], w.deps)).toBe(0);
    expect(w.actions.filter((a) => a.includes("zudo-doc-history-server"))).toHaveLength(1);
  });

  it("fails rather than marking complete when the channel never reaches the version", async () => {
    const npm = { [HISTORY.name]: { versions: { "10.0.4": { sha: SHA, run: 1 } }, tags: { latest: "10.0.3" } } };
    const w = world({ npm, releases: { ...drafts(), "zudo-doc-history-server-10.0.4": { draft: false, name: "x" } }, tags: allTags });
    const originalExec = w.deps.exec;
    w.deps.exec = (cmd, args) => {
      const r = originalExec(cmd, args);
      npm[HISTORY.name].tags.latest = "10.0.3";
      return r;
    };
    expect(await releaseMain(["publish", "--version", "10.0.4", "--evidence", w.dir], w.deps)).toBe(1);
    expect(w.logs.join()).toMatch(/channel latest still reads 10.0.3/);
    expect(w.actions.some((a) => a.includes("zudo-doc-v10.0.4"))).toBe(false);
  });

  it("stops on registry uncertainty without initiating anything", async () => {
    const w = world({ npm: { [HISTORY.name]: { unknown: true, versions: {}, tags: {} } }, releases: drafts(), tags: allTags });
    expect(await releaseMain(["publish", "--version", "10.0.4", "--evidence", w.dir], w.deps)).toBe(2);
    expect(w.actions).toEqual([]);
    expect(w.logs.join()).toMatch(/not treated as absent/);
  });

  it("stops the order at a failed publish run", async () => {
    const w = world({ npm: Object.fromEntries(PACKAGES.map((p) => [p.name, { versions: {}, tags: {} }])), releases: drafts(), tags: allTags, failRuns: new Set(["zudo-doc"]) });
    expect(await releaseMain(["publish", "--version", "10.0.4", "--evidence", w.dir], w.deps)).toBe(1);
    expect(w.actions.some((a) => a.startsWith("gh release edit v10.0.4 "))).toBe(false);
    expect(w.actions.some((a) => a.startsWith("gh release edit zudo-doc-v10.0.4 "))).toBe(true);
  });

  it("refuses a foreign existing version and a tag at another SHA", async () => {
    const foreign = world({ npm: { [HISTORY.name]: { versions: { "10.0.4": { sha: OTHER } }, tags: {} } }, releases: drafts(), tags: allTags });
    expect(await releaseMain(["publish", "--version", "10.0.4", "--evidence", foreign.dir], foreign.deps)).toBe(1);
    expect(foreign.actions).toEqual([]);
    const moved = world({ npm: {}, releases: drafts(), tags: { ...allTags, "zudo-doc-history-server-10.0.4": OTHER } });
    expect(await releaseMain(["publish", "--version", "10.0.4", "--evidence", moved.dir], moved.deps)).toBe(1);
    expect(moved.actions).toEqual([]);
  });
});

describe("workflow and instruction contracts", () => {
  const read = (p) => readFileSync(join(ROOT, p), "utf8");

  for (const pkg of PACKAGES) {
    it(`${pkg.workflow} is tokenless, job-scoped and resumable`, () => {
      const y = read(`.github/workflows/${pkg.workflow}`);
      expect(y).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN|npm whoami|\|\| true/);
      expect(y).toMatch(/^permissions: \{\}$/m);
      expect(y).toMatch(/^ {4}permissions:\n {6}contents: read\n {6}id-token: write$/m);
      expect(y).toMatch(/runs-on: ubuntu-latest/);
      expect(y).toMatch(/types: \[published\]/);
      expect(y).toMatch(/workflow_dispatch:/);
      expect(y).toContain(`group: publish-${pkg.workflow.replace(/^publish-|\.yml$/g, "")}`);
      expect(y).toContain(`args=(guard --package ${pkg.key} --tag "$TAG")`);
      expect(y).toContain('node scripts/release/publish-step.mjs "${args[@]}"');
      for (const step of ["toolchain", `pack-check --package ${pkg.key}`, `publish --package ${pkg.key}`, `finalize --package ${pkg.key}`, `cleanup-next --package ${pkg.key}`]) {
        expect(y).toContain(`publish-step.mjs ${step}`);
      }
      for (const uses of y.match(/uses: \S+/g) ?? []) expect(uses).toMatch(/^uses: (\.\/|[\w.-]+\/[\w.-]+@[0-9a-f]{40}$)/);
      expect(y).toMatch(/Write authorization \(the OIDC/);
      expect(y).toMatch(/is NOT verified by a dry run/);
    });
  }

  it("the setup action no longer wires registry auth", () => {
    expect(read(".github/actions/setup-node-pnpm/action.yml")).not.toMatch(/registry-url|NODE_AUTH_TOKEN/);
  });

  it("Claude and Codex entries share RELEASE.md and the same helpers", () => {
    const claude = read(".claude/skills/l-make-release/SKILL.md");
    const codex = read(".codex/skills/l-make-release/SKILL.md");
    expect(codex).toBe(claude);
    expect(claude).toContain("RELEASE.md");
    expect(claude).toContain("scripts/release/release.mjs");
    expect(claude).not.toMatch(/\$HOME|~\/\.claude|secrets\.NPM_TOKEN|NODE_AUTH_TOKEN/);
    const runbook = read("RELEASE.md");
    for (const sub of ["preflight", "a2-evidence", "integration", "tag", "releases", "publish", "status"]) {
      expect(runbook).toContain(`node scripts/release/release.mjs ${sub}`);
    }
    expect(runbook).not.toMatch(/secrets\.NPM_TOKEN|NODE_AUTH_TOKEN|npm whoami|node scripts\/release-bootstrap-latest|\$HOME/);
  });
});
