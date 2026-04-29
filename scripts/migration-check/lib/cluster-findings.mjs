/**
 * cluster-findings.mjs — pure function for clustering route comparison findings.
 *
 * Groups findings (route entries from batch-*.json files) by category, then
 * sub-clusters within each category by a signature derived from the change
 * pattern. Sample size per cluster is capped at SAMPLE_SIZE routes.
 *
 * This module is intentionally side-effect-free (no I/O) so it can be
 * unit-tested with synthetic data without touching disk or network.
 */

/** Maximum representative routes stored per cluster. */
export const SAMPLE_SIZE = 5;

/**
 * Categories that are omitted from cluster output because they are handled
 * separately in the report (symmetric-difference section and stats only).
 */
const SKIP_CATEGORIES = new Set(["identical", "route-only-in-a", "route-only-in-b"]);

/**
 * Non-cosmetic categories that indicate real regressions.
 * Used by callers to decide which clusters merit filed issues.
 */
export const REGRESSION_CATEGORIES = new Set([
  "structural",
  "meta-changed",
  "content-loss",
  "asset-loss",
  "link-changed",
]);

// ── Signature derivation ──────────────────────────────────────────────────────

/**
 * Derive a clustering signature for a finding within its category.
 * Findings that share a signature are grouped into the same cluster.
 *
 * Strategy per category:
 *   structural   — DOM-shape-hash pair (same A→B transition = same shape change)
 *   meta-changed — subCategory (which meta field type changed)
 *   content-loss — diffSummaryHash (same hash = identical change pattern)
 *   asset-loss   — diffSummaryHash
 *   link-changed — diffSummaryHash
 *   cosmetic-only — fixed "cosmetic" key (all cosmetics in one cluster)
 *   error        — leading 60 chars of error message (rough dedup)
 *   default      — diffSummaryHash or "unknown"
 *
 * @param {object} finding
 * @returns {string}
 */
export function getClusterSignature(finding) {
  const { category, subCategory, signals = {}, diffSummaryHash, error } = finding;

  switch (category) {
    case "structural":
      // Routes whose domShapeHash changed in the exact same way share a cluster.
      return `${signals.domShapeHashA ?? "?"}::${signals.domShapeHashB ?? "?"}`;

    case "meta-changed":
      // Each meta sub-type (canonical-changed, og-changed, …) is its own cluster.
      return subCategory ?? "unknown-meta";

    case "content-loss":
    case "asset-loss":
    case "link-changed":
      // Identical diffSummaryHash ⇒ identical change pattern.
      return diffSummaryHash ?? "unknown-hash";

    case "cosmetic-only":
      // One cluster for all cosmetic routes.
      return "cosmetic";

    case "error":
      // Group by leading error text as a rough deduplicate key.
      return (error ?? "unknown-error").slice(0, 60);

    default:
      return diffSummaryHash ?? "unknown";
  }
}

// ── Human-readable cluster description ───────────────────────────────────────

/**
 * Build a short human-readable description for a cluster.
 *
 * @param {string} category
 * @param {string} signature
 * @returns {string}
 */
export function describeCluster(category, signature) {
  switch (category) {
    case "structural": {
      const [hashA, hashB] = signature.split("::");
      return `DOM shape changed (A: ${(hashA ?? "?").slice(0, 8)}… → B: ${(hashB ?? "?").slice(0, 8)}…)`;
    }

    case "meta-changed":
      return `Meta tag changed: ${signature}`;

    case "content-loss":
      return `Content loss (pattern: ${signature.slice(0, 16)}…)`;

    case "asset-loss":
      return `Asset removed or path changed (pattern: ${signature.slice(0, 16)}…)`;

    case "link-changed":
      return `Link targets changed (pattern: ${signature.slice(0, 16)}…)`;

    case "cosmetic-only":
      return "Minor cosmetic changes only";

    case "error":
      return `Comparison error: ${signature}`;

    default:
      return `${category} (signature: ${signature.slice(0, 24)})`;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * @typedef {object} Finding
 * @property {string}      route
 * @property {string}      category
 * @property {string|null} subCategory
 * @property {object}      [signals]
 * @property {string|null} [diffSummaryHash]
 * @property {string}      [error]
 */

/**
 * @typedef {object} Cluster
 * @property {string}   signature     Deduplication key for this cluster.
 * @property {string}   description   Human-readable summary.
 * @property {number}   routeCount    Total routes in this cluster.
 * @property {string[]} sampleRoutes  Up to SAMPLE_SIZE representative routes.
 */

/**
 * @typedef {object} Clusters
 * @property {{ [category: string]: Cluster[] }} byCategory
 */

/**
 * Cluster an array of findings by category and signature.
 *
 * - Skips identical, route-only-in-a, and route-only-in-b (handled separately).
 * - Within each category, clusters are sorted by routeCount descending.
 * - Sample routes are capped at SAMPLE_SIZE.
 *
 * @param {Finding[]} findings  Union of all batch-*.json route entries.
 * @returns {Clusters}
 */
export function clusterFindings(findings) {
  // category → signature → Finding[]
  /** @type {Map<string, Map<string, Finding[]>>} */
  const byCatSig = new Map();

  for (const finding of findings) {
    if (SKIP_CATEGORIES.has(finding.category)) continue;

    const cat = finding.category;
    if (!byCatSig.has(cat)) byCatSig.set(cat, new Map());
    const sigMap = byCatSig.get(cat);

    const sig = getClusterSignature(finding);
    if (!sigMap.has(sig)) sigMap.set(sig, []);
    sigMap.get(sig).push(finding);
  }

  /** @type {{ [category: string]: Cluster[] }} */
  const byCategory = {};

  for (const [cat, sigMap] of byCatSig) {
    /** @type {Cluster[]} */
    const clusters = [];

    for (const [sig, sigFindings] of sigMap) {
      clusters.push({
        signature: sig,
        description: describeCluster(cat, sig),
        routeCount: sigFindings.length,
        sampleRoutes: sigFindings.slice(0, SAMPLE_SIZE).map((f) => f.route),
      });
    }

    // Largest clusters first
    clusters.sort((a, b) => b.routeCount - a.routeCount);
    byCategory[cat] = clusters;
  }

  return { byCategory };
}
