#!/usr/bin/env node
/**
 * close-stale-issues.mjs — close migration-regression GitHub issues whose
 * cluster signatures no longer appear in the latest migration-check report.
 *
 * Usage:
 *   node scripts/migration-check/close-stale-issues.mjs [options]
 *   pnpm migration-check:close-stale          (live execution)
 *   pnpm migration-check:close-stale:dry-run  (preview only — no gh mutations)
 *
 * Options:
 *   --dry-run              Print WOULD CLOSE / WOULD KEEP lines; no gh calls.
 *   --findings-dir=<path>  Override the findings directory (default: config.findingsDir).
 *
 * Algorithm:
 *   1. Read batch-*.json from findingsDir; cluster with clusterFindings() to
 *      build the live signature set.
 *   2. Query gh for all open issues with label `migration-regression`.
 *   3. For each issue, parse the **Signature** table cell from the body.
 *      - Missing/unparseable signature → log for manual review; skip.
 *   4. Close issues whose signature is absent from the live set.
 *      Closing = add a comment (exact template from spec) then close via gh.
 *   5. In --dry-run mode print:
 *        WOULD CLOSE: #<n> [migration-regression:<short>] — signature <sig> not in live set
 *        WOULD KEEP:  #<n> [migration-regression:<short>]
 *      without any gh mutation calls.
 *
 * Stubbing gh for tests:
 *   Pass `_runGh` in the options object to replace the default runGh helper.
 *   This lets tests inject a mock without monkey-patching global state.
 *
 * ⚠ IMPORTANT — run in --dry-run mode first.
 *   Live execution closes real GitHub issues. Only run after B-9-1 + B-9-2
 *   merge AND a fresh `pnpm migration-check --rerun --raise-issues`. The
 *   manager is responsible for the live execution step.
 */

import { readdir, readFile }                  from "node:fs/promises";
import { join, resolve, dirname, basename }   from "node:path";
import { fileURLToPath }                      from "node:url";
import { execFile }                           from "node:child_process";
import { promisify }                          from "node:util";

import * as config              from "./config.mjs";
import { clusterFindings }      from "./lib/cluster-findings.mjs";
import { parseIssueSignature }  from "./lib/parse-issue-signature.mjs";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

/** Absolute path to the repo root (two levels up from scripts/migration-check/). */
const REPO_ROOT = resolve(__dirname, "../..");

// ── gh helper ──────────────────────────────────────────────────────────────────

/**
 * Execute `gh <args>` and return stdout as a string.
 * May throw if the command exits non-zero.
 *
 * Callers (and tests) may replace this via the `_runGh` option.
 *
 * @param {string[]} args
 * @returns {Promise<string>}
 */
export async function runGh(args) {
  const { stdout } = await execFileAsync("gh", args);
  return stdout.trim();
}

// ── Live signature loader ──────────────────────────────────────────────────────

/**
 * Read all batch-*.json findings from `findingsDir`, cluster them, and return
 * the set of live cluster signatures across all categories.
 *
 * Uses the same data pipeline as raise-issues.mjs / aggregate.mjs so that
 * the live set is consistent with what the harness considers current.
 *
 * @param {string} findingsDir
 * @returns {Promise<Set<string>>}
 */
export async function loadLiveSignatures(findingsDir) {
  /** @type {string[]} */
  let batchFiles = [];
  try {
    const entries = await readdir(findingsDir);
    batchFiles = entries
      .filter((f) => /^batch-\d{4}\.json$/.test(f))
      .map((f) => join(findingsDir, f));
  } catch {
    console.warn(`[close-stale] findings dir not found or unreadable: ${findingsDir}`);
  }

  /** @type {object[]} */
  const allFindings = [];
  for (const filePath of batchFiles) {
    try {
      const raw    = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.routes)) {
        allFindings.push(...parsed.routes);
      }
    } catch (err) {
      console.warn(`[close-stale] skipping ${basename(filePath)}: ${err.message}`);
    }
  }

  const clusters = clusterFindings(allFindings);
  const liveSet  = new Set();
  for (const catClusters of Object.values(clusters.byCategory)) {
    for (const cluster of catClusters) {
      liveSet.add(cluster.signature);
    }
  }

  return liveSet;
}

// ── Close-comment template ─────────────────────────────────────────────────────

/**
 * Build the exact comment text posted before closing a stale issue.
 *
 * @param {{ isoTimestamp: string, shortSha: string }} params
 * @returns {string}
 */
export function buildCloseComment({ isoTimestamp, shortSha }) {
  return (
    `Superseded by Phase B-N migration-parity work; this signature no longer fires in the latest \`/l-zfb-migration-check\` report (run: ${isoTimestamp} on commit \`${shortSha}\`). ` +
    `Closed automatically by \`scripts/migration-check/close-stale-issues.mjs\`.`
  );
}

// ── Short SHA helper ───────────────────────────────────────────────────────────

/**
 * Get the current git HEAD short SHA via `git rev-parse --short HEAD`.
 *
 * @returns {Promise<string>}
 */
export async function getShortSha() {
  const { stdout } = await execFileAsync("git", ["rev-parse", "--short", "HEAD"]);
  return stdout.trim();
}

// ── Core logic ─────────────────────────────────────────────────────────────────

/**
 * @typedef {object} CloseStaleResult
 * @property {string[]} closed   Issue numbers closed (or WOULD CLOSE in dry-run).
 * @property {string[]} kept     Issue numbers kept (signature still in live set).
 * @property {string[]} skipped  Issue numbers skipped (unparseable body — needs review).
 */

/**
 * Close stale migration-regression issues whose signatures are absent from
 * the current live findings set.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.findingsDir]  Override findings directory path.
 * @param {boolean} [opts.dryRun]       If true, skip gh mutation calls.
 * @param {(args: string[]) => Promise<string>} [opts._runGh]
 *   Inject a mock runGh for tests — never call this option directly from prod.
 * @returns {Promise<CloseStaleResult>}
 */
export async function closeStaleIssues(opts = {}) {
  const findingsDir = opts.findingsDir ?? resolve(REPO_ROOT, config.findingsDir);
  const dryRun      = opts.dryRun     ?? false;
  const gh          = opts._runGh     ?? runGh;

  console.log("[close-stale] close-stale-issues.mjs starting");
  console.log(`[close-stale]   findings-dir : ${findingsDir}`);
  console.log(`[close-stale]   dry-run      : ${dryRun}`);

  // ── 1. Build live signature set ───────────────────────────────────────────────

  const liveSignatures = await loadLiveSignatures(findingsDir);
  console.log(`[close-stale] ${liveSignatures.size} live cluster signature(s) in findings`);

  // ── 2. Fetch all open migration-regression issues ─────────────────────────────

  let issuesJson = "[]";
  try {
    issuesJson = await gh([
      "issue", "list",
      "--label",  "migration-regression",
      "--state",  "open",
      "--json",   "number,title,body",
      "--limit",  "200",
    ]);
  } catch (err) {
    console.error(`[close-stale] gh issue list failed: ${err.message}`);
    return { closed: [], kept: [], skipped: [] };
  }

  /** @type {Array<{ number: number, title: string, body: string }>} */
  let issues = [];
  try {
    issues = JSON.parse(issuesJson);
  } catch (err) {
    console.error(`[close-stale] failed to parse gh output: ${err.message}`);
    return { closed: [], kept: [], skipped: [] };
  }

  if (!Array.isArray(issues)) {
    console.error("[close-stale] unexpected gh output shape — expected JSON array");
    return { closed: [], kept: [], skipped: [] };
  }

  console.log(`[close-stale] ${issues.length} open migration-regression issue(s) found`);

  // ── 3. Resolve invocation metadata (once, for all close comments) ─────────────

  let isoTimestamp = "";
  let shortSha     = "";

  if (!dryRun) {
    isoTimestamp = new Date().toISOString();
    try {
      shortSha = await getShortSha();
    } catch {
      shortSha = "unknown";
      console.warn("[close-stale] could not resolve HEAD short SHA — using 'unknown'");
    }
  }

  // ── 4. Process each issue ─────────────────────────────────────────────────────

  const closed  = /** @type {string[]} */ ([]);
  const kept    = /** @type {string[]} */ ([]);
  const skipped = /** @type {string[]} */ ([]);

  for (const issue of issues) {
    const { number, title, body } = issue;
    const issueNumStr = String(number);

    // Extract short hash from title for display (title's 8-char marker)
    const titleMatch = typeof title === "string"
      ? title.match(/\[migration-regression:([0-9a-f]{8})\]/)
      : null;
    const shortHash = titleMatch ? titleMatch[1] : "(no-hash)";

    // Parse full signature from body
    const signature = parseIssueSignature(body ?? "");

    if (signature === null) {
      // Body missing or unparseable — log for manual review; do not close
      console.warn(
        `[close-stale] MANUAL REVIEW: #${number} [migration-regression:${shortHash}] — no parseable **Signature** in body; skipping (title short hash used as index key only)`,
      );
      skipped.push(issueNumStr);
      continue;
    }

    const isLive = liveSignatures.has(signature);

    if (isLive) {
      console.log(`WOULD KEEP: #${number} [migration-regression:${shortHash}]`);
      kept.push(issueNumStr);
      continue;
    }

    // Signature is NOT in the live set → close or print WOULD CLOSE
    if (dryRun) {
      console.log(
        `WOULD CLOSE: #${number} [migration-regression:${shortHash}] — signature ${signature} not in live set`,
      );
      closed.push(issueNumStr);
    } else {
      console.log(`[close-stale] closing #${number} [migration-regression:${shortHash}]`);

      const comment = buildCloseComment({ isoTimestamp, shortSha });

      try {
        await gh(["issue", "comment", issueNumStr, "--body", comment]);
        await gh(["issue", "close", issueNumStr]);
        console.log(`[close-stale]   closed #${number}`);
        closed.push(issueNumStr);
      } catch (err) {
        console.error(`[close-stale]   failed to close #${number}: ${err.message}`);
        skipped.push(issueNumStr);
      }
    }
  }

  // ── 5. Summary ────────────────────────────────────────────────────────────────

  console.log("");
  console.log("[close-stale] ── summary ──────────────────────────────────────");
  if (dryRun) {
    console.log(`[close-stale]   would close : ${closed.length}`);
    console.log(`[close-stale]   would keep  : ${kept.length}`);
  } else {
    console.log(`[close-stale]   closed  : ${closed.length}`);
    console.log(`[close-stale]   kept    : ${kept.length}`);
  }
  console.log(`[close-stale]   skipped : ${skipped.length} (${skipped.length > 0 ? "manual review needed" : "none"})`);

  return { closed, kept, skipped };
}

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {};
  for (const arg of argv) {
    if (arg.startsWith("--findings-dir=")) {
      opts.findingsDir = resolve(arg.slice("--findings-dir=".length));
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    }
  }
  return opts;
}

// Run only when invoked directly — not when imported as a module by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  closeStaleIssues(opts).catch((err) => {
    console.error("[close-stale] fatal:", err?.message ?? err);
    process.exit(1);
  });
}
