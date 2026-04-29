#!/usr/bin/env node
/**
 * raise-issues.mjs — idempotent GitHub issue creation for migration-check regressions (S8).
 *
 * Usage:
 *   node scripts/migration-check/raise-issues.mjs [options]
 *
 * Options:
 *   --findings-dir=<dir>   Path to findings directory (default: config.findingsDir)
 *   --report-path=<path>   Path to report.md (default: config.reportPath)
 *   --dry-run              Print what would be created, but do not call gh
 *
 * Algorithm:
 *   1. Re-cluster findings (same data pipeline as aggregate.mjs) to get
 *      non-cosmetic clusters — avoids parsing the report.md text output.
 *   2. For each cluster compute a stable 8-char hex hash of its signature.
 *   3. Query gh for existing open issues bearing that hash marker.
 *   4. Create a new issue only if no open issue with that marker exists.
 *   5. Return { created: string[], skipped: string[] }.
 *
 * The module exports async raiseIssues(options) for consumption by run.mjs.
 * When invoked directly as a CLI script it runs raiseIssues() with argv options.
 *
 * Stubbing gh for tests:
 *   Pass `_runGh` in the options object to replace the default runGh helper.
 *   This lets tests inject a mock without monkey-patching global state.
 */

import { createHash }                  from "node:crypto";
import { readdir, readFile, mkdir }    from "node:fs/promises";
import { existsSync }                  from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath }               from "node:url";
import { execFile }                    from "node:child_process";
import { promisify }                   from "node:util";

import * as config             from "./config.mjs";
import { clusterFindings, REGRESSION_CATEGORIES } from "./lib/cluster-findings.mjs";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

/** Absolute path to the repo root (two levels up from scripts/migration-check/). */
const REPO_ROOT = resolve(__dirname, "../..");

// ── gh helper ──────────────────────────────────────────────────────────────────

/**
 * Default gh runner: executes `gh <args>` and returns stdout as a string.
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

// ── Stable hash ────────────────────────────────────────────────────────────────

/**
 * Compute a stable 8-char hex hash of a cluster signature string.
 * Used as the idempotency marker in the issue title.
 *
 * @param {string} signature
 * @returns {string}  8 lowercase hex chars
 */
export function hashSignature(signature) {
  return createHash("sha256").update(signature, "utf8").digest("hex").slice(0, 8);
}

// ── Label bootstrap ────────────────────────────────────────────────────────────

/**
 * Ensure the `migration-regression` label exists in the repo.
 * Silently ignores errors (label may already exist).
 *
 * @param {(args: string[]) => Promise<string>} gh   runGh-compatible function
 * @returns {Promise<void>}
 */
async function ensureLabel(gh) {
  try {
    await gh([
      "label", "create", "migration-regression",
      "--color", "D93F0B",
      "--description", "Regression detected by the zfb migration-check harness",
    ]);
  } catch {
    // Label already exists — that is fine.
  }
}

// ── Issue body formatter ───────────────────────────────────────────────────────

/**
 * Build the Markdown body for a migration-regression issue.
 *
 * @param {{ category: string, cluster: object, hashMarker: string }} params
 * @returns {string}
 */
export function buildIssueBody({ category, cluster, hashMarker }) {
  const sampleRoutesMd = cluster.sampleRoutes
    .map((r) => `- \`${r}\``)
    .join("\n");

  const showingOf =
    cluster.sampleRoutes.length < cluster.routeCount
      ? ` (showing ${cluster.sampleRoutes.length} of ${cluster.routeCount})`
      : "";

  return [
    `## Migration Regression: ${category}`,
    "",
    `| Field | Value |`,
    `| --- | --- |`,
    `| **Category** | \`${category}\` |`,
    `| **Routes affected** | ${cluster.routeCount} |`,
    `| **Signature** | \`${cluster.signature}\` |`,
    `| **Hash marker** | \`${hashMarker}\` |`,
    `| **Description** | ${cluster.description} |`,
    "",
    `### Sample routes${showingOf}`,
    "",
    sampleRoutesMd,
    "",
    "### Repro steps",
    "",
    "```sh",
    "pnpm migration-check --no-build && open .l-zfb-migration-check/report.md",
    "```",
    "",
    "### Context",
    "",
    // Back-links required by acceptance criteria (epic + prior issues)
    "- Epic: #510",
    "- Related: #480",
    "- Related: #473",
    "",
    "_Generated automatically by the migration-check harness. Review the full report before closing._",
  ].join("\n");
}

// ── Core logic ─────────────────────────────────────────────────────────────────

/**
 * Read all batch findings from `findingsDir`, cluster them, and return only
 * the non-cosmetic clusters (those in REGRESSION_CATEGORIES).
 *
 * @param {string} findingsDir
 * @returns {Promise<Array<{ category: string, cluster: object }>>}
 */
async function loadNonCosmeticClusters(findingsDir) {
  let batchFiles = [];
  try {
    const entries = await readdir(findingsDir);
    batchFiles = entries
      .filter((f) => /^batch-\d{4}\.json$/.test(f))
      .map((f) => join(findingsDir, f));
  } catch {
    console.warn(`[S8] findings dir not found or empty: ${findingsDir}`);
  }

  /** @type {Array<object>} */
  const allFindings = [];

  for (const filePath of batchFiles) {
    try {
      const raw    = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.routes)) {
        allFindings.push(...parsed.routes);
      }
    } catch (err) {
      console.warn(`[S8] skipping ${basename(filePath)}: ${err.message}`);
    }
  }

  const clusters = clusterFindings(allFindings);

  const nonCosmetic = [];
  for (const [category, catClusters] of Object.entries(clusters.byCategory)) {
    if (!REGRESSION_CATEGORIES.has(category)) continue;
    for (const cluster of catClusters) {
      nonCosmetic.push({ category, cluster });
    }
  }

  // Sort by routeCount descending for deterministic output
  nonCosmetic.sort((a, b) => b.cluster.routeCount - a.cluster.routeCount);

  return nonCosmetic;
}

/**
 * Raise GitHub issues for all non-cosmetic migration regressions.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.findingsDir]   Override findings directory path.
 * @param {string}  [opts.reportPath]    Override report.md path (for display only).
 * @param {boolean} [opts.dryRun]        If true, skip gh calls and just print.
 * @param {(args: string[]) => Promise<string>} [opts._runGh]
 *   Inject a mock runGh for tests — never call this option directly from prod code.
 * @returns {Promise<{ created: string[], skipped: string[] }>}
 */
export async function raiseIssues(opts = {}) {
  const findingsDir = opts.findingsDir ?? resolve(REPO_ROOT, config.findingsDir);
  const dryRun      = opts.dryRun     ?? false;
  const gh          = opts._runGh     ?? runGh;

  console.log("[S8] raise-issues.mjs starting");
  console.log(`[S8]   findings-dir : ${findingsDir}`);
  console.log(`[S8]   dry-run      : ${dryRun}`);

  // ── 1. Load non-cosmetic clusters ────────────────────────────────────────────

  const nonCosmetic = await loadNonCosmeticClusters(findingsDir);

  if (nonCosmetic.length === 0) {
    console.log("[S8] No non-cosmetic clusters found — nothing to raise.");
    return { created: [], skipped: [] };
  }

  console.log(`[S8] ${nonCosmetic.length} non-cosmetic cluster(s) to process`);

  // ── 2. Ensure label exists ────────────────────────────────────────────────────

  if (!dryRun) {
    await ensureLabel(gh);
  }

  // ── 3. Process each cluster ───────────────────────────────────────────────────

  const created  = [];
  const skipped  = [];

  for (const { category, cluster } of nonCosmetic) {
    const hashMarker = hashSignature(cluster.signature);
    const title      = `[migration-regression:${hashMarker}] ${category}: ${cluster.description}`;

    console.log(`[S8] cluster: ${title}`);

    if (dryRun) {
      console.log(`[S8]   --dry-run: would create issue "${title}"`);
      created.push(title);
      continue;
    }

    // ── 3a. Check for existing open issue with this hash marker ──────────────
    let existingOutput = "";
    try {
      existingOutput = await gh([
        "issue", "list",
        "--label", "migration-regression",
        "--state",  "open",
        "--search", hashMarker,
        "--json",   "number,title",
      ]);
    } catch (err) {
      console.warn(`[S8]   gh issue list failed: ${err.message} — will attempt to create`);
    }

    let alreadyExists = false;
    try {
      const parsed = JSON.parse(existingOutput || "[]");
      alreadyExists = Array.isArray(parsed) &&
        parsed.some((issue) => typeof issue.title === "string" && issue.title.includes(hashMarker));
    } catch {
      // If parsing fails, assume no existing issue and proceed
    }

    if (alreadyExists) {
      console.log(`[S8]   skip (existing open issue found for ${hashMarker})`);
      skipped.push(title);
      continue;
    }

    // ── 3b. Create the issue ──────────────────────────────────────────────────

    const body = buildIssueBody({ category, cluster, hashMarker });

    let issueUrl = "";
    try {
      issueUrl = await gh([
        "issue", "create",
        "--title",  title,
        "--body",   body,
        "--label",  "migration-regression",
      ]);
      console.log(`[S8]   created: ${issueUrl.trim()}`);
      created.push(title);
    } catch (err) {
      console.error(`[S8]   failed to create issue: ${err.message}`);
      // Record as skipped so the summary is accurate; don't throw — process other clusters
      skipped.push(title);
    }
  }

  // ── 4. Summary ────────────────────────────────────────────────────────────────

  console.log("");
  console.log("[S8] ── raise-issues summary ──────────────────────────────────");
  console.log(`[S8]   created : ${created.length}`);
  console.log(`[S8]   skipped : ${skipped.length}`);

  return { created, skipped };
}

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {};

  for (const arg of argv) {
    if (arg.startsWith("--findings-dir=")) {
      opts.findingsDir = resolve(arg.slice("--findings-dir=".length));
    } else if (arg.startsWith("--report-path=")) {
      opts.reportPath = resolve(arg.slice("--report-path=".length));
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    }
  }

  return opts;
}

// Run only when invoked directly — not when imported as a module by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  raiseIssues(opts).catch((err) => {
    console.error("[S8] fatal:", err?.message ?? err);
    process.exit(1);
  });
}
