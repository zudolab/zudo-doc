#!/usr/bin/env node
// In-workflow release steps for .github/workflows/publish-*.yml.
//
// Subcommands (each prints what it decided; RELEASE.md, "Publish workflows"):
//   toolchain                         install the pinned npm CLI, verify integrity, print versions
//   guard --package K --tag T [--dry-run]
//                                     tag namespace/version/SHA/main/lockstep + registry state → mode
//   pack-check --package K            nonmutating pack; assert `workspace:` was rewritten
//   publish --package K --tag T       tokenless OIDC publish (refuses static credentials)
//   finalize --package K --tag T --mode publish|resume
//                                     confirm version, provenance and channel; repair a lagging channel
//   cleanup-next --package K --tag T  checked, race-protected stale `next` removal
//
// Exit codes: 0 ok, 1 blocked/failed, 2 unknown (registry/GitHub uncertainty).

import { spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  NPM_CLI_PIN,
  PACKAGES,
  ReleaseError,
  compareSemver,
  decideChannel,
  decideStaleNext,
  evaluateExistingVersion,
  getPackage,
  lookupVersion,
  parseReleaseTag,
  readDistTags,
  readPackument,
  readProvenance,
  tagFor,
} from "./lib.mjs";

/**
 * @typedef {{status: number|null, stdout: string, stderr: string}} ExecResult
 * @typedef {{
 *   exec: (cmd: string, args: string[], opts?: {cwd?: string, inherit?: boolean, env?: NodeJS.ProcessEnv}) => ExecResult,
 *   fetchImpl?: typeof fetch, sleep?: (ms: number) => Promise<unknown>, env: NodeJS.ProcessEnv,
 *   readFile: (p: string) => string, log: (s: string) => void, now: () => number, cwd: string,
 *   pollAttempts?: number, pollDelayMs?: number,
 * }} Deps
 */

/** @returns {Deps} */
export function realDeps() {
  return {
    exec: (cmd, args, opts = {}) => {
      const r = spawnSync(cmd, args, {
        cwd: opts.cwd,
        env: opts.env ?? process.env,
        encoding: "utf8",
        stdio: opts.inherit ? "inherit" : "pipe",
      });
      if (r.error) return { status: null, stdout: "", stderr: r.error.message };
      return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
    },
    env: process.env,
    readFile: (p) => readFileSync(p, "utf8"),
    log: (s) => console.log(s),
    now: () => Date.now(),
    cwd: process.cwd(),
  };
}

/** @param {string[]} argv */
function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  /** @type {Record<string, string|boolean>} */
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] ?? "";
    if (!a.startsWith("--")) throw new ReleaseError(`Unexpected argument '${a}'`);
    const key = a.slice(2);
    const val = rest[i + 1];
    if (val === undefined || val.startsWith("--")) opts[key] = true;
    else {
      opts[key] = val;
      i++;
    }
  }
  return { cmd, opts };
}

/** @param {Deps} d @param {string} name @param {string} value */
function setOutput(d, name, value) {
  if (d.env.GITHUB_OUTPUT) appendFileSync(d.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}
/** @param {Deps} d @param {string} name @param {string} value */
function setEnv(d, name, value) {
  if (d.env.GITHUB_ENV) appendFileSync(d.env.GITHUB_ENV, `${name}=${value}\n`);
}
/** @param {Deps} d @param {string} md */
function summary(d, md) {
  if (d.env.GITHUB_STEP_SUMMARY) appendFileSync(d.env.GITHUB_STEP_SUMMARY, `${md}\n`);
}

/** @param {Deps} d @param {string} cmd @param {string[]} args @param {{cwd?: string}} [opts] */
function must(d, cmd, args, opts) {
  const r = d.exec(cmd, args, opts);
  if (r.status !== 0) {
    throw new ReleaseError(`\`${cmd} ${args.join(" ")}\` failed (exit ${r.status}): ${r.stderr.trim() || r.stdout.trim()}`);
  }
  return r.stdout.trim();
}

/** @param {Deps} d */
function registryOpts(d) {
  return { fetchImpl: d.fetchImpl, sleep: d.sleep };
}

// Static npm credentials are exactly what this migration retires. A run that has
// one cannot prove OIDC operation, so it is refused rather than used.
const STATIC_CREDENTIAL_ENV = ["NODE_AUTH_TOKEN", "NPM_TOKEN", "NPM_CONFIG__AUTH", "NPM_CONFIG__AUTHTOKEN", "npm_config__auth", "npm_config__authToken"];

/** @param {Deps} d */
export function assertTokenless(d) {
  const present = STATIC_CREDENTIAL_ENV.filter((k) => d.env[k]);
  for (const k of Object.keys(d.env)) {
    if (/^npm_config_\/\/.*:_auth(token)?$/i.test(k) && d.env[k]) present.push(k);
  }
  // npm >= 9 refuses to print protected `:_` keys, so read the npmrc files themselves.
  const npmrcs = new Set([join(d.cwd, ".npmrc")]);
  for (const key of ["userconfig", "globalconfig"]) {
    const r = d.exec("npm", ["config", "get", key]);
    if (r.status !== 0 || !r.stdout.trim()) throw new ReleaseError(`Cannot resolve npm ${key} to check it for static credentials`);
    npmrcs.add(r.stdout.trim());
  }
  if (d.env.NPM_CONFIG_USERCONFIG) npmrcs.add(d.env.NPM_CONFIG_USERCONFIG);
  for (const file of npmrcs) {
    let text = "";
    try {
      text = d.readFile(file);
    } catch {
      continue;
    }
    if (/^\s*(?:\/\/[^\s=]*:)?_(?:authToken|auth|password)\s*=\s*\S/m.test(text)) {
      present.push(`credential in ${file}`);
    }
  }
  if (present.length) {
    throw new ReleaseError(`Static npm credential present (${present.join(", ")}). Trusted publishing must run without stored tokens; remove it from the workflow/environment.`);
  }
  if (!d.env.ACTIONS_ID_TOKEN_REQUEST_URL || !d.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) {
    throw new ReleaseError("No GitHub OIDC token endpoint (job lacks `permissions: id-token: write`, or this is not a GitHub-hosted Actions run). There is no token fallback.");
  }
}

/** @param {{name: string, workflow: string}} pkg */
function trustedPublisherHint(pkg) {
  return [
    `npm rejected the OIDC write for ${pkg.name}. Check its npm trusted publisher (npmjs.com → package → Settings → Trusted publishing):`,
    "  Publisher: GitHub Actions   Organization or user: zudolab   Repository: zudo-doc",
    `  Workflow filename: ${pkg.workflow}   Environment name: (empty)`,
    "  Dist-tag writes additionally need 'Allow npm dist-tag' on that publisher.",
  ].join("\n");
}

// ── subcommands ──────────────────────────────────────────────────────────────

/** @param {Deps} d */
export function cmdToolchain(d) {
  const dir = mkdtempSync(join(tmpdir(), "npm-cli-"));
  try {
    const packed = JSON.parse(must(d, "npm", ["pack", `npm@${NPM_CLI_PIN.version}`, "--json", "--pack-destination", dir]));
    const entry = Array.isArray(packed) ? packed[0] : packed;
    if (entry?.integrity !== NPM_CLI_PIN.integrity) {
      throw new ReleaseError(`npm@${NPM_CLI_PIN.version} integrity ${entry?.integrity} != reviewed ${NPM_CLI_PIN.integrity}`);
    }
    must(d, "npm", ["install", "--global", "--no-audit", "--no-fund", join(dir, entry.filename)]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const npmVersion = must(d, "npm", ["--version"]);
  if (npmVersion !== NPM_CLI_PIN.version) throw new ReleaseError(`npm on PATH is ${npmVersion}, expected pinned ${NPM_CLI_PIN.version}`);
  const npmPath = d.exec("pnpm", ["config", "get", "npm-path"]).stdout.trim();
  if (npmPath && npmPath !== "undefined") throw new ReleaseError(`pnpm npm-path is set to '${npmPath}'; pnpm publish must use the pinned npm on PATH`);
  const lines = [
    `node ${must(d, "node", ["--version"])}`,
    `npm ${npmVersion} (${must(d, "bash", ["-c", "command -v npm"])}) — performs the OIDC exchange`,
    `pnpm ${must(d, "pnpm", ["--version"])} — packs and delegates the upload to the npm above`,
  ];
  for (const l of lines) d.log(l);
  summary(d, `### Release toolchain\n\n${lines.map((l) => `- ${l}`).join("\n")}`);
  return 0;
}

/** @param {Deps} d @param {Record<string, string|boolean>} o */
export async function cmdGuard(d, o) {
  const pkg = getPackage(String(o.package));
  const dryRun = o["dry-run"] === true || o["dry-run"] === "true";
  const { tag, version, distTag } = parseReleaseTag(pkg, String(o.tag));
  const pkgVersion = JSON.parse(d.readFile(join(d.cwd, pkg.dir, "package.json"))).version;
  if (pkgVersion !== version) throw new ReleaseError(`${pkg.dir}/package.json version '${pkgVersion}' != tag version '${version}'`);

  const head = must(d, "git", ["rev-parse", "HEAD"]);
  const tagCommit = d.exec("git", ["rev-parse", "--verify", `refs/tags/${tag}^{commit}`]);
  if (tagCommit.status !== 0) {
    if (!dryRun) throw new ReleaseError(`Tag ${tag} is not present in the checkout; publish runs only from a release tag`);
    d.log(`::warning::dry run: ${tag} is not a tag in this checkout`);
  } else if (tagCommit.stdout.trim() !== head) {
    throw new ReleaseError(`Checked-out HEAD ${head} != tag ${tag} commit ${tagCommit.stdout.trim()}`);
  }

  const onMain = d.exec("git", ["merge-base", "--is-ancestor", head, "refs/remotes/origin/main"]);
  if (onMain.status !== 0) {
    const msg = `${head} is not on origin/main; release tags must target the accepted main integration (RELEASE.md)`;
    if (!dryRun) throw new ReleaseError(msg);
    d.log(`::warning::dry run: ${msg}`);
  }

  const remote = must(d, "git", ["ls-remote", "--tags", "origin"]);
  /** @type {Record<string,string>} */
  const peeled = {};
  for (const line of remote.split("\n")) {
    const [sha, ref] = line.split("\t");
    if (!sha || !ref) continue;
    const name = ref.replace(/^refs\/tags\//, "").replace(/\^\{\}$/, "");
    if (ref.endsWith("^{}") || !peeled[name]) peeled[name] = sha;
  }
  for (const sibling of PACKAGES) {
    const sTag = tagFor(sibling, version);
    if (peeled[sTag] && peeled[sTag] !== head) {
      throw new ReleaseError(`Lockstep tag ${sTag} targets ${peeled[sTag]}, not ${head}; all three tags must identify one integration`);
    }
  }

  const lookup = await lookupVersion(pkg.name, version, registryOpts(d));
  /** @type {"publish"|"resume"} */
  let mode;
  if (lookup.state === "unknown") {
    for (const e of lookup.errors) d.log(`  ${e}`);
    throw Object.assign(new ReleaseError(`Registry state of ${pkg.name}@${version} is UNKNOWN (not absent); refusing to proceed`), { exitCode: 2 });
  } else if (lookup.state === "absent") {
    mode = "publish";
    d.log(`OK: ${pkg.name}@${version} is absent on the registry → publish`);
  } else {
    const polled = await poll(d, async () => {
      const p = await readProvenance(pkg.name, version, registryOpts(d));
      return { done: p.state === "ok", value: p };
    });
    const verdict = evaluateExistingVersion({ pkg, version, provenance: polled?.value, expectedSha: head, expectedTag: tag });
    if (verdict.verdict === "unknown" || verdict.verdict === "unproven") throw Object.assign(new ReleaseError(`Provenance of existing ${pkg.name}@${version} is UNKNOWN: ${verdict.reasons.join("; ")}`), { exitCode: 2 });
    if (verdict.verdict === "mismatch") {
      throw new ReleaseError(`${pkg.name}@${version} already exists from a different source; never republish: ${verdict.reasons.join("; ")}`);
    }
    mode = "resume";
    d.log(`${pkg.name}@${version} already exists with provenance from ${head} via ${pkg.workflow} → resume finalization only (this is NOT a fresh publication)`);
  }

  for (const [k, v] of Object.entries({ TAG: tag, VERSION: version, DIST_TAG: distTag })) setEnv(d, k, v);
  for (const [k, v] of Object.entries({ tag, version, dist_tag: distTag, mode, sha: head })) setOutput(d, k, v);
  summary(d, `### ${pkg.name} guard\n\n| tag | version | dist-tag | source | mode |\n|---|---|---|---|---|\n| \`${tag}\` | ${version} | ${distTag} | \`${head}\` | ${dryRun ? `dry-run (would ${mode})` : mode} |`);
  return 0;
}

/** @param {Deps} d @param {Record<string, string|boolean>} o */
export function cmdPackCheck(d, o) {
  const pkg = getPackage(String(o.package));
  const dir = mkdtempSync(join(tmpdir(), "pack-check-"));
  try {
    if (pkg.key === "create-zudo-doc") must(d, "npm", ["pack", "--pack-destination", dir], { cwd: join(d.cwd, pkg.dir) });
    else must(d, "pnpm", ["--filter", pkg.name, "pack", "--pack-destination", dir]);
    const tgz = readdirSync(dir).find((f) => f.endsWith(".tgz"));
    if (!tgz) throw new ReleaseError("pack produced no tarball");
    const manifest = JSON.parse(must(d, "tar", ["-xOzf", join(dir, tgz), "package/package.json"]));
    const leaks = [];
    for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      for (const [dep, spec] of Object.entries(manifest[field] ?? {})) {
        if (String(spec).startsWith("workspace:")) leaks.push(`${field}.${dep}=${spec}`);
      }
    }
    if (manifest.name !== pkg.name) throw new ReleaseError(`packed name ${manifest.name} != ${pkg.name}`);
    if (leaks.length) throw new ReleaseError(`packed manifest still has workspace: specifiers: ${leaks.join(", ")}`);
    d.log(`OK: packed ${manifest.name}@${manifest.version}; no workspace: specifiers`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return 0;
}

/** @param {Deps} d @param {Record<string, string|boolean>} o */
export function cmdPublish(d, o) {
  const pkg = getPackage(String(o.package));
  const { version, distTag } = parseReleaseTag(pkg, String(o.tag));
  assertTokenless(d);
  const r =
    pkg.key === "create-zudo-doc"
      ? d.exec("npm", ["publish", "--access", "public", "--provenance", "--tag", distTag], { cwd: join(d.cwd, pkg.dir), inherit: true })
      : d.exec("pnpm", ["--filter", pkg.name, "publish", "--access", "public", "--provenance", "--no-git-checks", "--tag", distTag], { inherit: true });
  if (r.status !== 0) {
    // The npm/pnpm error above is the original error; this only adds context.
    d.log(`::error::Publishing ${pkg.name}@${version} failed (exit ${r.status}). The registry state is now uncertain; re-run this workflow to resume — the guard will classify it.`);
    d.log(trustedPublisherHint(pkg));
    return r.status ?? 1;
  }
  d.log(`Publish command for ${pkg.name}@${version} (--tag ${distTag}) exited 0`);
  return 0;
}

/** @param {Deps} d @param {() => Promise<{done: boolean, unknown?: boolean, value?: any}>} probe */
async function poll(d, probe) {
  const attempts = d.pollAttempts ?? 12;
  const delay = d.pollDelayMs ?? 10_000;
  const sleep = d.sleep ?? ((/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms)));
  let last;
  for (let i = 1; i <= attempts; i++) {
    last = await probe();
    if (last.done) return last;
    if (i < attempts) await sleep(delay);
  }
  return last;
}

/** @param {Deps} d @param {Record<string, string|boolean>} o */
export async function cmdFinalize(d, o) {
  const pkg = getPackage(String(o.package));
  const { tag, version, distTag } = parseReleaseTag(pkg, String(o.tag));
  const mode = String(o.mode ?? "publish");
  const head = must(d, "git", ["rev-parse", "HEAD"]);

  const seen = await poll(d, async () => {
    const r = await lookupVersion(pkg.name, version, registryOpts(d));
    return { done: r.state === "present", unknown: r.state === "unknown", value: r };
  });
  if (!seen?.done) {
    throw Object.assign(new ReleaseError(`${pkg.name}@${version} is not visible on the registry after the bounded wait — state UNKNOWN, not absent. Re-run to resume.`), { exitCode: 2 });
  }
  const prov = await poll(d, async () => {
    const p = await readProvenance(pkg.name, version, registryOpts(d));
    return { done: p.state === "ok", value: p };
  });
  const verdict = evaluateExistingVersion({ pkg, version, provenance: prov?.value, expectedSha: head, expectedTag: tag });
  if (verdict.verdict !== "matches") {
    throw Object.assign(new ReleaseError(`Provenance of ${pkg.name}@${version} does not prove this source: ${verdict.reasons.join("; ")}`), { exitCode: verdict.verdict === "mismatch" ? 1 : 2 });
  }

  const tags = await readDistTags(pkg.name, registryOpts(d));
  if (tags.state !== "ok") throw Object.assign(new ReleaseError(`dist-tags of ${pkg.name} are UNKNOWN: ${tags.errors.join("; ")}`), { exitCode: 2 });
  let channel = decideChannel({ version, distTag, tags: tags.tags ?? {} });
  if (channel.action === "set") {
    assertTokenless(d);
    d.log(`Channel ${distTag} is ${channel.current ?? "unset"}; setting it to ${version} via OIDC`);
    const r = d.exec("npm", ["dist-tag", "add", `${pkg.name}@${version}`, distTag], { inherit: true });
    if (r.status !== 0) {
      d.log(trustedPublisherHint(pkg));
      throw new ReleaseError(`npm dist-tag add ${pkg.name}@${version} ${distTag} failed (exit ${r.status})`);
    }
    const after = await readDistTags(pkg.name, registryOpts(d));
    channel = decideChannel({ version, distTag, tags: after.tags ?? {} });
    if (channel.action !== "ok") throw Object.assign(new ReleaseError(`Channel ${distTag} still reads ${channel.current} after repair`), { exitCode: 2 });
  } else if (channel.action === "conflict") {
    throw new ReleaseError(`Channel ${distTag} holds newer ${channel.current}; not moving it backward to ${version}`);
  }

  const publisher = seen.value?.manifest?._npmUser?.name ?? "unknown";
  const fresh = mode === "publish";
  const line = `${pkg.name}@${version}: present; provenance ${head} via ${pkg.workflow} (${prov?.value?.invocationId ?? "?"}); ${distTag} → ${version}; npm publisher identity: ${publisher}; ${fresh ? "published by THIS run" : "pre-existing version (resumed finalization; not a fresh publication)"}`;
  d.log(line);
  summary(d, `### ${pkg.name} finalization\n\n${line}`);
  setOutput(d, "fresh", String(fresh));
  return 0;
}

/** @param {Deps} d @param {Record<string, string|boolean>} o */
export async function cmdCleanupNext(d, o) {
  const pkg = getPackage(String(o.package));
  const { version } = parseReleaseTag(pkg, String(o.tag));
  const report = (/** @type {string} */ outcome, /** @type {string} */ detail, code = 0) => {
    const line = `stale-next cleanup for ${pkg.name} after ${version}: ${outcome} — ${detail}`;
    d.log(code === 0 ? line : `::warning::${line}`);
    summary(d, `### ${pkg.name} \`next\` maintenance\n\n${line}`);
    setOutput(d, "outcome", outcome);
    return code;
  };
  const startedAt = d.now();
  const first = await readDistTags(pkg.name, registryOpts(d));
  if (first.state !== "ok") return report("unknown", `dist-tags unreadable: ${first.errors.join("; ")}`, 2);
  const decision = decideStaleNext({ version, tags: first.tags ?? {} });
  if (decision.action === "skip") return report("not-applicable", "prerelease publish keeps next");
  if (decision.action === "none") return report("absent", "no next dist-tag");
  if (decision.action === "keep") return report(decision.outcome, `next=${decision.next} is not older than ${version}; left in place`);

  // Race protection: re-read immediately before the write; the per-package
  // concurrency group serializes publishes from this repository.
  const again = await readDistTags(pkg.name, registryOpts(d));
  if (again.state !== "ok") return report("unknown", `dist-tags unreadable before removal: ${again.errors.join("; ")}`, 2);
  if (again.tags?.next !== decision.next) return report("race-left-in-place", `next changed ${decision.next} → ${again.tags?.next ?? "(none)"} since the decision`);

  try {
    assertTokenless(d);
  } catch (e) {
    return report("failed", /** @type {Error} */ (e).message, 1);
  }
  const rm = d.exec("npm", ["dist-tag", "rm", pkg.name, "next"], { inherit: true });
  if (rm.status !== 0) {
    d.log(trustedPublisherHint(pkg));
    return report("failed", `npm dist-tag rm exited ${rm.status} (original error above); next=${decision.next} still stale`, 1);
  }

  const after = await readDistTags(pkg.name, registryOpts(d));
  if (after.state !== "ok") return report("unknown", `removal ran but dist-tags are unreadable afterwards: ${after.errors.join("; ")}`, 2);
  if (after.tags?.next && after.tags.next !== decision.next) return report("race-left-in-place", `a different next (${after.tags.next}) appeared; left in place`);
  if (after.tags?.next === decision.next) return report("unverified", `next still reads ${decision.next} after removal`, 2);

  // A preview published between the re-read and the removal would have lost its
  // pointer. Restore it rather than silently dropping a legitimate newer preview.
  const pk = await readPackument(pkg.name, registryOpts(d));
  if (pk.state !== "ok") return report("unverified", `removed stale next=${decision.next}, but could not read publish times to rule out a concurrent preview: ${pk.errors.join("; ")}`, 2);
  const times = /** @type {Record<string,string>} */ (pk.body?.time ?? {});
  const newer = Object.entries(times)
    .filter(([v, t]) => v.includes("-") && Date.parse(t) >= startedAt - 60_000)
    .map(([v]) => v)
    .filter((v) => decideStaleNext({ version, tags: { next: v } }).action === "keep")
    .sort(compareSemver)
    .pop();
  if (newer) {
    const add = d.exec("npm", ["dist-tag", "add", `${pkg.name}@${newer}`, "next"], { inherit: true });
    return add.status === 0
      ? report("race-restored", `removed stale ${decision.next}, then restored next → newer preview ${newer} published during cleanup`)
      : report("failed", `newer preview ${newer} lost its next pointer and restoring it failed (exit ${add.status})`, 1);
  }
  return report("removed", `removed stale next=${decision.next}`);
}

/** @param {string[]} argv @param {Deps} d */
export async function main(argv, d) {
  const { cmd, opts } = parseArgs(argv);
  try {
    switch (cmd) {
      case "toolchain":
        return cmdToolchain(d);
      case "guard":
        return await cmdGuard(d, opts);
      case "pack-check":
        return cmdPackCheck(d, opts);
      case "publish":
        return cmdPublish(d, opts);
      case "finalize":
        return await cmdFinalize(d, opts);
      case "cleanup-next":
        return await cmdCleanupNext(d, opts);
      default:
        d.log("Usage: publish-step.mjs <toolchain|guard|pack-check|publish|finalize|cleanup-next> [--package K] [--tag T] [--dry-run] [--mode publish|resume]");
        return 1;
    }
  } catch (e) {
    const err = /** @type {Error & {exitCode?: number}} */ (e);
    d.log(`::error::${err.message}`);
    return err.exitCode ?? 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await main(process.argv.slice(2), realDeps());
}
