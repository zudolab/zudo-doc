#!/usr/bin/env node
/**
 * phase-a-scan.mjs — Phase A investigation: systematic content-loss analysis.
 *
 * Loads all batch-*-detailed.json findings with category === "content-loss",
 * derives which of the three hasContentLoss predicates fired for each route,
 * aggregates counts, and writes results to:
 *   .l-zfb-migration-check/findings/manual/phase-a-scan-results.json
 *   .l-zfb-migration-check/findings/manual/phase-a-scan-results.txt
 *
 * Usage:
 *   node scripts/migration-check/lib/dev/phase-a-scan.mjs
 *
 * Predicates (from compare-routes.mjs:91):
 *   text-shrink   — b.visibleText.length < a.visibleText.length * 0.95
 *   heading-removed — at least one heading text from A absent in B
 *   landmark-removed — at least one landmark role from A absent in B
 */

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Root of the worktree (4 levels up from scripts/migration-check/lib/dev/)
const ROOT = resolve(__dirname, "../../../../");
const FINDINGS_DIR = join(ROOT, ".l-zfb-migration-check/findings");
const MANUAL_DIR = join(FINDINGS_DIR, "manual");
const SNAPSHOTS_DIR = join(ROOT, ".l-zfb-migration-check/snapshots");

// ── Helpers: visible text extraction (mirrors extract-signals.mjs) ─────────────

function extractVisibleText(html) {
  return html
    .replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convert a route path like "/docs/getting-started/installation" or "/"
 * to the snapshot HTML file path for a given side ("a" or "b").
 */
function routeToSnapshotPath(route, side) {
  // Normalize: strip leading slash, then append /index.html
  const rel = route.replace(/^\//, "");
  if (rel === "") {
    return join(SNAPSHOTS_DIR, side, "index.html");
  }
  return join(SNAPSHOTS_DIR, side, rel, "index.html");
}

/**
 * Read the snapshot HTML file for a route and return visible text.
 * Returns null if the file doesn't exist.
 */
async function readVisibleText(route, side) {
  const path = routeToSnapshotPath(route, side);
  if (!existsSync(path)) return null;
  const html = await readFile(path, "utf8");
  return extractVisibleText(html);
}

// ── Predicate derivation ────────────────────────────────────────────────────────

/**
 * From the diff data (headings.a, headings.b, landmarks.a, landmarks.b) plus
 * visible text lengths, determine which content-loss predicates fired.
 *
 * Returns { textShrink, headingRemoved, landmarkRemoved, missingHeadings, missingRoles, shrinkRatio }
 */
function deriveFiredPredicates(diff, visibleTextA, visibleTextB) {
  const result = {
    textShrink: false,
    headingRemoved: false,
    landmarkRemoved: false,
    missingHeadings: [],
    missingRoles: [],
    shrinkRatio: null,
  };

  // text-shrink predicate
  if (
    visibleTextA !== null &&
    visibleTextB !== null &&
    visibleTextA.length > 0 &&
    visibleTextB.length < visibleTextA.length * 0.95
  ) {
    result.textShrink = true;
    result.shrinkRatio = 1 - visibleTextB.length / visibleTextA.length;
  }

  // heading-removed predicate: check by text only (level changes are not content-loss)
  if (diff?.headings) {
    const aHeadings = diff.headings.a ?? [];
    const bHeadings = diff.headings.b ?? [];
    const bHeadingTexts = new Set(bHeadings.map(([, t]) => t));
    for (const [, t] of aHeadings) {
      if (!bHeadingTexts.has(t)) {
        result.headingRemoved = true;
        result.missingHeadings.push(t);
      }
    }
  }

  // landmark-removed predicate: check that every role in A still exists in B
  if (diff?.landmarks) {
    const aLandmarks = diff.landmarks.a ?? [];
    const bLandmarks = diff.landmarks.b ?? [];
    const bRoles = new Set(bLandmarks.map(([r]) => r));
    for (const [r] of aLandmarks) {
      if (!bRoles.has(r)) {
        result.landmarkRemoved = true;
        result.missingRoles.push(r);
      }
    }
  }

  return result;
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Phase A scan — loading all batch detailed JSON files...");

  // Collect all content-loss routes from all batch files
  const contentLossRoutes = [];

  for (let i = 0; i <= 9; i++) {
    const batchId = String(i).padStart(4, "0");
    const path = join(FINDINGS_DIR, `batch-${batchId}-detailed.json`);
    if (!existsSync(path)) continue;

    const data = JSON.parse(await readFile(path, "utf8"));
    for (const route of data.routes) {
      if (route.category === "content-loss") {
        contentLossRoutes.push(route);
      }
    }
  }

  console.log(`Loaded ${contentLossRoutes.length} content-loss routes.`);
  console.log("Reading snapshot HTML files to derive visible text...");

  // Aggregate counters
  let textShrinkCount = 0;
  let headingRemovedCount = 0;
  let landmarkRemovedCount = 0;

  // Distribution tracking
  const missingHeadingsFreq = {}; // heading text → count
  const missingRolesFreq = {}; // role → count
  const shrinkBins = {
    "5-10%": 0,
    "10-25%": 0,
    "25-50%": 0,
    "50%+": 0,
  };

  // Per-route details (for JSON output)
  const routeDetails = [];

  for (const route of contentLossRoutes) {
    const visibleTextA = await readVisibleText(route.route, "a");
    const visibleTextB = await readVisibleText(route.route, "b");

    const predicates = deriveFiredPredicates(
      route.diff,
      visibleTextA,
      visibleTextB,
    );

    if (predicates.textShrink) {
      textShrinkCount++;
      // Bin the shrink ratio
      const r = predicates.shrinkRatio;
      if (r >= 0.5) shrinkBins["50%+"]++;
      else if (r >= 0.25) shrinkBins["25-50%"]++;
      else if (r >= 0.1) shrinkBins["10-25%"]++;
      else shrinkBins["5-10%"]++;
    }

    if (predicates.headingRemoved) {
      headingRemovedCount++;
      for (const h of predicates.missingHeadings) {
        missingHeadingsFreq[h] = (missingHeadingsFreq[h] ?? 0) + 1;
      }
    }

    if (predicates.landmarkRemoved) {
      landmarkRemovedCount++;
      for (const role of predicates.missingRoles) {
        missingRolesFreq[role] = (missingRolesFreq[role] ?? 0) + 1;
      }
    }

    // Note: a route can fire multiple predicates
    routeDetails.push({
      route: route.route,
      textShrink: predicates.textShrink,
      shrinkRatio: predicates.shrinkRatio
        ? Math.round(predicates.shrinkRatio * 1000) / 1000
        : null,
      visibleTextLenA: visibleTextA?.length ?? null,
      visibleTextLenB: visibleTextB?.length ?? null,
      headingRemoved: predicates.headingRemoved,
      missingHeadings: predicates.missingHeadings,
      landmarkRemoved: predicates.landmarkRemoved,
      missingRoles: predicates.missingRoles,
    });
  }

  // Top 10 most-frequent missing heading strings
  const top10Headings = Object.entries(missingHeadingsFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Full distribution of missing roles
  const roleDistribution = Object.entries(missingRolesFreq).sort(
    (a, b) => b[1] - a[1],
  );

  // Routes that fired NO predicate (data integrity check — should be 0 if all
  // content-loss routes trigger at least one predicate)
  const noPredicate = routeDetails.filter(
    (r) => !r.textShrink && !r.headingRemoved && !r.landmarkRemoved,
  );

  // Routes with only text-shrink (no heading or landmark)
  const onlyTextShrink = routeDetails.filter(
    (r) => r.textShrink && !r.headingRemoved && !r.landmarkRemoved,
  );

  // Compile full results object
  const results = {
    generatedAt: new Date().toISOString(),
    totalContentLossRoutes: contentLossRoutes.length,
    predicateCounts: {
      textShrink: textShrinkCount,
      headingRemoved: headingRemovedCount,
      landmarkRemoved: landmarkRemovedCount,
      noPredicate: noPredicate.length,
    },
    textShrinkBins: shrinkBins,
    top10MissingHeadings: top10Headings.map(([text, count]) => ({
      text,
      count,
    })),
    missingLandmarkRoleDistribution: roleDistribution.map(([role, count]) => ({
      role,
      count,
    })),
    routeDetails,
  };

  // Ensure output directory exists
  await mkdir(MANUAL_DIR, { recursive: true });

  // Write JSON sidecar
  const jsonPath = join(MANUAL_DIR, "phase-a-scan-results.json");
  await writeFile(jsonPath, JSON.stringify(results, null, 2) + "\n");
  console.log(`\nJSON results written to: ${jsonPath}`);

  // Build human-readable text report
  const lines = [];
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("Phase A Scan Results — Content-Loss Predicate Tally");
  lines.push(`Generated: ${results.generatedAt}`);
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`Total content-loss routes: ${results.totalContentLossRoutes}`);
  lines.push("");
  lines.push("── Three-Predicate Counts ──────────────────────────────────────");
  lines.push(`  text-shrink      : ${textShrinkCount} routes`);
  lines.push(`  heading-removed  : ${headingRemovedCount} routes`);
  lines.push(`  landmark-removed : ${landmarkRemovedCount} routes`);
  lines.push(`  no-predicate     : ${noPredicate.length} routes (data check)`);
  lines.push("");
  lines.push("Note: a single route can fire multiple predicates.");
  lines.push("");
  lines.push("── Text-Shrink Distribution (bin edges: 5%, 10%, 25%, 50%) ─────");
  lines.push(`  5–10%  : ${shrinkBins["5-10%"]} routes`);
  lines.push(`  10–25% : ${shrinkBins["10-25%"]} routes`);
  lines.push(`  25–50% : ${shrinkBins["25-50%"]} routes`);
  lines.push(`  50%+   : ${shrinkBins["50%+"]} routes`);
  lines.push("");
  lines.push("── Top 10 Missing Heading Strings ──────────────────────────────");
  if (top10Headings.length === 0) {
    lines.push("  (none)");
  } else {
    for (const [text, count] of top10Headings) {
      const truncated = text.length > 60 ? text.slice(0, 57) + "..." : text;
      lines.push(`  ${count}x  "${truncated}"`);
    }
  }
  lines.push("");
  lines.push("── Missing Landmark Role Distribution ──────────────────────────");
  if (roleDistribution.length === 0) {
    lines.push("  (none)");
  } else {
    for (const [role, count] of roleDistribution) {
      lines.push(`  ${count}x  ${role}`);
    }
  }
  lines.push("");
  lines.push("── Routes With No Predicate Fired (should be 0) ────────────────");
  if (noPredicate.length === 0) {
    lines.push("  (none — all content-loss routes fire at least one predicate)");
  } else {
    for (const r of noPredicate) {
      lines.push(`  ${r.route}`);
    }
  }
  lines.push("");
  lines.push("── Only-Text-Shrink Routes (no heading/landmark loss) ───────────");
  lines.push(`  Count: ${onlyTextShrink.length}`);
  if (onlyTextShrink.length > 0 && onlyTextShrink.length <= 20) {
    for (const r of onlyTextShrink) {
      lines.push(
        `    ${r.route}  (ratio: ${r.shrinkRatio?.toFixed(3) ?? "N/A"})`,
      );
    }
  }
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════");

  const txtContent = lines.join("\n") + "\n";
  const txtPath = join(MANUAL_DIR, "phase-a-scan-results.txt");
  await writeFile(txtPath, txtContent);
  console.log(`Text results written to:  ${txtPath}`);

  // Print tally to stdout
  console.log("\n" + txtContent);
}

main().catch((err) => {
  console.error("phase-a-scan.mjs fatal:", err?.message ?? err);
  process.exit(1);
});
