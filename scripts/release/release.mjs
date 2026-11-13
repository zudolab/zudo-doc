#!/usr/bin/env node
// Release orchestrator shared by local Claude Code and Codex Cloud sessions.
// RELEASE.md, "Release procedure", is the canonical description of every step;
// this CLI is its deterministic half. It needs `git`, `gh` (authenticated as a
// user or app with the capabilities `preflight` reports), Node 24 and `unzip`.
// It never needs an npm credential: npm writes happen only inside the publish
// workflows through OIDC.
//
//   preflight
//   a2-evidence  --pr N --run ID --attempt N --candidate SHA --base SHA --out DIR
//   integration  --evidence DIR/a2-evidence.json --integration SHA --out DIR
//   tag          --version V --evidence DIR [--via git|api]
//   releases     --version V --evidence DIR
//   publish      --version V --evidence DIR [--initiation release|dispatch] [--initiate-timeout S] [--run-timeout S]
//   status       --version V [--integration SHA]
//
// Actions release path (RELEASE.md, "Actions release path"; run by
// .github/workflows/release-actions.yml, never by a Cloud shell):
//   admit              --version V --integration SHA --pr N --run ID --attempt N --candidate SHA
//                      --base SHA --artifact-id ID --artifact-digest sha256:HEX --out DIR
//   finalize-releases  --version V --evidence DIR
//   actions-inputs     --version V --evidence DIR   (read-only; prints the dispatch inputs)
//
// Exit codes: 0 ok, 1 blocked/failed, 2 unknown (retry later; never treated as absent).

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  A2_ARTIFACT_NAME,
  A2_JOB_NAME,
  ACTIONS_RELEASE_WORKFLOW,
  NPM_CLI_PIN,
  PACKAGES,
  REPO,
  ReleaseError,
  decideChannel,
  decideStaleNext,
  distTagFor,
  evaluateExistingVersion,
  compareAdmission,
  decideTag,
  extractNotes,
  isFullSha,
  lookupVersion,
  matchingPublishRuns,
  mainPushApplicability,
  parseSemver,
  readDistTags,
  readProvenance,
  registryGet,
  releaseTitle,
  tagFor,
  validateAdmissionInputs,
  verifyA2Evidence,
  verifyIntegration,
} from "./lib.mjs";

/**
 * @typedef {{status: number|null, stdout: string, stderr: string}} ExecResult
 * @typedef {{
 *   exec: (cmd: string, args: string[], opts?: {cwd?: string, stdoutFile?: string, input?: string}) => ExecResult,
 *   fetchImpl?: typeof fetch, sleep: (ms: number) => Promise<unknown>, now: () => number,
 *   log: (s: string) => void, cwd: string, env: NodeJS.ProcessEnv,
 *   readFile: (p: string) => string, writeFile: (p: string, s: string) => void, exists: (p: string) => boolean,
 *   pollMs?: number,
 * }} Deps
 */

/** @returns {Deps} */
export function realDeps() {
  return {
    exec: (cmd, args, opts = {}) => {
      const fd = opts.stdoutFile ? openSync(opts.stdoutFile, "w") : undefined;
      try {
        const r = spawnSync(cmd, args, {
          cwd: opts.cwd,
          encoding: "utf8",
          input: opts.input,
          maxBuffer: 256 * 1024 * 1024,
          stdio: [opts.input === undefined ? "ignore" : "pipe", fd ?? "pipe", "pipe"],
        });
        if (r.error) return { status: null, stdout: "", stderr: r.error.message };
        return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
      } finally {
        if (fd !== undefined) closeSync(fd);
      }
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
    log: (s) => console.log(s),
    cwd: process.cwd(),
    env: process.env,
    readFile: (p) => readFileSync(p, "utf8"),
    writeFile: (p, s) => {
      mkdirSync(resolve(p, ".."), { recursive: true });
      writeFileSync(p, s);
    },
    exists: (p) => existsSync(p),
  };
}

/** @param {string[]} argv */
function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  /** @type {Record<string, string>} */
  const opts = {};
  for (let i = 0; i < rest.length; i += 2) {
    const k = rest[i] ?? "";
    const v = rest[i + 1];
    if (!k.startsWith("--") || v === undefined) throw new ReleaseError(`Expected --key value pairs, got '${k}'`);
    opts[k.slice(2)] = v;
  }
  return { cmd, opts };
}

/** @param {Record<string,string>} o @param {string} k */
function req(o, k) {
  const v = o[k];
  if (!v) throw new ReleaseError(`Missing --${k}`);
  return v;
}

const unknown = (/** @type {string} */ msg) => Object.assign(new ReleaseError(msg), { exitCode: 2 });

/**
 * GET via gh with bounded retries. A 404 is returned as null; a definite 401/403
 * (not a rate limit) is a denial; a rate limit, transport or 5xx failure that
 * does not clear is "unknown" (exit 2), never a denial and never "absent".
 */
async function ghJson(/** @type {Deps} */ d, /** @type {string} */ path, attempts = 3) {
  let last = "";
  for (let i = 1; i <= attempts; i++) {
    const r = d.exec("gh", ["api", path]);
    if (r.status === 0) return JSON.parse(r.stdout);
    last = r.stderr.trim();
    if (/HTTP 404|Not Found/.test(last)) return null;
    const c = classifyGhFailure(last);
    if (c.state === "denied" || c.state === "missing") throw new ReleaseError(`gh api ${path}: ${last}`);
    if (i < attempts) await d.sleep(2000 * i);
  }
  throw unknown(`gh api ${path} did not answer after ${attempts} attempts: ${last}`);
}

/** @param {Deps} d @param {string} cmd @param {string[]} args @param {{cwd?: string, stdoutFile?: string}} [opts] */
function must(d, cmd, args, opts) {
  const r = d.exec(cmd, args, opts);
  if (r.status !== 0) throw new ReleaseError(`\`${cmd} ${args.join(" ")}\` failed (exit ${r.status}): ${(r.stderr || r.stdout).trim()}`);
  return r.stdout.trim();
}

/** @param {Deps} d @param {string} sha */
async function commitInfo(d, sha) {
  const c = await ghJson(d, `repos/${REPO}/git/commits/${sha}`);
  return c ? { sha: c.sha, tree: c.tree.sha, parents: c.parents.map((/** @type {any} */ p) => p.sha) } : null;
}

/** @param {Deps} d @param {string} file */
function readJson(d, file) {
  if (!d.exists(file)) throw new ReleaseError(`Missing evidence file ${file}`);
  return JSON.parse(d.readFile(file));
}

// ── preflight ────────────────────────────────────────────────────────────────
//
// Preflight only ever issues read-only requests. Each row says how its state was
// established: `observed` (the read was exercised and succeeded), `inferred`
// (repository-role metadata, which is not proof of what the active credential
// may do), `denied`/`missing` (confirmed), or `unknown` (ambiguous 404, rate
// limit, transport/5xx failure, no sample to read, or not exercised).

const TOKEN_RE = /\b(gh[pousr]_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,})\b/g;

/** Drop credentials that could ride along in a remote URL or a CLI message. */
export function redact(/** @type {string} */ s) {
  return s
    .replace(/(https?:\/\/)[^/@\s]+@/g, "$1***@")
    .replace(/(authorization:\s*)\S+(\s+\S+)?/gi, "$1***")
    .replace(/\b(bearer|token)\s+[A-Za-z0-9._-]{8,}/gi, "$1 ***")
    .replace(TOKEN_RE, "***");
}

/**
 * Classify a failed `gh api` call from its stderr without echoing it.
 * @returns {{state: "missing"|"denied"|"unknown", why: string}}
 */
export function classifyGhFailure(/** @type {string} */ stderr) {
  const code = /HTTP (\d{3})/.exec(stderr)?.[1];
  if (!code && /gh auth login|not logged in/i.test(stderr)) return { state: "missing", why: "gh has no credential" };
  if (code === "429" || /rate limit/i.test(stderr)) return { state: "unknown", why: "rate limited" };
  if (code === "401" || code === "403") return { state: "denied", why: `HTTP ${code}` };
  if (code === "404") return { state: "unknown", why: "HTTP 404 (absent or not visible to this credential)" };
  if (code) return { state: "unknown", why: `HTTP ${code}` };
  return { state: "unknown", why: "transport failure (no HTTP response)" };
}

/**
 * One bounded read-only GET. Definite answers (missing credential, 4xx) are final;
 * rate limits, transport/5xx failures and unparseable bodies get one retry.
 * @param {Deps} d @param {string} path
 * @returns {Promise<{state: "observed"|"missing"|"denied"|"unknown", why: string, body?: any}>}
 */
async function ghProbe(d, path, attempts = 2) {
  /** @type {{state: "missing"|"denied"|"unknown", why: string}} */
  let last = { state: "unknown", why: "not attempted" };
  for (let i = 1; i <= attempts; i++) {
    const r = d.exec("gh", ["api", "-X", "GET", path]);
    if (r.status === 0) {
      try {
        return { state: "observed", why: "read succeeded", body: JSON.parse(r.stdout) };
      } catch {
        last = { state: "unknown", why: "unparseable response" };
      }
    } else {
      last = classifyGhFailure(r.stderr ?? "");
      if (last.state !== "unknown" || last.why.startsWith("HTTP 4")) return last;
    }
    if (i < attempts) await d.sleep(2000 * i);
  }
  return last;
}

/** @param {Deps} d */
export async function cmdPreflight(d) {
  const rows = [];
  let blocking = false;
  let unresolved = false;
  /**
   * @param {string} name
   * @param {"ok"|"observed"|"inferred"|"denied"|"missing"|"unknown"} state
   * @param {string} detail
   * @param {{required?: boolean}} [o] a required row blocks when denied/missing and
   *   leaves the run unresolved (exit 2) when unknown.
   */
  const row = (name, state, detail, { required = false } = {}) => {
    rows.push(`| ${name} | ${state} | ${redact(detail)} |`);
    if (!required) return;
    if (state === "denied" || state === "missing") blocking = true;
    if (state === "unknown") unresolved = true;
  };

  const git = d.exec("git", ["remote", "get-url", "origin"]);
  const gitOk = git.status === 0 && /[/:]zudolab\/zudo-doc(\.git)?$/.test(git.stdout.trim());
  row("git checkout of zudolab/zudo-doc", gitOk ? "ok" : "missing", git.stdout.trim() || git.stderr.trim().split("\n")[0] || "no origin", { required: true });
  const node = d.exec("node", ["--version"]).stdout.trim();
  row("Node >= 24", Number(/^v(\d+)/.exec(node)?.[1] ?? 0) >= 24 ? "ok" : "missing", node || "node not found", { required: true });
  const unzip = d.exec("unzip", ["-v"]);
  row("unzip", unzip.status === 0 ? "ok" : "missing", "extracts the A2 diagnostics artifact", { required: true });
  // `gh auth status` is a hint only: it can reject a credential that the API still accepts
  // (e.g. one injected by a proxy), so the reads below decide.
  const auth = d.exec("gh", ["auth", "status"]);
  const authLines = (auth.stderr || auth.stdout).split("\n").map((l) => l.trim()).filter(Boolean);
  const authWhy = authLines.find((l) => /^X\s|not logged|invalid|fail/i.test(l)) ?? authLines[0] ?? "";
  row("gh auth status", auth.status === 0 ? "ok" : "unknown", auth.status === 0 ? "gh reports a credential" : `gh reports no usable credential (${authWhy}); the API reads below decide`);

  const repo = await ghProbe(d, `repos/${REPO}`);
  row("read: repository metadata", repo.state, repo.why, { required: true });
  /** @type {Record<string, boolean>|undefined} */
  const perms = repo.state === "observed" && repo.body?.permissions && typeof repo.body.permissions === "object" ? repo.body.permissions : undefined;

  const commits = await ghProbe(d, `repos/${REPO}/commits?per_page=1`);
  row("read: commits", commits.state, commits.why, { required: true });

  const runs = await ghProbe(d, `repos/${REPO}/actions/runs?per_page=1`);
  row("read: workflow runs (metadata)", runs.state, runs.why, { required: true });
  const sample = runs.state === "observed" ? runs.body?.workflow_runs?.[0] : undefined;
  if (sample?.id) {
    const jobs = await ghProbe(d, `repos/${REPO}/actions/runs/${sample.id}/jobs?per_page=1`);
    row("read: workflow jobs (metadata)", jobs.state, `${jobs.why}; sample run ${sample.id}`, { required: true });
  } else {
    row("read: workflow jobs (metadata)", "unknown", runs.state === "observed" ? "no sample run to read" : "runs read did not succeed");
  }

  const artifacts = await ghProbe(d, `repos/${REPO}/actions/artifacts?per_page=1`);
  row("read: artifact list (metadata)", artifacts.state, `${artifacts.why}; a list is not a download`, { required: true });
  row("read: job logs", "unknown", "not exercised by preflight; `a2-evidence` reads it and stops if it fails");
  row("read: artifact download", "unknown", "not exercised by preflight; `a2-evidence` downloads and digest-checks it and stops if it fails");

  const role = perms === undefined ? undefined : Boolean(perms.push || perms.maintain || perms.admin);
  const roleDetail =
    role === undefined
      ? "role metadata unavailable; capability not established"
      : role
        ? "account role allows it; this credential's scope is not verified until the step runs"
        : "account role lacks push/maintain/admin";
  const writeState = role === undefined ? "unknown" : role ? "inferred" : "missing";
  row("write: contents (tags, releases)", writeState, `${roleDetail} (tag, releases)`);
  row("write: actions (workflow_dispatch)", writeState, `${roleDetail} (initiation/resume)`);

  const reg = await registryGet("/create-zudo-doc", { fetchImpl: d.fetchImpl, attempts: 2, sleep: d.sleep });
  row("npm registry read", reg.state === "ok" ? "observed" : reg.state === "absent" ? "missing" : "unknown", `public read of create-zudo-doc (${reg.state})`, { required: true });
  rows.push(`| npm credential | not used | npm writes happen only in publish-*.yml via OIDC (npm ${NPM_CLI_PIN.version}) |`);

  d.log(["| capability | state | detail |", "|---|---|---|", ...rows].join("\n"));
  if (blocking) {
    d.log("Preflight: a required capability is missing or denied — stop here.");
    return 1;
  }
  if (unresolved) {
    d.log("Preflight: a required read could not be established (unknown, not a denial) — retry later.");
    return 2;
  }
  if (role === false) d.log("Preflight: read-only session. Evidence and status work; tag/release/publish need a write-capable identity.");
  else if (role === undefined) d.log("Preflight: write capability unknown. Evidence and status work; confirm a write-capable identity before tag/release/publish.");
  d.log("Preflight: the nonpublishing checks above succeeded. This does not establish tag/release authorization, workflow_dispatch success or npm OIDC publication.");
  return 0;
}

// ── A2 evidence ──────────────────────────────────────────────────────────────

/** @param {Deps} d @param {Record<string,string>} o */
export async function cmdA2Evidence(d, o) {
  const prNumber = Number(req(o, "pr"));
  const runId = req(o, "run");
  const attempt = Number(req(o, "attempt"));
  const candidate = req(o, "candidate");
  const base = req(o, "base");
  const out = resolve(d.cwd, req(o, "out"));

  const run = await ghJson(d, `repos/${REPO}/actions/runs/${runId}/attempts/${attempt}`);
  if (!run) throw new ReleaseError(`Run ${runId} attempt ${attempt} not found`);
  const jobs = (await ghJson(d, `repos/${REPO}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`))?.jobs ?? [];
  const artifacts = (await ghJson(d, `repos/${REPO}/actions/runs/${runId}/artifacts?per_page=100`))?.artifacts ?? [];
  const a2 = jobs.find((/** @type {any} */ j) => j.name === A2_JOB_NAME);
  let jobLog = "";
  if (a2) {
    const r = d.exec("gh", ["api", `repos/${REPO}/actions/jobs/${a2.id}/logs`, "--allow-escape-sequences"]);
    if (r.status !== 0) throw unknown(`A2 job log unavailable: ${r.stderr.trim()}`);
    jobLog = r.stdout;
  }

  let manifest = null;
  /** @type {any} */
  let download = null;
  const candidates = artifacts.filter((/** @type {any} */ a) => a.name === A2_ARTIFACT_NAME && !a.expired);
  const chosen = a2
    ? candidates.find((/** @type {any} */ a) => Date.parse(a.created_at) >= Date.parse(a2.started_at) && Date.parse(a.created_at) <= Date.parse(a2.completed_at) + 120_000)
    : undefined;
  if (chosen) {
    const zip = join(out, `a2-diagnostics-${chosen.id}.zip`);
    d.writeFile(zip, "");
    must(d, "gh", ["api", `repos/${REPO}/actions/artifacts/${chosen.id}/zip`], { stdoutFile: zip });
    const sha256 = `sha256:${createHash("sha256").update(readFileSync(zip)).digest("hex")}`;
    download = { file: zip, sha256, matchesDigest: sha256 === chosen.digest };
    const dir = join(out, `a2-diagnostics-${chosen.id}`);
    must(d, "unzip", ["-o", "-q", zip, "-d", dir]);
    manifest = JSON.parse(d.readFile(join(dir, "manifest.json")));
  }

  const testedCommit = manifest?.sourceHead ? await commitInfo(d, manifest.sourceHead) : null;
  const cand = await commitInfo(d, candidate);
  const requiredRaw = await ghJson(d, `repos/${REPO}/contents/.required-checks-manifest?ref=${candidate}`);
  const requiredChecks = requiredRaw
    ? Buffer.from(requiredRaw.content, "base64").toString("utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    : [];
  if (!requiredChecks.length) throw new ReleaseError("Could not read .required-checks-manifest at the candidate");

  const result = verifyA2Evidence({
    prNumber,
    candidate,
    base,
    attempt,
    run,
    jobs,
    artifacts,
    jobLog,
    manifest,
    testedCommit,
    candidateTree: cand?.tree,
    requiredChecks,
  });
  if (download && !download.matchesDigest) result.errors.push(`downloaded artifact ${download.sha256} != recorded digest ${chosen.digest}`);
  const record = { ...result.record, artifactDownload: download, ok: result.errors.length === 0, errors: result.errors, recordedAt: new Date(d.now()).toISOString() };
  d.writeFile(join(out, "a2-evidence.json"), `${JSON.stringify(record, null, 2)}\n`);
  report(d, "A2 evidence", record.ok, result.errors, `${join(out, "a2-evidence.json")}`);
  return record.ok ? 0 : 1;
}

/** @param {Deps} d @param {string} title @param {boolean} ok @param {string[]} errors @param {string} file */
function report(d, title, ok, errors, file) {
  d.log(`${title}: ${ok ? "VERIFIED" : "BLOCKED"} → ${file}`);
  for (const e of errors) d.log(`  - ${e}`);
}

// ── integration binding ──────────────────────────────────────────────────────

/** @param {Deps} d @param {Record<string,string>} o */
export async function cmdIntegration(d, o) {
  const a2File = resolve(d.cwd, req(o, "evidence"));
  const a2 = readJson(d, a2File);
  if (!a2.ok) throw new ReleaseError(`A2 evidence ${a2File} is not verified; fix that first`);
  const integration = req(o, "integration");
  const out = resolve(d.cwd, req(o, "out"));

  const info = await commitInfo(d, integration);
  if (!info) throw new ReleaseError(`Integration ${integration} not found on GitHub`);
  const cmp = await ghJson(d, `repos/${REPO}/compare/${integration}...main`);
  if (!cmp) throw unknown("compare against main failed");
  const onMain = cmp.status === "identical" || cmp.status === "ahead";
  if (!a2.prNumber) throw new ReleaseError("A2 evidence has no PR number; re-run a2-evidence with --pr");
  const pr = await ghJson(d, `repos/${REPO}/pulls/${a2.prNumber}`);
  if (!pr) throw unknown(`PR #${a2.prNumber} not readable`);

  const files = (await ghJson(d, `repos/${REPO}/contents/.github/workflows?ref=${integration}`)) ?? [];
  const workflows = [];
  for (const f of files.filter((/** @type {any} */ f) => /\.ya?ml$/.test(f.name))) {
    const body = await ghJson(d, `repos/${REPO}/contents/${f.path}?ref=${integration}`);
    workflows.push({ path: f.path, applicability: mainPushApplicability(Buffer.from(body.content, "base64").toString("utf8")) });
  }
  const runs = (await ghJson(d, `repos/${REPO}/actions/runs?head_sha=${integration}&per_page=100`))?.workflow_runs ?? [];
  /** @type {Record<string, any[]>} */
  const jobsByRun = {};
  for (const r of runs.filter((/** @type {any} */ r) => r.event === "push")) {
    jobsByRun[String(r.id)] = (await ghJson(d, `repos/${REPO}/actions/runs/${r.id}/attempts/${r.run_attempt}/jobs?per_page=100`))?.jobs ?? [];
  }
  const result = verifyIntegration({
    integration,
    integrationTree: info.tree,
    integrationParents: info.parents,
    prMergeCommit: pr.merged ? pr.merge_commit_sha : `(PR #${a2.prNumber} not merged)`,
    onMain,
    a2,
    workflows,
    runs,
    jobsByRun,
  });
  const record = { ...result.record, a2Evidence: a2File, prNumber: a2.prNumber, ok: result.ok, errors: result.errors, recordedAt: new Date(d.now()).toISOString() };
  d.writeFile(join(out, "integration.json"), `${JSON.stringify(record, null, 2)}\n`);
  report(d, "Integration binding", result.ok, result.errors, join(out, "integration.json"));
  return result.ok ? 0 : 1;
}

/** @param {Deps} d @param {Record<string,string>} o */
function loadIntegration(d, o) {
  const file = join(resolve(d.cwd, req(o, "evidence")), "integration.json");
  const rec = readJson(d, file);
  if (!rec.ok) throw new ReleaseError(`${file} is not verified; tagging/publishing is blocked`);
  return rec;
}

/**
 * The admission record written by `admit` in the same Actions run. Its version
 * and integration must equal what the later job was asked to act on.
 * @param {Deps} d @param {Record<string,string>} o @param {string} version @param {string} sha
 */
function loadAdmission(d, o, version, sha) {
  const file = join(resolve(d.cwd, req(o, "evidence")), "admission.json");
  const adm = readJson(d, file);
  if (!adm.ok) throw new ReleaseError(`${file} is not admitted; no tag, release or dispatch is allowed`);
  if (adm.version !== version) throw new ReleaseError(`admission is for ${adm.version}, not ${version}`);
  if (adm.integration !== sha) throw new ReleaseError(`admission is for ${adm.integration}, not ${sha}`);
  return adm;
}

// ── tags (never moved) ───────────────────────────────────────────────────────

/** @param {Deps} d @param {string} tag @returns {string|null} peeled commit of a remote tag */
function remoteTag(d, tag) {
  const r = d.exec("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`, `refs/tags/${tag}^{}`]);
  if (r.status !== 0) throw unknown(`git ls-remote failed: ${r.stderr.trim()}`);
  const lines = r.stdout.trim().split("\n").filter(Boolean).map((l) => l.split("\t"));
  const peeled = lines.find(([, ref]) => ref?.endsWith("^{}")) ?? lines[0];
  return peeled ? (peeled[0] ?? null) : null;
}

/** Every package.json at the integration commit carries exactly this version. @param {Deps} d @param {string} sha @param {string} version */
function assertVersionsAt(d, sha, version) {
  must(d, "git", ["fetch", "--no-tags", "origin", sha]);
  for (const pkg of PACKAGES) {
    const v = JSON.parse(must(d, "git", ["show", `${sha}:${pkg.dir}/package.json`])).version;
    if (v !== version) throw new ReleaseError(`${pkg.dir}/package.json at ${sha} is ${v}, not ${version}`);
  }
}

/**
 * Re-read, immediately before a write, that the bound integration is still on
 * main's accepted history and still has the A2-tested tree. A recorded file is
 * not enough on its own: main could have been force-reset in between.
 * @param {Deps} d @param {any} rec
 */
async function recheckIntegration(d, rec) {
  const info = await commitInfo(d, rec.integration);
  if (!info) throw new ReleaseError(`Integration ${rec.integration} is no longer visible on GitHub`);
  if (info.tree !== rec.a2TestedTree) throw new ReleaseError(`Integration tree ${info.tree} != A2-tested tree ${rec.a2TestedTree}`);
  const cmp = await ghJson(d, `repos/${REPO}/compare/${rec.integration}...main`);
  if (!cmp) throw unknown("compare against main failed");
  if (cmp.status !== "identical" && cmp.status !== "ahead") throw new ReleaseError(`Integration ${rec.integration} is no longer on main (compare: ${cmp.status})`);
}

/**
 * Create one annotated tag through the REST API (the Actions path: the job's
 * GITHUB_TOKEN with `contents: write`). A 403/401 is reported verbatim with the
 * rulesets that are observable to this token; it is never routed around.
 * @param {Deps} d @param {string} tag @param {string} sha @param {string} message
 * @returns {Promise<"created"|"raced-same">}
 */
async function createTagViaApi(d, tag, sha, message) {
  const post = (/** @type {string} */ path, /** @type {object} */ body) => d.exec("gh", ["api", "-X", "POST", path, "--input", "-"], { input: JSON.stringify(body) });
  const obj = post(`repos/${REPO}/git/tags`, { tag, message, object: sha, type: "commit" });
  if (obj.status !== 0) await failTagWrite(d, tag, "create the annotated tag object", obj.stderr);
  const tagObject = JSON.parse(obj.stdout).sha;
  // An orphan tag object (ref creation failing after this point) is unreferenced and harmless.
  const ref = post(`repos/${REPO}/git/refs`, { ref: `refs/tags/${tag}`, sha: tagObject });
  if (ref.status !== 0) {
    if (/HTTP 422/.test(ref.stderr) && /already exists/i.test(ref.stderr)) {
      const now = remoteTag(d, tag);
      const decision = decideTag({ tag, existing: now, integration: sha });
      if (decision.action === "keep") return "raced-same";
      throw new ReleaseError(decision.action === "refuse" ? decision.reason : `${tag}: ref reported as existing but is not readable`);
    }
    await failTagWrite(d, tag, `create refs/tags/${tag}`, ref.stderr);
  }
  return "created";
}

/** @param {Deps} d @param {string} tag @param {string} what @param {string} stderr @returns {Promise<never>} */
async function failTagWrite(d, tag, what, stderr) {
  const c = classifyGhFailure(stderr);
  const msg = redact(stderr.trim().split("\n").slice(0, 6).join(" | "));
  if (c.state === "denied" || c.state === "missing") {
    d.log(`::error::GitHub refused to ${what} for ${tag} (${c.why}). Actual error: ${msg}`);
    const rs = await ghProbe(d, `repos/${REPO}/rulesets?includes_parents=true`);
    if (rs.state === "observed" && Array.isArray(rs.body)) {
      const list = rs.body.map((/** @type {any} */ r) => `${r.name} (target=${r.target}, enforcement=${r.enforcement})`).join("; ") || "none visible";
      d.log(`Observable rulesets for this token: ${list}`);
    } else {
      d.log(`Rulesets are not observable with this token (${rs.state}: ${rs.why}).`);
    }
    d.log("The job's effective GITHUB_TOKEN permissions are listed under 'Set up job' → 'GITHUB_TOKEN Permissions' in this job's log.");
    d.log("Cause is NOT asserted. Do not retry through another route (local tag push, PAT, protection bypass); hand the finding to the owner.");
    throw new ReleaseError(`Tag write refused for ${tag}: ${msg}`);
  }
  throw unknown(`Could not ${what} for ${tag} (${c.why}): ${msg}. Re-run: existing tags at the same SHA are kept, so the run resumes.`);
}

/** @param {Deps} d @param {Record<string,string>} o */
export async function cmdTag(d, o) {
  const version = req(o, "version");
  if (!parseSemver(version)) throw new ReleaseError(`Invalid version ${version}`);
  const via = o.via ?? "git";
  if (via !== "git" && via !== "api") throw new ReleaseError(`--via must be git or api, not ${via}`);
  const rec = loadIntegration(d, o);
  const sha = rec.integration;
  if (via === "api") loadAdmission(d, o, version, sha);
  assertVersionsAt(d, sha, version);
  // Decide all three first: a tag elsewhere refuses the whole release before any write.
  for (const pkg of PACKAGES) {
    const decision = decideTag({ tag: tagFor(pkg, version), existing: remoteTag(d, tagFor(pkg, version)), integration: sha });
    if (decision.action === "refuse") throw new ReleaseError(decision.reason);
  }
  for (const pkg of PACKAGES) {
    const tag = tagFor(pkg, version);
    // Re-read right before each write; a concurrent run may have created it meanwhile.
    await recheckIntegration(d, rec);
    const decision = decideTag({ tag, existing: remoteTag(d, tag), integration: sha });
    if (decision.action === "refuse") throw new ReleaseError(decision.reason);
    if (decision.action === "keep") {
      d.log(`${tag}: already at ${sha} (kept; resuming)`);
      continue;
    }
    const message = `chore: release ${pkg.name} ${version}`;
    if (via === "api") {
      const how = await createTagViaApi(d, tag, sha, message);
      if (how === "raced-same") {
        d.log(`${tag}: created concurrently at ${sha} (kept)`);
        continue;
      }
    } else {
      const local = d.exec("git", ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}^{commit}`]);
      if (local.status === 0 && local.stdout.trim() !== sha) throw new ReleaseError(`Local tag ${tag} targets ${local.stdout.trim()}; delete or fix it locally first`);
      if (local.status !== 0) must(d, "git", ["tag", "-a", tag, sha, "-m", message]);
      must(d, "git", ["push", "origin", `refs/tags/${tag}`]);
    }
    const pushed = remoteTag(d, tag);
    if (pushed !== sha) throw unknown(`Tag ${tag} readback is ${pushed}, expected ${sha}`);
    d.log(`${tag}: created at ${sha}`);
  }
  return 0;
}

// ── GitHub releases (one per tag; drafts until initiation) ────────────────────

/** @param {Deps} d @param {string} tag */
function viewRelease(d, tag) {
  const r = d.exec("gh", ["release", "view", tag, "--repo", REPO, "--json", "tagName,isDraft,isPrerelease,name,url"]);
  if (r.status === 0) return JSON.parse(r.stdout);
  if (/release not found|Not Found|HTTP 404/i.test(r.stderr)) return null;
  throw unknown(`gh release view ${tag}: ${r.stderr.trim()}`);
}

/** @param {Deps} d @param {Record<string,string>} o */
export async function cmdReleases(d, o) {
  const version = req(o, "version");
  const rec = loadIntegration(d, o);
  const pre = version.includes("-");
  must(d, "git", ["fetch", "--no-tags", "origin", rec.integration]);
  for (const pkg of PACKAGES) {
    const tag = tagFor(pkg, version);
    if (remoteTag(d, tag) !== rec.integration) throw new ReleaseError(`Tag ${tag} is missing or not at ${rec.integration}; run \`tag\` first`);
    const title = releaseTitle(pkg, version);
    const existing = viewRelease(d, tag);
    if (existing) {
      const problems = [];
      if (existing.name !== title) problems.push(`title '${existing.name}' != '${title}'`);
      if (existing.isPrerelease !== pre) problems.push(`prerelease=${existing.isPrerelease}, expected ${pre}`);
      if (problems.length) throw new ReleaseError(`Release ${tag} exists but ${problems.join("; ")}. Fix it in place; never create a second release.`);
      d.log(`${tag}: release exists (${existing.isDraft ? "draft" : "published"}) — kept`);
      continue;
    }
    // Notes come from the bound integration commit, not the working tree.
    const notes = extractNotes(must(d, "git", ["show", `${rec.integration}:src/content/docs/changelog/${pkg.slug}/${version}.mdx`]));
    const args = ["release", "create", tag, "--repo", REPO, "--verify-tag", "--draft", "--title", title, "--notes-file", "-"];
    if (pre) args.push("--prerelease");
    const r = d.exec("gh", args, { input: notes });
    if (r.status !== 0) throw unknown(`gh release create ${tag} failed: ${r.stderr.trim()} — check with \`status\` before retrying`);
    d.log(`${tag}: draft release created ("${title}")`);
  }
  return 0;
}

// ── publication (ordered, resumable) ─────────────────────────────────────────

/** @param {Deps} d @param {(typeof PACKAGES)[number]} pkg @param {string} version @param {string} sha */
export async function npmState(d, pkg, version, sha) {
  const opts = { fetchImpl: d.fetchImpl, sleep: d.sleep };
  const lookup = await lookupVersion(pkg.name, version, opts);
  if (lookup.state !== "present") return { state: lookup.state, errors: lookup.errors };
  const provenance = await readProvenance(pkg.name, version, opts);
  const verdict = evaluateExistingVersion({ pkg, version, provenance, expectedSha: sha, expectedTag: tagFor(pkg, version) });
  const tags = await readDistTags(pkg.name, opts);
  const distTag = distTagFor(version);
  return {
    state: "present",
    verdict,
    provenance,
    publisher: lookup.manifest?._npmUser?.name,
    tagsState: tags.state,
    channel: tags.state === "ok" ? decideChannel({ version, distTag, tags: tags.tags ?? {} }) : null,
    next: tags.state === "ok" ? decideStaleNext({ version, tags: tags.tags ?? {} }) : null,
    errors: [...lookup.errors, ...tags.errors],
  };
}

/** @param {Deps} d @param {(typeof PACKAGES)[number]} pkg @param {string} tag @param {string} sha */
async function workflowRuns(d, pkg, tag, sha) {
  const data = await ghJson(d, `repos/${REPO}/actions/workflows/${pkg.workflow}/runs?head_sha=${sha}&per_page=50`);
  return matchingPublishRuns(pkg, tag, sha, data?.workflow_runs ?? []);
}

/** @param {Deps} d @param {number} runId @param {number} timeoutMs */
async function waitRun(d, runId, timeoutMs) {
  const end = d.now() + timeoutMs;
  for (;;) {
    const r = await ghJson(d, `repos/${REPO}/actions/runs/${runId}`);
    if (r?.status === "completed") return r;
    if (d.now() >= end) throw unknown(`run ${runId} still ${r?.status} after ${timeoutMs / 1000}s; resume later with \`publish\``);
    await d.sleep(d.pollMs ?? 15_000);
  }
}

/**
 * Wait for a run that did not exist before initiation. Identified by run ID, not
 * by comparing GitHub timestamps with the local clock (which may be skewed).
 * @param {Deps} d @param {(typeof PACKAGES)[number]} pkg @param {string} tag @param {string} sha @param {Set<number>} known @param {number} timeoutMs
 */
async function waitForNewRun(d, pkg, tag, sha, known, timeoutMs) {
  const end = d.now() + timeoutMs;
  for (;;) {
    const fresh = (await workflowRuns(d, pkg, tag, sha)).filter((/** @type {any} */ r) => !known.has(r.id));
    if (fresh.length) return fresh.sort((/** @type {any} */ a, /** @type {any} */ b) => b.id - a.id)[0];
    if (d.now() >= end) return null;
    await d.sleep(d.pollMs ?? 15_000);
  }
}

/** Registry probes after a failed publish run before `publish` stops (about 2 minutes at the 15 s poll). */
const REOBSERVE_ATTEMPTS = 8;

/** Poll the registry after a successful run: absence right after success is propagation, not a reason to publish again. */
async function awaitVisible(/** @type {Deps} */ d, /** @type {(typeof PACKAGES)[number]} */ pkg, /** @type {string} */ version, /** @type {string} */ sha, attempts = 20) {
  let s = await npmState(d, pkg, version, sha);
  for (let i = 1; i < attempts && (s.state !== "present" || s.verdict?.verdict === "unproven"); i++) {
    await d.sleep(d.pollMs ?? 15_000);
    s = await npmState(d, pkg, version, sha);
  }
  return s;
}

/**
 * Explicit `workflow_dispatch` of one publish workflow on its tag, correlated to
 * the run it started by exact workflow/tag/SHA and a run ID that did not exist
 * before. A failed or ambiguous dispatch is re-observed before anything else:
 * the request may have been accepted, so it is never re-sent blindly.
 * @param {Deps} d @param {(typeof PACKAGES)[number]} pkg @param {string} tag @param {string} sha @param {Set<number>} known @param {number} timeoutMs
 */
async function dispatchPublish(d, pkg, tag, sha, known, timeoutMs) {
  const r = d.exec("gh", ["workflow", "run", pkg.workflow, "--repo", REPO, "--ref", tag, "-f", "dry_run=false"]);
  if (r.status !== 0) {
    const c = classifyGhFailure(r.stderr ?? "");
    const msg = redact((r.stderr || r.stdout).trim().split("\n").slice(0, 4).join(" | "));
    if (c.state === "denied" || c.state === "missing") {
      throw new ReleaseError(`workflow_dispatch of ${pkg.workflow} on ${tag} was refused (${c.why}): ${msg}. Not retried through another route; a person with Actions write access can run it from the Actions UI (RELEASE.md, "Actions release path").`);
    }
    const code = Number(/HTTP (\d{3})/.exec(r.stderr ?? "")?.[1] ?? 0);
    if (code >= 400 && code < 500 && code !== 408 && code !== 429 && !/rate limit/i.test(r.stderr ?? "")) {
      throw new ReleaseError(`workflow_dispatch of ${pkg.workflow} on ${tag} was rejected (HTTP ${code}): ${msg}. A definite rejection is not re-sent; fix the cause, then dispatch the release workflow again.`);
    }
    d.log(`${pkg.workflow}: dispatch answer was not a success (${c.why}): ${msg} — checking whether a run started anyway`);
  }
  const run = await waitForNewRun(d, pkg, tag, sha, known, timeoutMs);
  if (!run) throw unknown(`${pkg.workflow}: no run observed for ${tag}@${sha} after dispatch; UNKNOWN whether it was accepted. Check Actions, then resume (an active or finished run for this exact tag/SHA is attached to, not duplicated).`);
  return run;
}

/** Mark the create-zudo-doc release as GitHub's Latest after a stable release. @param {Deps} d @param {string} version */
function markLatest(d, version) {
  if (version.includes("-")) return;
  const list = JSON.parse(must(d, "gh", ["release", "list", "--repo", REPO, "--limit", "10", "--json", "tagName,isLatest"]));
  const createTag = tagFor(PACKAGES[2] ?? PACKAGES[0], version);
  if (!list.find((/** @type {any} */ r) => r.tagName === createTag)?.isLatest) {
    must(d, "gh", ["release", "edit", createTag, "--repo", REPO, "--latest"]);
    d.log(`${createTag}: marked as GitHub's Latest release`);
  }
}

/** @param {Deps} d @param {Record<string,string>} o */
export async function cmdPublish(d, o) {
  const version = req(o, "version");
  const rec = loadIntegration(d, o);
  const sha = rec.integration;
  const initiateTimeout = Number(o["initiate-timeout"] ?? 180) * 1000;
  const runTimeout = Number(o["run-timeout"] ?? 2700) * 1000;
  const initiationMode = o.initiation ?? "release";
  if (initiationMode !== "release" && initiationMode !== "dispatch") throw new ReleaseError(`--initiation must be release or dispatch, not ${initiationMode}`);
  if (initiationMode === "dispatch") loadAdmission(d, o, version, sha);
  const outFile = join(resolve(d.cwd, req(o, "evidence")), "publication.json");
  /** @type {Record<string, any>} */
  const evidence = d.exists(outFile) ? JSON.parse(d.readFile(outFile)) : { version, integration: sha, packages: {} };
  const save = () => d.writeFile(outFile, `${JSON.stringify(evidence, null, 2)}\n`);

  for (const pkg of PACKAGES) {
    const tag = tagFor(pkg, version);
    if (remoteTag(d, tag) !== sha) throw new ReleaseError(`Tag ${tag} is missing or not at ${sha}; publication order stops here`);
    const entry = (evidence.packages[pkg.key] ??= { tag, runs: [] });
    let afterSuccessfulRun = false;
    for (let cycle = 1; ; cycle++) {
      const s = afterSuccessfulRun ? await awaitVisible(d, pkg, version, sha) : await npmState(d, pkg, version, sha);
      if (s.state === "unknown") {
        save();
        throw unknown(`${pkg.name}@${version}: registry state UNKNOWN (${s.errors.join("; ")}); not treated as absent`);
      }
      if (s.state === "present") {
        if (s.verdict?.verdict === "unknown" || s.verdict?.verdict === "unproven") {
          save();
          throw unknown(`${pkg.name}@${version}: provenance ${s.verdict.verdict.toUpperCase()} (${s.verdict.reasons.join("; ")}); never republished — re-run later`);
        }
        if (s.verdict?.verdict === "mismatch") throw new ReleaseError(`${pkg.name}@${version} exists but not from ${sha}: ${s.verdict.reasons.join("; ")}`);
        if (s.tagsState !== "ok") throw unknown(`${pkg.name}: dist-tags UNKNOWN`);
        const channelOk = s.channel?.action === "ok";
        const finalized = channelOk && s.next?.action !== "remove";
        const byRun = entry.runs.find((/** @type {any} */ r) => s.provenance?.invocationId?.endsWith(`/runs/${r.id}/attempts/${r.attempt}`));
        Object.assign(entry, {
          npm: { version, channel: s.channel, next: s.next, provenance: s.provenance, publisher: s.publisher },
          freshPublication: Boolean(byRun),
          publishedBy: s.provenance?.invocationId,
        });
        if (s.channel?.action === "conflict") throw new ReleaseError(`${pkg.name}: channel ${distTagFor(version)} holds newer ${s.channel.current}`);
        // A wrong channel is a publication failure; only stale-next maintenance may stay pending.
        if (!channelOk && cycle > 2) {
          save();
          throw new ReleaseError(`${pkg.name}: channel ${distTagFor(version)} still reads ${s.channel?.current ?? "(unset)"} after ${cycle - 1} finalization run(s); publication order stops here`);
        }
        if (finalized || (channelOk && cycle > 2)) {
          entry.state = finalized ? "complete" : "complete-maintenance-pending";
          save();
          d.log(`${pkg.name}@${version}: ${entry.state}; ${byRun ? `published by run ${byRun.id}` : "pre-existing version verified (not a fresh publication by this invocation)"}`);
          break;
        }
      } else if (afterSuccessfulRun) {
        save();
        throw unknown(`${pkg.name}@${version} is not visible after a successful publish run — UNKNOWN, not absent; re-run \`publish\` later (it will not publish again blindly)`);
      } else if (cycle > 2) {
        save();
        throw new ReleaseError(`${pkg.name}@${version} still absent after ${cycle - 1} publication attempt(s); see ${entry.runs.map((/** @type {any} */ r) => r.url).join(", ")}`);
      }

      // Not finished: attach to an active run, or initiate one.
      const runs = await workflowRuns(d, pkg, tag, sha);
      let run = runs.find((/** @type {any} */ r) => r.status !== "completed");
      let initiation = "existing-run";
      if (!run) {
        const known = new Set(runs.map((/** @type {any} */ r) => r.id));
        // The Actions path's dispatch job has no contents write, so drafts are
        // invisible to it; `releases` and `finalize-releases` own them there.
        const rel = initiationMode === "release" ? viewRelease(d, tag) : null;
        if (initiationMode === "release" && !rel) throw new ReleaseError(`No GitHub Release for ${tag}; run \`releases\` first`);
        if (rel?.isDraft) {
          must(d, "gh", ["release", "edit", tag, "--repo", REPO, "--draft=false", ...(version.includes("-") ? ["--prerelease"] : [])]);
          initiation = "release-published";
          run = await waitForNewRun(d, pkg, tag, sha, known, initiateTimeout);
        }
        if (!run) {
          // A release event may not start workflows (e.g. created with a
          // workflow GITHUB_TOKEN), and a published release never re-fires.
          // The Actions path dispatches directly and leaves the draft for
          // `finalize-releases`.
          run = await dispatchPublish(d, pkg, tag, sha, known, initiateTimeout);
          initiation = initiation === "release-published" ? "release-published+dispatch" : "dispatch";
        }
      }
      d.log(`${pkg.name}: watching ${pkg.workflow} run ${run.id} (${initiation}) ${run.html_url}`);
      const done = await waitRun(d, run.id, runTimeout);
      entry.runs.push({ id: done.id, attempt: done.run_attempt, event: done.event, initiation, url: done.html_url, conclusion: done.conclusion });
      save();
      if (done.conclusion !== "success") {
        const failed = new ReleaseError(`${pkg.workflow} run ${done.id} concluded ${done.conclusion} (${done.html_url}). Inspect it; \`publish\` resumes from the registry state.`);
        // A run can fail after its publish step succeeded (11.0.0: finalize timed
        // out on npm visibility, #4785). Re-observe the registry before stopping;
        // continue only for this exact version with provenance from this SHA.
        if (done.conclusion !== "failure") throw failed;
        const seen = await awaitVisible(d, pkg, version, sha, REOBSERVE_ATTEMPTS);
        if (seen.state !== "present" || seen.verdict?.verdict !== "matches") throw failed;
        d.log(`${pkg.workflow} run ${done.id} concluded failure, but ${pkg.name}@${version} is on npm with provenance from ${sha}; re-checking the registry state instead of stopping`);
      }
      afterSuccessfulRun = true;
    }
  }

  if (initiationMode === "release") markLatest(d, version);
  evidence.completedAt = new Date(d.now()).toISOString();
  save();
  d.log(`All three packages verified on npm at ${version} → ${outFile}`);
  return 0;
}

// ── Actions release path ─────────────────────────────────────────────────────
//
// Run by .github/workflows/release-actions.yml. `admit` is read-only and
// re-derives every piece of evidence in the job; later jobs act only on its
// record from the same run and re-check state right before each write.

/** @param {Deps} d @param {Record<string,string>} o */
export async function cmdAdmit(d, o) {
  const out = resolve(d.cwd, req(o, "out"));
  const declared = Object.fromEntries(["version", "integration", "pr", "run", "attempt", "candidate", "base", "artifact-id", "artifact-digest"].map((k) => [k, o[k] ?? ""]));
  const file = join(out, "admission.json");
  /** @type {Record<string, any>} */
  const record = { ok: false, version: declared.version, integration: declared.integration, declared, errors: [], recordedAt: new Date(d.now()).toISOString() };
  const finish = (/** @type {number} */ code) => {
    record.ok = code === 0 && record.errors.length === 0;
    d.writeFile(file, `${JSON.stringify(record, null, 2)}\n`);
    report(d, "Admission", record.ok, record.errors, file);
    return record.ok ? 0 : code || 1;
  };

  const inputErrors = validateAdmissionInputs(declared);
  if (inputErrors.length) {
    record.errors.push(...inputErrors);
    return finish(1);
  }

  try {
    return await admitChecks(d, declared, record, out, finish);
  } catch (e) {
    const err = /** @type {Error & {exitCode?: number}} */ (e);
    record.errors.push(redact(err.message));
    return finish(err.exitCode ?? 1);
  }
}

/**
 * @param {Deps} d @param {Record<string,string>} declared @param {Record<string, any>} record
 * @param {string} out @param {(code: number) => number} finish
 */
async function admitChecks(d, declared, record, out, finish) {
  // 1. Re-derive the A2 evidence and the integration binding from GitHub.
  const a2Code = await cmdA2Evidence(d, { pr: declared.pr, run: declared.run, attempt: declared.attempt, candidate: declared.candidate, base: declared.base, out });
  const a2 = readJson(d, join(out, "a2-evidence.json"));
  if (a2Code !== 0 || !a2.ok) {
    record.errors.push("A2 evidence did not verify (see a2-evidence.json): A2 must have RUN and EXECUTED on this exact candidate/run/attempt");
    return finish(a2Code || 1);
  }
  const intCode = await cmdIntegration(d, { evidence: join(out, "a2-evidence.json"), integration: declared.integration, out });
  const integration = readJson(d, join(out, "integration.json"));
  if (intCode !== 0 || !integration.ok) {
    record.errors.push("integration binding did not verify (see integration.json): exact-SHA main workflows must have completed successfully");
    return finish(intCode || 1);
  }

  // 2. The declared values must be exactly what was re-derived.
  const cmp = compareAdmission({ declared, a2, integration });
  record.errors.push(...cmp.errors);
  record.observed = {
    pr: a2.prNumber,
    run: a2.run,
    candidate: a2.candidate,
    candidateTree: a2.candidateTree,
    base: a2.base,
    artifact: a2.a2?.artifact,
    downloadSha256: a2.artifactDownload?.sha256,
    a2Source: a2.a2?.sourceHead,
    testedTree: a2.a2?.testedTree,
    integrationTree: integration.integrationTree,
    mainWorkflows: integration.mainWorkflows,
  };
  if (record.errors.length) return finish(1);

  // 3. Version, tags and registry: resume only what already belongs to this integration.
  assertVersionsAt(d, declared.integration, declared.version);
  record.tags = {};
  record.registry = {};
  for (const pkg of PACKAGES) {
    const tag = tagFor(pkg, declared.version);
    const decision = decideTag({ tag, existing: remoteTag(d, tag), integration: declared.integration });
    record.tags[tag] = decision.action === "keep" ? "present-same-sha (resume)" : decision.action === "create" ? "absent" : "conflict";
    if (decision.action === "refuse") record.errors.push(decision.reason);
  }
  for (const pkg of PACKAGES) {
    const s = await npmState(d, pkg, declared.version, declared.integration);
    if (s.state === "unknown") {
      record.registry[pkg.key] = "unknown";
      record.errors.push(`${pkg.name}@${declared.version}: registry state UNKNOWN (${s.errors.join("; ")}); not treated as absent — re-run admission later`);
      return finish(2);
    }
    if (s.state === "present") {
      const v = s.verdict?.verdict;
      record.registry[pkg.key] = `present (${v})`;
      if (v === "unknown" || v === "unproven") {
        record.errors.push(`${pkg.name}@${declared.version} exists but its provenance is ${String(v).toUpperCase()}; never republished — re-run admission later`);
        return finish(2);
      }
      if (v === "mismatch") record.errors.push(`${pkg.name}@${declared.version} already exists from another source: ${s.verdict?.reasons.join("; ")}`);
    } else {
      record.registry[pkg.key] = "absent";
    }
  }
  return finish(record.errors.length ? 1 : 0);
}

/**
 * Publish the three draft releases (and mark Latest for a stable version) only
 * after every package is verified on npm. With GITHUB_TOKEN this fires no
 * `release: published` run; if a person publishes a draft instead, that run's
 * guard classifies the existing version and only resumes finalization.
 * @param {Deps} d @param {Record<string,string>} o
 */
export async function cmdFinalizeReleases(d, o) {
  const version = req(o, "version");
  const rec = loadIntegration(d, o);
  const sha = rec.integration;
  loadAdmission(d, o, version, sha);
  const pub = readJson(d, join(resolve(d.cwd, req(o, "evidence")), "publication.json"));
  if (pub.version !== version || pub.integration !== sha || !pub.completedAt) throw new ReleaseError("publication.json is not a completed publication of this version and integration");
  for (const pkg of PACKAGES) {
    const tag = tagFor(pkg, version);
    if (remoteTag(d, tag) !== sha) throw new ReleaseError(`Tag ${tag} is missing or not at ${sha}`);
    const s = await npmState(d, pkg, version, sha);
    if (s.state === "unknown" || s.verdict?.verdict === "unknown" || s.verdict?.verdict === "unproven") throw unknown(`${pkg.name}@${version}: registry state not confirmed; releases stay draft`);
    if (s.state !== "present" || s.verdict?.verdict !== "matches" || s.channel?.action !== "ok") {
      throw new ReleaseError(`${pkg.name}@${version} is not verified on npm from ${sha} (state ${s.state}, provenance ${s.verdict?.verdict}, channel ${s.channel?.action}); releases stay draft`);
    }
  }
  for (const pkg of PACKAGES) {
    const tag = tagFor(pkg, version);
    const rel = viewRelease(d, tag);
    if (!rel) throw new ReleaseError(`No GitHub Release for ${tag}`);
    if (!rel.isDraft) {
      d.log(`${tag}: release already published (kept)`);
      continue;
    }
    must(d, "gh", ["release", "edit", tag, "--repo", REPO, "--draft=false", ...(version.includes("-") ? ["--prerelease"] : ["--latest=false"])]);
    d.log(`${tag}: release published`);
  }
  markLatest(d, version);
  return 0;
}

/**
 * Read-only: print the release-actions.yml inputs from local evidence records,
 * for `gh workflow run`, a GitHub MCP dispatch tool, or the Actions UI. The
 * workflow re-derives and re-checks every value; this only saves retyping.
 * @param {Deps} d @param {Record<string,string>} o
 */
export function cmdActionsInputs(d, o) {
  const version = req(o, "version");
  const dir = resolve(d.cwd, req(o, "evidence"));
  const a2 = readJson(d, join(dir, "a2-evidence.json"));
  const integration = readJson(d, join(dir, "integration.json"));
  if (!a2.ok || !integration.ok) throw new ReleaseError("a2-evidence.json and integration.json must both be verified before dispatching the Actions path");
  if (!isFullSha(integration.integration)) throw new ReleaseError("integration.json has no full integration SHA");
  const inputs = {
    version,
    integration_sha: integration.integration,
    pr_number: String(a2.prNumber),
    a2_run_id: String(a2.run?.id),
    a2_run_attempt: String(a2.run?.attempt),
    candidate_sha: a2.candidate,
    base_sha: a2.base,
    a2_artifact_id: String(a2.a2?.artifact?.id),
    a2_artifact_digest: a2.a2?.artifact?.digest,
    stage: o.stage ?? "admit",
  };
  d.log(JSON.stringify(inputs, null, 2));
  d.log(["", `gh workflow run ${ACTIONS_RELEASE_WORKFLOW} --repo ${REPO} --ref main \\`, ...Object.entries(inputs).map(([k, v], i, a) => `  -f ${k}=${v}${i < a.length - 1 ? " \\" : ""}`)].join("\n"));
  return 0;
}

// ── status (read-only readback) ──────────────────────────────────────────────

/** @param {Deps} d @param {Record<string,string>} o */
export async function cmdStatus(d, o) {
  const version = req(o, "version");
  const rows = [];
  for (const pkg of PACKAGES) {
    const tag = tagFor(pkg, version);
    const tagSha = remoteTag(d, tag);
    const sha = o.integration ?? tagSha ?? "";
    const rel = viewRelease(d, tag);
    const s = await npmState(d, pkg, version, sha);
    const runs = tagSha ? await workflowRuns(d, pkg, tag, tagSha) : [];
    rows.push({
      package: pkg.name,
      tag: tagSha ? `${tag}@${tagSha.slice(0, 12)}` : `${tag} (absent)`,
      release: rel ? (rel.isDraft ? "draft" : "published") : "absent",
      runs: runs.map((/** @type {any} */ r) => `${r.id}:${r.status}/${r.conclusion ?? "-"}`).join(" ") || "-",
      npm: s.state === "present" ? `present (${s.verdict?.verdict}; ${distTagFor(version)}: ${s.channel?.action}; next: ${s.next?.outcome ?? "-"}; publisher: ${s.publisher ?? "?"})` : s.state,
    });
  }
  d.log(JSON.stringify(rows, null, 2));
  return rows.some((r) => r.npm === "unknown") ? 2 : 0;
}

/** @param {string[]} argv @param {Deps} d */
export async function main(argv, d) {
  try {
    const { cmd, opts } = parseArgs(argv);
    switch (cmd) {
      case "preflight":
        return await cmdPreflight(d);
      case "a2-evidence":
        return await cmdA2Evidence(d, opts);
      case "integration":
        return await cmdIntegration(d, opts);
      case "tag":
        return await cmdTag(d, opts);
      case "releases":
        return await cmdReleases(d, opts);
      case "publish":
        return await cmdPublish(d, opts);
      case "status":
        return await cmdStatus(d, opts);
      case "admit":
        return await cmdAdmit(d, opts);
      case "finalize-releases":
        return await cmdFinalizeReleases(d, opts);
      case "actions-inputs":
        return cmdActionsInputs(d, opts);
      default:
        d.log("Usage: node scripts/release/release.mjs <preflight|a2-evidence|integration|tag|releases|publish|status|admit|finalize-releases|actions-inputs> ... (see RELEASE.md)");
        return 1;
    }
  } catch (e) {
    const err = /** @type {Error & {exitCode?: number}} */ (e);
    d.log(`ERROR: ${redact(err.message)}`);
    return err.exitCode ?? 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await main(process.argv.slice(2), realDeps());
}
