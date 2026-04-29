#!/usr/bin/env node
/**
 * aggregate.mjs — cluster findings and render the human-readable report (S7).
 *
 * Usage:
 *   node scripts/migration-check/aggregate.mjs [options]
 *
 * Options:
 *   --findings-dir=<dir>   Path to findings directory (default: config.findingsDir)
 *   --report-path=<path>   Output path for report.md (default: config.reportPath)
 *   --llm-review           Write llm-review-prompt.md for manual Opus review pass.
 *                          Does NOT invoke an agent automatically — see note below.
 *
 * LLM-review limitation:
 *   Programmatic agent invocation from Node.js is not supported in this harness.
 *   When --llm-review is passed, a prompt file is written to
 *   <workspace>/.l-zfb-migration-check/llm-review-prompt.md and a message is
 *   printed to STDOUT. To perform the LLM review, open the prompt file and paste
 *   it into an Opus session (e.g. via /codex-review in Claude Code).
 *
 * Input files (all relative to the workspace dir, parent of findingsDir):
 *   findings/batch-*.json   Per-batch route comparison results (S5b output)
 *   routes.json             Route discovery results (S4 output)
 *   artifacts.json          Non-HTML artifact diffs (S4 output)
 *
 * Output:
 *   report.md               Human-readable migration report (config.reportPath)
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

import * as config from "./config.mjs";
import { clusterFindings, REGRESSION_CATEGORIES, SAMPLE_SIZE } from "./lib/cluster-findings.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the repo root (two levels up from scripts/migration-check/). */
const REPO_ROOT = resolve(__dirname, "../..");

// ── Report rendering helpers ──────────────────────────────────────────────────

/**
 * Render a count table section of the report.
 * @param {{ [cat: string]: number }} counts
 * @returns {string}
 */
function renderSummaryTable(counts) {
  const CATEGORY_ORDER = [
    "identical",
    "structural",
    "content-loss",
    "asset-loss",
    "meta-changed",
    "link-changed",
    "cosmetic-only",
    "error",
    "route-only-in-a",
    "route-only-in-b",
  ];

  const rows = [];
  let total = 0;

  for (const cat of CATEGORY_ORDER) {
    const n = counts[cat] ?? 0;
    if (n > 0) {
      rows.push(`| ${cat} | ${n} |`);
      total += n;
    }
  }

  // Any unexpected categories
  for (const [cat, n] of Object.entries(counts)) {
    if (!CATEGORY_ORDER.includes(cat)) {
      rows.push(`| ${cat} | ${n} |`);
      total += n;
    }
  }

  rows.push(`| **Total** | **${total}** |`);

  return [
    "| Category | Routes |",
    "| --- | --- |",
    ...rows,
  ].join("\n");
}

/**
 * Render the symmetric-difference section (routes only in A or only in B).
 * @param {string[]} onlyInA
 * @param {string[]} onlyInB
 * @returns {string}
 */
function renderSymmetricDiff(onlyInA, onlyInB) {
  const lines = [];

  if (onlyInA.length === 0 && onlyInB.length === 0) {
    lines.push("_No route asymmetry detected — all routes present in both sites._");
    return lines.join("\n");
  }

  if (onlyInA.length > 0) {
    lines.push(`### Routes only in A (removed in B) — ${onlyInA.length} route(s)\n`);
    for (const r of onlyInA) {
      lines.push(`- \`${r}\``);
    }
  } else {
    lines.push("### Routes only in A — none\n");
  }

  lines.push("");

  if (onlyInB.length > 0) {
    lines.push(`### Routes only in B (added in B) — ${onlyInB.length} route(s)\n`);
    for (const r of onlyInB) {
      lines.push(`- \`${r}\``);
    }
  } else {
    lines.push("### Routes only in B — none\n");
  }

  return lines.join("\n");
}

/**
 * Render the artifact diffs section from artifacts.json content.
 * @param {object|null} artifactsData
 * @returns {string}
 */
function renderArtifactDiffs(artifactsData) {
  if (!artifactsData || !artifactsData.artifacts || artifactsData.artifacts.length === 0) {
    return "_No non-HTML artifacts found or artifacts.json not available._";
  }

  const { artifacts, stats } = artifactsData;
  const lines = [];

  lines.push(`**Stats**: ${stats.total} artifact(s) — ` +
    `${stats.identical ?? 0} identical, ${stats.changed ?? 0} changed, ` +
    `${stats.onlyInA ?? 0} only-in-A, ${stats.onlyInB ?? 0} only-in-B`);
  lines.push("");

  const changed = artifacts.filter(
    (a) => a.comparison?.identical === false || a.presence !== "present-in-both",
  );

  if (changed.length === 0) {
    lines.push("_All artifacts are identical._");
    return lines.join("\n");
  }

  for (const art of changed) {
    if (art.presence === "only-in-a") {
      lines.push(`- **\`${art.path}\`** — only in A (removed)`);
    } else if (art.presence === "only-in-b") {
      lines.push(`- **\`${art.path}\`** — only in B (added)`);
    } else if (art.type === "json" && art.comparison) {
      const c = art.comparison;
      const detail = c.error
        ? `parse error: ${c.error}`
        : `entry count delta: ${c.entryCountDelta > 0 ? "+" : ""}${c.entryCountDelta}` +
          (c.keySetDelta
            ? `, removed keys: [${c.keySetDelta.onlyInA.join(", ")}], added keys: [${c.keySetDelta.onlyInB.join(", ")}]`
            : "");
      lines.push(`- **\`${art.path}\`** (JSON) — ${detail}`);
    } else if (art.type === "text" && art.comparison) {
      const c = art.comparison;
      const detail = `${c.removedLines?.length ?? 0} line(s) removed, ${c.addedLines?.length ?? 0} line(s) added`;
      lines.push(`- **\`${art.path}\`** (text) — ${detail}`);
    } else if (art.type === "binary" && art.comparison) {
      lines.push(
        `- **\`${art.path}\`** (binary) — hash mismatch ` +
        `(${art.comparison.sizeA ?? "?"} → ${art.comparison.sizeB ?? "?"} bytes)`,
      );
    }
  }

  return lines.join("\n");
}

/**
 * Flatten all clusters from all categories, sorted by routeCount descending.
 * Returns the top N.
 *
 * @param {{ byCategory: { [cat: string]: object[] } }} clusters
 * @param {number} topN
 * @returns {Array<{ category: string, cluster: object }>}
 */
function getTopClusters(clusters, topN) {
  const all = [];
  for (const [cat, catClusters] of Object.entries(clusters.byCategory)) {
    for (const cl of catClusters) {
      all.push({ category: cat, cluster: cl });
    }
  }
  all.sort((a, b) => b.cluster.routeCount - a.cluster.routeCount);
  return all.slice(0, topN);
}

/**
 * Render the top-clusters section of the report.
 * @param {{ byCategory: { [cat: string]: object[] } }} clusters
 * @param {number} topN
 * @returns {string}
 */
function renderTopClusters(clusters, topN) {
  const top = getTopClusters(clusters, topN);

  if (top.length === 0) {
    return "_No clusters to display — all routes identical or no findings._";
  }

  const lines = [];

  top.forEach(({ category, cluster }, idx) => {
    const showingOf =
      cluster.sampleRoutes.length < cluster.routeCount
        ? ` (showing ${cluster.sampleRoutes.length} of ${cluster.routeCount})`
        : "";

    lines.push(`### ${idx + 1}. \`${category}\` — ${cluster.description} — ${cluster.routeCount} route(s)\n`);
    lines.push(`**Signature**: \`${cluster.signature}\``);
    lines.push("");
    lines.push(`**Sample routes**${showingOf}:`);
    for (const r of cluster.sampleRoutes) {
      lines.push(`- \`${r}\``);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Render the suggested-issues section.
 * One suggested issue per non-cosmetic cluster, formatted for gh issue create.
 *
 * @param {{ byCategory: { [cat: string]: object[] } }} clusters
 * @param {number} topN
 * @returns {string}
 */
function renderSuggestedIssues(clusters, topN) {
  const top = getTopClusters(clusters, topN);
  const nonCosmetic = top.filter(
    ({ category }) => REGRESSION_CATEGORIES.has(category),
  );

  if (nonCosmetic.length === 0) {
    return "_No non-cosmetic clusters detected — no issues suggested._";
  }

  const lines = [];

  nonCosmetic.forEach(({ category, cluster }, idx) => {
    const title = `[migration-check] ${category}: ${cluster.description} (${cluster.routeCount} route(s))`;
    const sampleStr = cluster.sampleRoutes.slice(0, 3).map((r) => `\`${r}\``).join(", ");
    const body = [
      `**Category**: ${category}`,
      `**Routes affected**: ${cluster.routeCount}`,
      `**Signature**: \`${cluster.signature}\``,
      `**Description**: ${cluster.description}`,
      ``,
      `**Sample routes**: ${sampleStr}${cluster.routeCount > 3 ? ` (and ${cluster.routeCount - 3} more)` : ""}`,
      ``,
      `_Generated by migration-check harness. Review the full report before filing._`,
    ].join("\n");

    lines.push(`### ${idx + 1}. ${title}\n`);
    lines.push("**gh issue create command:**");
    lines.push("");
    lines.push("```");
    lines.push(
      `gh issue create --title "${title.replace(/"/g, '\\"')}" --body $'${body.replace(/'/g, "'\\''")}'`,
    );
    lines.push("```");
    lines.push("");
    lines.push("**Body preview:**");
    lines.push("");
    lines.push(body);
    lines.push("");
    lines.push("---");
    lines.push("");
  });

  return lines.join("\n");
}

// ── LLM-review prompt generation ──────────────────────────────────────────────

/**
 * Write a prompt file for a manual Opus review of ambiguous clusters.
 * Ambiguous = high route count AND category in {structural, meta-changed}.
 *
 * NOTE: This does NOT invoke any agent. It writes a file that a human (or
 * Claude Code user) can open and feed to /codex-review or an Opus session.
 *
 * @param {{ byCategory: { [cat: string]: object[] } }} clusters
 * @param {string} reportPath   Path to the already-written report.md
 * @param {string} promptPath   Where to write the prompt file.
 * @returns {Promise<void>}
 */
async function writeLlmReviewPrompt(clusters, reportPath, promptPath) {
  const AMBIGUOUS_CATEGORIES = new Set(["structural", "meta-changed"]);
  const TOP_N = 10;

  const all = getTopClusters(clusters, Infinity);
  const ambiguous = all
    .filter(({ category }) => AMBIGUOUS_CATEGORIES.has(category))
    .slice(0, TOP_N);

  const lines = [
    "# LLM Review Prompt — Migration Check Ambiguous Clusters",
    "",
    "You are reviewing the results of a static-site migration check. Below are",
    "the most ambiguous clusters (high route count, structural or meta-changed).",
    "For each cluster, answer: **is this a real regression, cosmetic, or needs-human?**",
    "",
    "Answer format per cluster:",
    "  - `real-regression` — functional or SEO impact, should be filed as an issue",
    "  - `cosmetic` — visual-only change, no functional or SEO impact",
    "  - `needs-human` — unclear from hashes alone, manual page inspection required",
    "",
    "---",
    "",
    `Full report is at: ${reportPath}`,
    "",
    "---",
    "",
    "## Clusters to Review",
    "",
  ];

  if (ambiguous.length === 0) {
    lines.push("_No ambiguous clusters found._");
  } else {
    ambiguous.forEach(({ category, cluster }, idx) => {
      lines.push(`### ${idx + 1}. \`${category}\` — ${cluster.description} — ${cluster.routeCount} route(s)`);
      lines.push("");
      lines.push(`**Signature**: \`${cluster.signature}\``);
      lines.push("");
      lines.push("**Sample routes**:");
      for (const r of cluster.sampleRoutes) {
        lines.push(`- \`${r}\``);
      }
      lines.push("");
      lines.push("**Your verdict**: [ real-regression | cosmetic | needs-human ]");
      lines.push("");
      lines.push("---");
      lines.push("");
    });
  }

  await mkdir(dirname(promptPath), { recursive: true });
  await writeFile(promptPath, lines.join("\n") + "\n");
}

// ── Core aggregation function ─────────────────────────────────────────────────

/**
 * Read all findings, cluster them, and write report.md.
 *
 * @param {object} opts
 * @param {string}  opts.findingsDir   Absolute path to the findings directory.
 * @param {string}  opts.reportPath    Absolute path for the output report.md.
 * @param {boolean} [opts.llmReview]   If true, also write llm-review-prompt.md.
 * @returns {Promise<void>}
 */
export async function aggregate({ findingsDir, reportPath, llmReview = false }) {
  // Derive workspace dir from findingsDir (parent directory relationship is fixed by config)
  const workspaceDir = dirname(findingsDir);
  const routesJsonPath = join(workspaceDir, "routes.json");
  const artifactsJsonPath = join(workspaceDir, "artifacts.json");

  console.log("[S7] aggregate.mjs starting");
  console.log(`[S7]   findings-dir : ${findingsDir}`);
  console.log(`[S7]   report-path  : ${reportPath}`);
  console.log(`[S7]   llm-review   : ${llmReview}`);

  // ── 1. Read all batch-*.json (summary, not detailed) ───────────────────────

  let batchFiles = [];
  try {
    const entries = await readdir(findingsDir);
    batchFiles = entries
      .filter((f) => /^batch-\d{4}\.json$/.test(f))
      .map((f) => join(findingsDir, f));
  } catch {
    console.warn(`[S7] findings dir not found or empty: ${findingsDir}`);
  }

  /** @type {import("./lib/cluster-findings.mjs").Finding[]} */
  const allFindings = [];

  for (const filePath of batchFiles) {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.routes)) {
        allFindings.push(...parsed.routes);
      }
    } catch (err) {
      console.warn(`[S7] skipping ${basename(filePath)}: ${err.message}`);
    }
  }

  console.log(`[S7] loaded ${allFindings.length} findings from ${batchFiles.length} batch file(s)`);

  // ── 2. Read routes.json (symmetric-difference data) ───────────────────────

  let routesData = { onlyInA: [], onlyInB: [] };
  if (existsSync(routesJsonPath)) {
    try {
      routesData = JSON.parse(await readFile(routesJsonPath, "utf8"));
    } catch (err) {
      console.warn(`[S7] could not read routes.json: ${err.message}`);
    }
  } else {
    console.warn("[S7] routes.json not found — symmetric-diff section will be empty");
  }

  // ── 3. Read artifacts.json ─────────────────────────────────────────────────

  let artifactsData = null;
  if (existsSync(artifactsJsonPath)) {
    try {
      artifactsData = JSON.parse(await readFile(artifactsJsonPath, "utf8"));
    } catch (err) {
      console.warn(`[S7] could not read artifacts.json: ${err.message}`);
    }
  } else {
    console.warn("[S7] artifacts.json not found — artifact section will be empty");
  }

  // ── 4. Cluster findings ────────────────────────────────────────────────────

  const clusters = clusterFindings(allFindings);

  // ── 5. Build summary counts ────────────────────────────────────────────────

  /** @type {{ [cat: string]: number }} */
  const counts = {};
  for (const finding of allFindings) {
    counts[finding.category] = (counts[finding.category] ?? 0) + 1;
  }

  // ── 6. Render report.md ────────────────────────────────────────────────────

  const TOP_CLUSTERS = 20;

  const report = [
    "# Migration Check Report",
    "",
    `**Generated**: ${new Date().toISOString()}`,
    `**Findings files**: ${batchFiles.length} batch file(s), ${allFindings.length} route(s) total`,
    "",
    "---",
    "",
    "## Summary",
    "",
    renderSummaryTable(counts),
    "",
    "---",
    "",
    "## Symmetric-Difference Routes",
    "",
    "Routes present in one site but not the other (likely added or removed pages).",
    "",
    renderSymmetricDiff(routesData.onlyInA ?? [], routesData.onlyInB ?? []),
    "",
    "---",
    "",
    "## Non-HTML Artifact Diffs",
    "",
    renderArtifactDiffs(artifactsData),
    "",
    "---",
    "",
    `## Top Clusters (top ${TOP_CLUSTERS} by route count)`,
    "",
    "Routes with identical diff signatures are grouped together.",
    `Cluster sample size is capped at ${SAMPLE_SIZE} representative routes.`,
    "",
    renderTopClusters(clusters, TOP_CLUSTERS),
    "",
    "---",
    "",
    "## Suggested Issues",
    "",
    "One entry per non-cosmetic cluster. Copy the `gh issue create` command to file a tracking issue.",
    "",
    renderSuggestedIssues(clusters, TOP_CLUSTERS),
    "",
  ].join("\n");

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, report);

  console.log(`[S7] report written to ${reportPath}`);

  // ── 7. LLM review prompt (optional) ───────────────────────────────────────

  if (llmReview) {
    const promptPath = join(workspaceDir, "llm-review-prompt.md");
    await writeLlmReviewPrompt(clusters, reportPath, promptPath);

    console.log("");
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║  LLM REVIEW — manual step required                          ║");
    console.log("║                                                              ║");
    console.log(`║  Prompt written to:                                          ║`);
    console.log(`║    ${promptPath.slice(-54).padEnd(54)} ║`);
    console.log("║                                                              ║");
    console.log("║  To complete the LLM review, run one of:                     ║");
    console.log("║    /codex-review (in Claude Code)                            ║");
    console.log("║    paste prompt into an Opus session manually                ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log("");
    console.log(
      "[S7] NOTE: programmatic agent invocation from Node.js is not supported.\n" +
      "[S7]       The --llm-review flag writes a prompt file for manual use.\n" +
      "[S7]       Full programmatic Opus invocation is out of scope here.",
    );
  }

  // ── 8. Print brief summary ────────────────────────────────────────────────

  const nonIdenticalCount = allFindings.filter((f) => f.category !== "identical").length;
  const regressionCount = allFindings.filter(
    (f) => REGRESSION_CATEGORIES.has(f.category),
  ).length;

  console.log("");
  console.log("[S7] ── Aggregate summary ──────────────────────────────────────");
  console.log(`[S7]   total routes      : ${allFindings.length}`);
  console.log(`[S7]   non-identical     : ${nonIdenticalCount}`);
  console.log(`[S7]   regression-class  : ${regressionCount}`);
  console.log(
    `[S7]   clusters (non-id) : ${Object.values(clusters.byCategory).flat().length}`,
  );
  console.log(`[S7]   report            : ${reportPath}`);
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {
    findingsDir: resolve(REPO_ROOT, config.findingsDir),
    reportPath: resolve(REPO_ROOT, config.reportPath),
    llmReview: false,
  };

  for (const arg of argv) {
    if (arg.startsWith("--findings-dir=")) {
      opts.findingsDir = resolve(arg.slice("--findings-dir=".length));
    } else if (arg.startsWith("--report-path=")) {
      opts.reportPath = resolve(arg.slice("--report-path=".length));
    } else if (arg === "--llm-review") {
      opts.llmReview = true;
    }
  }

  return opts;
}

// Run only when invoked directly — not when imported as a module by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  aggregate(opts).catch((err) => {
    console.error("[S7] fatal:", err?.message ?? err);
    process.exit(1);
  });
}
