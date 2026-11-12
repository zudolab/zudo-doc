// Shared release logic for the three lockstep npm packages.
//
// Used by both sides of the release (RELEASE.md, "Release procedure"):
//   - scripts/release/publish-step.mjs — runs INSIDE the publish-*.yml workflows
//   - scripts/release/release.mjs      — the local / Codex Cloud orchestrator
//
// Every external operation (registry HTTP, `gh`, `git`, `npm`) is injected so the
// decision logic is testable without touching the network (scripts/__tests__/
// release-*.test.mjs). Pure decision functions never throw on registry/GitHub
// uncertainty: they return a state, and "unknown" is never collapsed into "absent".

export const REPO = "zudolab/zudo-doc";
export const REPO_URL = `https://github.com/${REPO}`;
export const REGISTRY = "https://registry.npmjs.org";

// Reviewed npm CLI for OIDC trusted publishing. pnpm 10.x has no OIDC support of
// its own: `pnpm publish` packs (rewriting `workspace:` specifiers) and then runs
// `npm publish <tarball>` with the `npm` found on PATH, so this npm is the
// executable that authenticates. npm docs: OIDC publish needs >= 11.5.1, OIDC
// `npm dist-tag` needs >= 11.21.0; engines `^20.17.0 || >=22.9.0` (Node 24 OK).
export const NPM_CLI_PIN = Object.freeze({
  version: "11.21.1",
  integrity:
    "sha512-YTzL6QBEJXyHcTu0JiUc7RKMp+mzlJtl7rGLmERaXUQeFHIMc9atdr6G9M9C8vDWbv40epoTQAzNL2/PtZVDhQ==",
});

/** Publication order is the array order (RELEASE.md, "Publish order"). */
export const PACKAGES = Object.freeze([
  Object.freeze({
    key: "history-server",
    name: "@takazudo/zudo-doc-history-server",
    dir: "packages/doc-history-server",
    tagPrefix: "zudo-doc-history-server-",
    workflow: "publish-zudo-doc-history-server.yml",
    slug: "doc-history-server",
  }),
  Object.freeze({
    key: "zudo-doc",
    name: "@takazudo/zudo-doc",
    dir: "packages/zudo-doc",
    tagPrefix: "zudo-doc-v",
    workflow: "publish-zudo-doc.yml",
    slug: "zudo-doc",
  }),
  Object.freeze({
    key: "create-zudo-doc",
    name: "create-zudo-doc",
    dir: "packages/create-zudo-doc",
    tagPrefix: "v",
    workflow: "publish-create-zudo-doc.yml",
    slug: "create-zudo-doc",
  }),
]);

export const PR_CHECKS_PATH = ".github/workflows/pr-checks.yml";
export const PRODUCTION_DEPLOY_PATH = ".github/workflows/main-deploy.yml";
export const A2_JOB_NAME = "A2 No-Stub Parity Gate";
export const A2_SELECT_STEP = "Select A2 from changed build inputs";
export const A2_TEST_STEP = "Run A2 no-stub parity slow-suite subset";
export const A2_ARTIFACT_NAME = "a2-route-parity-diagnostics";

export class ReleaseError extends Error {
  /** @param {string} message @param {Record<string, unknown>} [details] */
  constructor(message, details = {}) {
    super(message);
    this.name = "ReleaseError";
    this.details = details;
  }
}

/** @param {string} key */
export function getPackage(key) {
  const pkg = PACKAGES.find((p) => p.key === key || p.name === key);
  if (!pkg) throw new ReleaseError(`Unknown package '${key}'. Expected one of: ${PACKAGES.map((p) => p.key).join(", ")}`);
  return pkg;
}

// ── semver (no dependency: the orchestrator must run before `pnpm install`) ──

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/;

/** @param {string} v */
export function parseSemver(v) {
  const m = SEMVER_RE.exec(v);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ? m[4].split(".") : [],
  };
}

/** semver §11 precedence. @param {string} a @param {string} b @returns {-1|0|1} */
export function compareSemver(a, b) {
  const x = parseSemver(a);
  const y = parseSemver(b);
  if (!x || !y) throw new ReleaseError(`Cannot compare non-semver '${a}' / '${b}'`);
  for (const k of /** @type {const} */ (["major", "minor", "patch"])) {
    if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1;
  }
  if (!x.pre.length && !y.pre.length) return 0;
  if (!x.pre.length) return 1;
  if (!y.pre.length) return -1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    if (pn && qn) return Number(p) < Number(q) ? -1 : 1;
    if (pn) return -1;
    if (qn) return 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

/** @param {string} version */
export function distTagFor(version) {
  return version.includes("-") ? "next" : "latest";
}

/** @param {{tagPrefix: string}} pkg @param {string} version */
export function tagFor(pkg, version) {
  return `${pkg.tagPrefix}${version}`;
}

/**
 * Anchored namespace + semver check. A sibling namespace never parses: the
 * remainder after the prefix must itself be a bare semver, so `zudo-doc-v1.0.0`
 * is not a `v*` (create-zudo-doc) tag and `zudo-doc-history-server-1.0.0` is not
 * a `zudo-doc-v*` tag.
 * @param {{name: string, tagPrefix: string}} pkg @param {string} tag
 */
export function parseReleaseTag(pkg, tag) {
  if (typeof tag !== "string" || !tag.startsWith(pkg.tagPrefix)) {
    throw new ReleaseError(`Tag '${tag}' is not in the ${pkg.name} namespace '${pkg.tagPrefix}X.Y.Z[-prerelease]'.`);
  }
  const version = tag.slice(pkg.tagPrefix.length);
  if (!parseSemver(version)) {
    throw new ReleaseError(`Tag '${tag}' does not match ${pkg.tagPrefix}X.Y.Z[-prerelease].`);
  }
  return { tag, version, distTag: distTagFor(version) };
}

// ── registry reads: ok / absent / unknown ─────────────────────────────────────

/** @param {number} ms */
const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @param {string} name */
export function encodePackageName(name) {
  return name.startsWith("@") ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name);
}

/**
 * GET a registry JSON document with bounded retries.
 * - 2xx + JSON            → { state: "ok", body }
 * - 404                   → { state: "absent" }   (an explicit registry answer)
 * - anything else / timeout / bad JSON, after `attempts` tries
 *                         → { state: "unknown", errors }  (never "absent")
 * @param {string} path
 * @param {{fetchImpl?: typeof fetch, attempts?: number, timeoutMs?: number, baseDelayMs?: number, sleep?: (ms:number)=>Promise<unknown>, registry?: string}} [opts]
 */
export async function registryGet(path, opts = {}) {
  const {
    fetchImpl = globalThis.fetch,
    attempts = 4,
    timeoutMs = 15_000,
    baseDelayMs = 1_000,
    sleep = realSleep,
    registry = REGISTRY,
  } = opts;
  /** @type {string[]} */
  const errors = [];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchImpl(`${registry}${path}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 404) return { state: /** @type {const} */ ("absent"), errors };
      if (res.ok) {
        const text = await res.text();
        try {
          return { state: /** @type {const} */ ("ok"), body: JSON.parse(text), errors };
        } catch (e) {
          errors.push(`attempt ${attempt}: HTTP ${res.status} with unparseable body (${/** @type {Error} */ (e).message})`);
        }
      } else {
        errors.push(`attempt ${attempt}: HTTP ${res.status} ${res.statusText ?? ""}`.trim());
      }
    } catch (e) {
      const err = /** @type {Error} */ (e);
      errors.push(`attempt ${attempt}: ${err.name === "TimeoutError" ? `timeout after ${timeoutMs}ms` : err.message}`);
    }
    if (attempt < attempts) await sleep(baseDelayMs * 2 ** (attempt - 1));
  }
  return { state: /** @type {const} */ ("unknown"), errors };
}

/**
 * Presence of one exact version, from the per-version document (small, and the
 * same answer `npm publish` conflicts against). A 404 is "absent at this read";
 * callers that just watched a publish succeed must keep polling instead of
 * acting on it (registry reads are edge-cached).
 * @param {string} name @param {string} version @param {Parameters<typeof registryGet>[1]} [opts]
 * @returns {Promise<{state: "present"|"absent"|"unknown", manifest?: any, errors: string[]}>}
 */
export async function lookupVersion(name, version, opts) {
  const res = await registryGet(`/${encodePackageName(name)}/${encodeURIComponent(version)}`, opts);
  if (res.state === "unknown") return { state: "unknown", errors: res.errors };
  if (res.state === "absent") return { state: "absent", errors: res.errors };
  if (res.body?.version !== version) {
    return { state: "unknown", errors: [...res.errors, `version document reports ${res.body?.version}`] };
  }
  return { state: "present", manifest: res.body, errors: res.errors };
}

/** Full packument (only for publish times during `next` maintenance). */
export async function readPackument(/** @type {string} */ name, /** @type {Parameters<typeof registryGet>[1]} */ opts) {
  return registryGet(`/${encodePackageName(name)}`, opts);
}

/** Dist-tags from the uncached dist-tag endpoint. */
export async function readDistTags(/** @type {string} */ name, /** @type {Parameters<typeof registryGet>[1]} */ opts) {
  const res = await registryGet(`/-/package/${encodePackageName(name)}/dist-tags`, opts);
  if (res.state === "ok" && res.body && typeof res.body === "object") {
    return { state: /** @type {const} */ ("ok"), tags: /** @type {Record<string,string>} */ (res.body), errors: res.errors };
  }
  if (res.state === "absent") return { state: /** @type {const} */ ("ok"), tags: {}, errors: res.errors };
  return { state: /** @type {const} */ ("unknown"), tags: undefined, errors: res.errors };
}

/**
 * Provenance (SLSA v1) source evidence for an existing version.
 * @returns {Promise<{state: "ok"|"absent"|"unknown", sourceCommit?: string, workflowPath?: string, workflowRef?: string, repository?: string, invocationId?: string, errors: string[]}>}
 */
export async function readProvenance(/** @type {string} */ name, /** @type {string} */ version, /** @type {Parameters<typeof registryGet>[1]} */ opts) {
  const res = await registryGet(`/-/npm/v1/attestations/${encodePackageName(name)}@${version}`, opts);
  if (res.state !== "ok") return { state: res.state, errors: res.errors };
  return { ...parseProvenance(res.body), errors: res.errors };
}

/** @param {any} body */
export function parseProvenance(body) {
  const list = Array.isArray(body?.attestations) ? body.attestations : [];
  const slsa = list.find((a) => typeof a?.predicateType === "string" && a.predicateType.startsWith("https://slsa.dev/provenance/"));
  const payload = slsa?.bundle?.dsseEnvelope?.payload;
  if (!payload) return { state: /** @type {const} */ ("absent") };
  try {
    const statement = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    const def = statement?.predicate?.buildDefinition ?? {};
    const wf = def?.externalParameters?.workflow ?? {};
    const dep = Array.isArray(def?.resolvedDependencies) ? def.resolvedDependencies[0] : undefined;
    return {
      state: /** @type {const} */ ("ok"),
      sourceCommit: dep?.digest?.gitCommit,
      workflowPath: wf.path,
      workflowRef: wf.ref,
      repository: wf.repository,
      invocationId: statement?.predicate?.runDetails?.metadata?.invocationId,
    };
  } catch {
    return { state: /** @type {const} */ ("unknown") };
  }
}

/**
 * Is an already-published version the one this release would have produced?
 * An existing version is never reported as a fresh publication.
 * @param {{pkg: {workflow: string}, version: string, provenance: Awaited<ReturnType<typeof readProvenance>>, expectedSha: string, expectedTag: string}} input
 */
export function evaluateExistingVersion({ pkg, provenance, expectedSha, expectedTag }) {
  if (provenance.state === "unknown") {
    return { verdict: /** @type {const} */ ("unknown"), reasons: ["provenance lookup did not return a usable answer", ...provenance.errors] };
  }
  if (provenance.state === "absent") {
    // Attestations can lag a fresh publish, and a pre-provenance version can never
    // prove its source. Either way: do not republish, do not finalize — stop as
    // uncertain and let a later re-run (or the owner) decide.
    return { verdict: /** @type {const} */ ("unproven"), reasons: ["no provenance attestation visible: cannot (yet) prove the existing version came from this source"] };
  }
  const reasons = [];
  if (provenance.sourceCommit !== expectedSha) reasons.push(`provenance commit ${provenance.sourceCommit} != expected ${expectedSha}`);
  if (provenance.workflowPath !== `.github/workflows/${pkg.workflow}`) reasons.push(`provenance workflow ${provenance.workflowPath} != .github/workflows/${pkg.workflow}`);
  if (provenance.repository !== REPO_URL) reasons.push(`provenance repository ${provenance.repository} != ${REPO_URL}`);
  if (provenance.workflowRef !== `refs/tags/${expectedTag}`) reasons.push(`provenance ref ${provenance.workflowRef} != refs/tags/${expectedTag}`);
  return reasons.length
    ? { verdict: /** @type {const} */ ("mismatch"), reasons }
    : { verdict: /** @type {const} */ ("matches"), reasons: [] };
}

/**
 * Expected channel decision. Never moves a channel backward.
 * @param {{version: string, distTag: string, tags: Record<string,string>}} input
 */
export function decideChannel({ version, distTag, tags }) {
  const current = tags[distTag];
  if (current === version) return { action: /** @type {const} */ ("ok"), current };
  if (!current || !parseSemver(current) || compareSemver(current, version) < 0) {
    return { action: /** @type {const} */ ("set"), current };
  }
  return { action: /** @type {const} */ ("conflict"), current };
}

/**
 * Stale `next` decision after a stable publish. A `next` that is semver-greater
 * than the stable version is a legitimate newer preview and is kept.
 * @param {{version: string, tags: Record<string,string>}} input
 */
export function decideStaleNext({ version, tags }) {
  if (version.includes("-")) return { action: /** @type {const} */ ("skip"), outcome: "not-stable" };
  const next = tags.next;
  if (!next) return { action: /** @type {const} */ ("none"), outcome: "absent" };
  if (!parseSemver(next)) return { action: /** @type {const} */ ("keep"), outcome: "kept-unparseable", next };
  return compareSemver(next, version) < 0
    ? { action: /** @type {const} */ ("remove"), outcome: "stale", next }
    : { action: /** @type {const} */ ("keep"), outcome: "kept-newer-preview", next };
}

// ── release notes ────────────────────────────────────────────────────────────

/** Body after the YAML frontmatter (same semantics as the documented awk). @param {string} mdx */
export function extractNotes(mdx) {
  const lines = mdx.split("\n");
  let fences = 0;
  const out = [];
  for (const line of lines) {
    if (line === "---" && fences < 2) {
      fences++;
      continue;
    }
    if (fences >= 2) out.push(line);
  }
  return out.join("\n").trim() + "\n";
}

/** @param {{name: string}} pkg @param {string} version */
export function releaseTitle(pkg, version) {
  return `${pkg.name} ${version}`;
}

// ── A2 evidence (RELEASE.md, "Release-candidate CI: A2 must execute") ─────────

const SHA_RE = /^[0-9a-f]{40}$/;

/** @param {string} log */
export function parseA2JobLog(log) {
  const clean = log.replace(/\x1b\[[0-9;]*m/g, "");
  const lines = clean.split(/\r?\n/).map((l) => l.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z\s?/, ""));
  const decision = lines.find((l) => l.startsWith("A2 decision: "));
  let checkoutSha;
  const headIdx = lines.findIndex((l) => l.startsWith("HEAD is now at "));
  if (headIdx >= 0) {
    const short = lines[headIdx]?.split(" ")[4] ?? "";
    checkoutSha = lines.slice(headIdx + 1, headIdx + 8).map((l) => l.trim()).find((l) => SHA_RE.test(l) && l.startsWith(short));
  }
  const testsLine = lines.map((l) => l.trim()).find((l) => /^Tests\s+\d+ passed/.test(l));
  const failedLine = lines.map((l) => l.trim()).find((l) => /^(Tests|Test Files)\s+.*\d+ failed/.test(l));
  const passed = testsLine ? Number(/^Tests\s+(\d+) passed/.exec(testsLine)?.[1]) : 0;
  return { decision, checkoutSha, testsLine, failedLine, passed };
}

/** @param {string} name @param {string[]} required */
function matchesRequired(name, required) {
  return required.find((r) => name === r || name.startsWith(`${r} (`));
}

/**
 * Pure verification of a PR Checks run/attempt as A2 release evidence.
 * @param {{
 *  candidate: string, base: string, attempt: number, prNumber?: number,
 *  run: any, jobs: any[], artifacts: any[], jobLog: string, manifest: any,
 *  testedCommit: {sha: string, tree: string, parents: string[]} | null,
 *  candidateTree?: string, requiredChecks: string[]
 * }} input
 */
export function verifyA2Evidence(input) {
  const { candidate, base, attempt, run, jobs, artifacts, jobLog, manifest, testedCommit, requiredChecks } = input;
  const errors = [];
  if (!SHA_RE.test(candidate) || !SHA_RE.test(base)) errors.push("candidate and base must be full 40-hex SHAs");
  if (run?.path !== PR_CHECKS_PATH) errors.push(`run ${run?.id} is ${run?.path}, not ${PR_CHECKS_PATH}`);
  if (run?.event !== "pull_request") errors.push(`run event is ${run?.event}, not pull_request (a push to main runs no A2)`);
  if (run?.run_attempt !== attempt) errors.push(`run attempt ${run?.run_attempt} != recorded attempt ${attempt}`);
  if (run?.status !== "completed" || run?.conclusion !== "success") errors.push(`run attempt concluded ${run?.status}/${run?.conclusion}, not completed/success`);
  if (run?.head_sha !== candidate) errors.push(`run head_sha ${run?.head_sha} != frozen candidate ${candidate}`);

  const jobRecords = jobs.map((j) => ({ id: j.id, name: j.name, conclusion: j.conclusion, run_attempt: j.run_attempt }));
  for (const j of jobs) {
    if (j.run_attempt !== undefined && j.run_attempt !== attempt) errors.push(`job ${j.name} belongs to attempt ${j.run_attempt}`);
    if (!["success", "skipped", "neutral"].includes(j.conclusion)) errors.push(`job '${j.name}' concluded ${j.conclusion}`);
  }
  for (const r of requiredChecks) {
    const hits = jobs.filter((j) => matchesRequired(j.name, [r]));
    if (!hits.length) errors.push(`required check '${r}' has no job in this attempt`);
    for (const h of hits) if (h.conclusion !== "success") errors.push(`required check '${h.name}' concluded ${h.conclusion}, not success`);
  }

  const a2 = jobs.find((j) => j.name === A2_JOB_NAME);
  /** @type {any} */
  let a2Record = null;
  if (!a2) {
    errors.push(`no '${A2_JOB_NAME}' job in attempt ${attempt}`);
  } else {
    const step = (/** @type {string} */ n) => (a2.steps ?? []).find((/** @type {any} */ s) => s.name === n);
    const select = step(A2_SELECT_STEP);
    const test = step(A2_TEST_STEP);
    const seconds = test?.started_at && test?.completed_at ? (Date.parse(test.completed_at) - Date.parse(test.started_at)) / 1000 : NaN;
    if (select?.conclusion !== "success") errors.push(`A2 selection step concluded ${select?.conclusion}`);
    if (test?.conclusion !== "success") errors.push(`A2 test step concluded ${test?.conclusion ?? "missing"} — a skipped A2 blocks release`);
    else if (!(seconds > 0)) errors.push(`A2 test step has no real duration (${seconds}s)`);
    const log = parseA2JobLog(jobLog ?? "");
    if (!log.decision?.startsWith("A2 decision: RUN")) errors.push(`A2 decision is '${log.decision ?? "missing"}', not RUN`);
    if (!log.testsLine || !(log.passed > 0)) errors.push("A2 job log has no passing vitest 'Tests N passed' line");
    if (log.failedLine) errors.push(`A2 job log reports failures: ${log.failedLine}`);
    if (!log.checkoutSha) errors.push("A2 job checkout log has no full checked-out SHA");

    const window0 = Date.parse(a2.started_at);
    const window1 = Date.parse(a2.completed_at) + 120_000;
    const named = artifacts.filter((a) => a.name === A2_ARTIFACT_NAME);
    const inJob = named.filter((a) => {
      const t = Date.parse(a.created_at);
      return t >= window0 && t <= window1;
    });
    if (inJob.length !== 1) errors.push(`expected exactly one '${A2_ARTIFACT_NAME}' artifact created during A2 job ${a2.id}, found ${inJob.length} (of ${named.length})`);
    const artifact = inJob[0];
    if (artifact?.expired) errors.push(`artifact ${artifact.id} has expired; evidence cannot be preserved`);
    if (artifact && artifact.workflow_run?.id !== run?.id) errors.push(`artifact ${artifact.id} belongs to run ${artifact.workflow_run?.id}`);

    const sourceHead = manifest?.sourceHead;
    if (!SHA_RE.test(sourceHead ?? "")) errors.push("diagnostics manifest.json has no sourceHead");
    if (log.checkoutSha && sourceHead && log.checkoutSha !== sourceHead) errors.push(`checkout log SHA ${log.checkoutSha} != manifest sourceHead ${sourceHead}`);
    if (!testedCommit) errors.push(`tested source object ${sourceHead} is unavailable; do not substitute a moving ref`);
    else {
      if (testedCommit.sha !== sourceHead) errors.push(`resolved tested commit ${testedCommit.sha} != sourceHead ${sourceHead}`);
      if (sourceHead === candidate) {
        // Head checkout: the tested tree is the candidate's own tree.
      } else {
        const [p0, p1, ...rest] = testedCommit.parents;
        if (rest.length || p0 !== base || p1 !== candidate) {
          errors.push(`tested merge parents [${testedCommit.parents.join(", ")}] != [base ${base}, candidate ${candidate}]`);
        }
      }
    }
    a2Record = {
      jobId: a2.id,
      jobUrl: a2.html_url,
      decision: log.decision,
      tests: log.testsLine,
      testStepSeconds: seconds,
      artifact: artifact ? { id: artifact.id, name: artifact.name, digest: artifact.digest, createdAt: artifact.created_at } : null,
      checkoutSha: log.checkoutSha,
      sourceHead,
      testedTree: testedCommit?.tree,
      testedParents: testedCommit?.parents,
    };
  }
  return {
    ok: errors.length === 0,
    errors,
    record: {
      prNumber: input.prNumber,
      candidate,
      candidateTree: input.candidateTree,
      base,
      run: { id: run?.id, attempt, url: run?.html_url, headSha: run?.head_sha, conclusion: run?.conclusion },
      jobs: jobRecords,
      a2: a2Record,
    },
  };
}

// ── accepted integration binding ─────────────────────────────────────────────

/**
 * Does a workflow source run on pushes to main? Returns "always" (unfiltered),
 * "conditional" (path-filtered: required only when GitHub started a run) or "no".
 * @param {string} yamlText
 */
export function mainPushApplicability(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  const start = lines.findIndex((l) => /^(on|"on"|'on'):\s*$/.test(l));
  if (start < 0) {
    const inline = lines.find((l) => /^(on|"on"|'on'):\s*\S/.test(l)) ?? "";
    return /\bpush\b/.test(inline) ? "always" : "no";
  }
  const block = [];
  for (const l of lines.slice(start + 1)) {
    if (/^\S/.test(l) && !l.startsWith("#")) break;
    block.push(l);
  }
  const pushIdx = block.findIndex((l) => /^\s{2}push:\s*(#.*)?$/.test(l) || /^\s{2}push\s*$/.test(l));
  if (pushIdx < 0) return "no";
  const push = [];
  for (const l of block.slice(pushIdx + 1)) {
    if (/^\s{2}\S/.test(l)) break;
    push.push(l.replace(/#.*$/, ""));
  }
  const text = push.join("\n");
  const branches = filterList(push, "branches");
  const ignored = filterList(push, "branches-ignore");
  const tagsOnly = filterList(push, "tags") !== null && branches === null && ignored === null;
  if (tagsOnly) return "no";
  if (branches !== null && !branches.some((p) => globMatches(p, "main"))) return "no";
  if (ignored !== null && ignored.some((p) => globMatches(p, "main"))) return "no";
  return /^\s+paths(-ignore)?:/m.test(text) ? "conditional" : "always";
}

/**
 * Entries of a `key:` filter under a trigger (inline `[a, b]` or a dash list);
 * null when the key is absent.
 * @param {string[]} lines @param {string} key
 */
function filterList(lines, key) {
  const idx = lines.findIndex((l) => new RegExp(`^\\s+${key}:`).test(l));
  if (idx < 0) return null;
  const line = lines[idx] ?? "";
  const indent = (/^(\s*)/.exec(line)?.[1] ?? "").length;
  const unquote = (/** @type {string} */ v) => v.trim().replace(/^['"]|['"]$/g, "");
  const inline = /:\s*\[(.*)\]\s*$/.exec(line);
  if (inline) return (inline[1] ?? "").split(",").map(unquote).filter(Boolean);
  const out = [];
  for (const l of lines.slice(idx + 1)) {
    if (!l.trim()) continue;
    const ind = (/^(\s*)/.exec(l)?.[1] ?? "").length;
    const m = /^\s*-\s*(.+)$/.exec(l);
    if (ind <= indent && !m) break;
    if (!m) break;
    out.push(unquote(m[1] ?? ""));
  }
  return out;
}

/** GitHub branch-filter glob (`*` excludes `/`, `**` matches anything). */
function globMatches(/** @type {string} */ pattern, /** @type {string} */ branch) {
  if (pattern.startsWith("!")) return false;
  const re = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\?/g, ".").replace(/\u0000/g, ".*");
  return new RegExp(`^${re}$`).test(branch);
}

/**
 * @param {{
 *  integration: string, integrationTree: string, integrationParents?: string[],
 *  prMergeCommit?: string, onMain: boolean, a2: any,
 *  workflows: {path: string, name?: string, applicability: "always"|"conditional"|"no"}[],
 *  runs: any[], jobsByRun: Record<string, any[]>
 * }} input
 */
export function verifyIntegration(input) {
  const { integration, integrationTree, onMain, a2, workflows, runs, jobsByRun } = input;
  const errors = [];
  if (!SHA_RE.test(integration)) errors.push("integration must be a full 40-hex SHA (never main/HEAD)");
  if (input.prMergeCommit !== undefined && input.prMergeCommit !== integration) {
    errors.push(`PR merge result ${input.prMergeCommit} != integration ${integration}`);
  }
  if (!onMain) errors.push(`integration ${integration} is not on origin/main's accepted history`);
  const testedTree = a2?.a2?.testedTree;
  if (!testedTree) errors.push("A2 evidence has no tested tree");
  else if (testedTree !== integrationTree) errors.push(`integration tree ${integrationTree} != A2-tested tree ${testedTree}`);

  const applicable = workflows.filter((w) => w.applicability !== "no");
  if (!applicable.some((w) => w.path === PRODUCTION_DEPLOY_PATH)) errors.push(`${PRODUCTION_DEPLOY_PATH} is not an applicable main workflow`);
  const records = [];
  for (const wf of applicable) {
    const mine = runs.filter((r) => r.path === wf.path && r.head_sha === integration && r.event === "push" && r.head_branch === "main");
    if (!mine.length) {
      if (wf.applicability === "always") errors.push(`no push run of ${wf.path} at ${integration} (missing evidence blocks tagging)`);
      records.push({ path: wf.path, state: "no-run", applicability: wf.applicability });
      continue;
    }
    for (const r of mine) {
      const jobs = jobsByRun[String(r.id)] ?? [];
      const bad = jobs.filter((j) => !["success", "skipped", "neutral"].includes(j.conclusion));
      if (r.status !== "completed" || r.conclusion !== "success") errors.push(`${wf.path} run ${r.id} attempt ${r.run_attempt} is ${r.status}/${r.conclusion}`);
      for (const j of bad) errors.push(`${wf.path} run ${r.id} job '${j.name}' concluded ${j.conclusion}`);
      records.push({ path: wf.path, name: r.name, runId: r.id, attempt: r.run_attempt, url: r.html_url, status: r.status, conclusion: r.conclusion, jobs: jobs.map((j) => ({ name: j.name, conclusion: j.conclusion })) });
    }
  }
  return { ok: errors.length === 0, errors, record: { integration, integrationTree, integrationParents: input.integrationParents, a2TestedTree: testedTree, mainWorkflows: records } };
}

// ── Actions-path admission (RELEASE.md, "Actions release path") ───────────────

export const ACTIONS_RELEASE_WORKFLOW = "release-actions.yml";
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

/** @param {unknown} v */
export function isFullSha(v) {
  return typeof v === "string" && SHA_RE.test(v);
}

/**
 * Validate the fixed inputs of an Actions-path admission. They are claims to be
 * checked, never evidence: `compareAdmission` re-derives every one of them.
 * @param {Record<string, string|undefined>} o
 */
export function validateAdmissionInputs(o) {
  const errors = [];
  if (!parseSemver(o.version ?? "")) errors.push(`version '${o.version}' is not semver`);
  for (const k of ["integration", "candidate", "base"]) if (!isFullSha(o[k])) errors.push(`--${k} must be a full 40-hex SHA (never main/HEAD/a branch)`);
  for (const k of ["pr", "run", "attempt", "artifact-id"]) if (!/^[1-9]\d*$/.test(o[k] ?? "")) errors.push(`--${k} must be a positive integer`);
  if (!DIGEST_RE.test(o["artifact-digest"] ?? "")) errors.push("--artifact-digest must be sha256:<64 hex>");
  return errors;
}

/**
 * Cross-check the declared release inputs against the records re-derived from
 * GitHub in this job (`a2-evidence.json`, `integration.json`). Any difference
 * blocks: a frozen candidate or an in-progress release is never moved to another
 * SHA, run, attempt or artifact.
 * @param {{declared: Record<string,string>, a2: any, integration: any}} input
 */
export function compareAdmission({ declared, a2, integration }) {
  const errors = [];
  const eq = (/** @type {string} */ what, /** @type {unknown} */ observed, /** @type {unknown} */ expected) => {
    if (String(observed) !== String(expected)) errors.push(`${what}: observed ${observed ?? "(none)"} != declared ${expected}`);
  };
  if (!a2?.ok) errors.push("A2 evidence re-derived in this job is not verified");
  if (!integration?.ok) errors.push("integration binding re-derived in this job is not verified");
  eq("PR number", a2?.prNumber, declared.pr);
  eq("PR Checks run", a2?.run?.id, declared.run);
  eq("run attempt", a2?.run?.attempt, declared.attempt);
  eq("candidate head", a2?.candidate, declared.candidate);
  eq("run head_sha", a2?.run?.headSha, declared.candidate);
  eq("base", a2?.base, declared.base);
  eq("A2 artifact id", a2?.a2?.artifact?.id, declared["artifact-id"]);
  eq("A2 artifact digest (GitHub)", a2?.a2?.artifact?.digest, declared["artifact-digest"]);
  eq("A2 artifact digest (downloaded bytes)", a2?.artifactDownload?.sha256, declared["artifact-digest"]);
  eq("accepted integration", integration?.integration, declared.integration);
  if (integration && a2?.a2?.testedTree !== integration.integrationTree) {
    errors.push(`integration tree ${integration.integrationTree} != A2-tested tree ${a2?.a2?.testedTree}`);
  }
  if (integration && integration.prNumber !== undefined) eq("integration PR", integration.prNumber, declared.pr);
  return { ok: errors.length === 0, errors };
}

/**
 * Decide what to do with one release tag. Same SHA → resume (kept), absent →
 * create, anything else → refuse (tags are never moved).
 * @param {{tag: string, existing: string|null, integration: string}} input
 */
export function decideTag({ tag, existing, integration }) {
  if (!existing) return { action: /** @type {const} */ ("create"), tag };
  if (existing === integration) return { action: /** @type {const} */ ("keep"), tag };
  return {
    action: /** @type {const} */ ("refuse"),
    tag,
    reason: `${tag} already targets ${existing}, not ${integration}. Tags are never moved and a release is never re-pointed: return to fresh A2 evidence and integration approval for a corrected candidate.`,
  };
}

/**
 * Pick the publish run that belongs to exactly this workflow, tag and SHA.
 * The runs listing is filtered by workflow id and head_sha server-side; this
 * re-checks every field instead of trusting the filter.
 * @param {{workflow: string}} pkg @param {string} tag @param {string} sha @param {any[]} runs
 */
export function matchingPublishRuns(pkg, tag, sha, runs) {
  return runs.filter(
    (r) =>
      r.head_branch === tag &&
      r.head_sha === sha &&
      (r.path === undefined || r.path === `.github/workflows/${pkg.workflow}`) &&
      (r.event === undefined || r.event === "release" || r.event === "workflow_dispatch") &&
      r.conclusion !== "skipped",
  );
}
