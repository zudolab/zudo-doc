#!/usr/bin/env node
/**
 * compare-routes.mjs — batch route comparison CLI (S5b).
 *
 * Fetches a batch of routes from two live servers, normalizes and extracts
 * signals from each page, categorizes each route, and writes findings JSON.
 *
 * Usage:
 *   node compare-routes.mjs \
 *     --routes-file=<json> \
 *     --base-a=<url> \
 *     --base-b=<url> \
 *     --batch-id=<id> \
 *     --out-dir=<dir> \
 *     --site-prefix=<str>
 *
 * Output files:
 *   <out-dir>/batch-<batch-id>.json           Summary (hashes only per route)
 *   <out-dir>/batch-<batch-id>-detailed.json  Detailed diff (capped at 50 KB total)
 *
 * Exit code: 0 on completion, non-zero only on hard failures (process crash,
 * can't write output). Per-route errors are recorded as category "error".
 */

import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeHtml } from "./lib/normalize-html.mjs";
import { extractSignals } from "./lib/extract-signals.mjs";
import { maybeStripHiddenSidebar } from "./lib/strip-hidden-sidebar.mjs";
import { maybeStripVersionSwitcher } from "./lib/strip-version-switcher.mjs";
import * as config from "./config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Hashing ───────────────────────────────────────────────────────────────────

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// ── Signal comparison helpers ─────────────────────────────────────────────────

/**
 * Deep-compare two arrays where each element may be an array or primitive.
 */
function arraysDeepEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => JSON.stringify(v) === JSON.stringify(b[i]));
}

/**
 * Compare two arrays as unordered sets (each element is a primitive string).
 */
function setsEqual(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const v of sa) {
    if (!sb.has(v)) return false;
  }
  return true;
}

/**
 * True iff every signal field in a matches b.
 */
function signalsIdentical(a, b) {
  return (
    a.domShapeHash === b.domShapeHash &&
    a.textHash === b.textHash &&
    arraysDeepEqual(a.headings, b.headings) &&
    arraysDeepEqual(a.metaTags, b.metaTags) &&
    a.canonicalUrl === b.canonicalUrl &&
    JSON.stringify(a.jsonLd) === JSON.stringify(b.jsonLd) &&
    setsEqual(a.rssLinks, b.rssLinks) &&
    arraysDeepEqual(a.linkTargets, b.linkTargets) &&
    setsEqual(a.assetRefs, b.assetRefs) &&
    setsEqual(a.scriptInventory, b.scriptInventory) &&
    arraysDeepEqual(a.landmarks, b.landmarks)
  );
}

/**
 * True iff B has lost visible content relative to A:
 *   - visibleText shrunk by >5%
 *   - a heading present in A is absent in B
 *   - a landmark role present in A is absent in B
 */
function hasContentLoss(a, b) {
  // Text shrinkage
  if (
    a.visibleText.length > 0 &&
    b.visibleText.length < a.visibleText.length * 0.95
  ) {
    return true;
  }

  // Heading removal — check by text only (level changes are structural, not content-loss).
  // If a heading text present in A is absent from B at ANY level, it was removed.
  const bHeadingTexts = new Set(b.headings.map(([, t]) => t));
  for (const [, t] of a.headings) {
    if (!bHeadingTexts.has(t)) return true;
  }

  // Landmark role removal (checks that every role in A still exists in B)
  const bRoles = new Set(b.landmarks.map(([r]) => r));
  for (const [r] of a.landmarks) {
    if (!bRoles.has(r)) return true;
  }

  return false;
}

/**
 * True iff B is missing asset or script entries that A had.
 * Additions in B are not considered a loss.
 */
function hasAssetLoss(a, b) {
  const bAssets = new Set(b.assetRefs);
  for (const ref of a.assetRefs) {
    if (!bAssets.has(ref)) return true;
  }

  const bScripts = new Set(b.scriptInventory);
  for (const src of a.scriptInventory) {
    if (!bScripts.has(src)) return true;
  }

  return false;
}

/**
 * Determine the meta-changed sub-category.
 *
 * Precedence (first detected wins):
 *   canonical-changed > og-changed > twitter-changed > seo-meta-changed > jsonld-changed
 *
 * Rationale: canonical URL is the most critical for SEO de-duplication;
 * OG/Twitter cards affect link previews; description/keywords affect search;
 * JSON-LD is structured data that search engines parse but users don't see.
 *
 * @returns {string|null} sub-category key, or null if meta is unchanged.
 */
function getMetaChangedSubCategory(a, b) {
  // Canonical URL
  if (a.canonicalUrl !== b.canonicalUrl) return "canonical-changed";

  // OpenGraph (og:*)
  const aOg = a.metaTags.filter(([k]) => k.startsWith("og:"));
  const bOg = b.metaTags.filter(([k]) => k.startsWith("og:"));
  if (JSON.stringify(aOg) !== JSON.stringify(bOg)) return "og-changed";

  // Twitter cards (twitter:*)
  const aTwitter = a.metaTags.filter(([k]) => k.startsWith("twitter:"));
  const bTwitter = b.metaTags.filter(([k]) => k.startsWith("twitter:"));
  if (JSON.stringify(aTwitter) !== JSON.stringify(bTwitter))
    return "twitter-changed";

  // Standard SEO meta: description, keywords, robots, author
  const SEO_KEYS = new Set(["description", "keywords", "robots", "author"]);
  const aSeo = a.metaTags.filter(([k]) => SEO_KEYS.has(k));
  const bSeo = b.metaTags.filter(([k]) => SEO_KEYS.has(k));
  if (JSON.stringify(aSeo) !== JSON.stringify(bSeo)) return "seo-meta-changed";

  // JSON-LD
  if (JSON.stringify(a.jsonLd) !== JSON.stringify(b.jsonLd))
    return "jsonld-changed";

  // Other meta tag changes (any remaining meta tags)
  if (JSON.stringify(a.metaTags) !== JSON.stringify(b.metaTags))
    return "seo-meta-changed";

  return null;
}

// ── Core categorizer (pure function) ─────────────────────────────────────────

/**
 * Categorize a route by comparing two Signals objects.
 *
 * Category precedence (most severe first):
 *   identical > cosmetic-only > content-loss > asset-loss >
 *   meta-changed > link-changed > structural > frontmatter-drift
 *
 * @param {object} sigA  Signals from normalized HTML of site A.
 * @param {object} sigB  Signals from normalized HTML of site B.
 * @returns {{ category: string, subCategory: string|null }}
 */
export function categorizeSignals(sigA, sigB) {
  // 1. Identical — all signals match
  if (signalsIdentical(sigA, sigB)) {
    return { category: "identical", subCategory: null };
  }

  // 2. Content-loss — most visible regression; check before structure
  if (hasContentLoss(sigA, sigB)) {
    return { category: "content-loss", subCategory: null };
  }

  // 3. Asset-loss — functional regression (scripts/assets missing)
  if (hasAssetLoss(sigA, sigB)) {
    return { category: "asset-loss", subCategory: null };
  }

  // 4. Meta-changed — SEO/meta regression (includes canonical + jsonLd)
  const metaSub = getMetaChangedSubCategory(sigA, sigB);
  if (metaSub) {
    return { category: "meta-changed", subCategory: metaSub };
  }

  // 5. Link-changed — navigation/href regression
  if (!arraysDeepEqual(sigA.linkTargets, sigB.linkTargets)) {
    return { category: "link-changed", subCategory: null };
  }

  // 6. Structural — DOM shape changed but all content signals are unchanged
  if (sigA.domShapeHash !== sigB.domShapeHash) {
    return { category: "structural", subCategory: null };
  }

  // 7. Frontmatter-drift (low-confidence heuristic) — skip for now
  // TODO: detect draft/unlisted/sidebar_position-driven changes from HTML structure

  // 8. Cosmetic-only — normalized signals match on structure/content; minor diff
  return { category: "cosmetic-only", subCategory: null };
}

// ── HTTP fetch with timeout ────────────────────────────────────────────────────

/**
 * Fetch a URL with a timeout, returning { ok, status, text }.
 * Never throws — returns { ok: false, status: 0, text: '' } on network error.
 *
 * @param {string} url
 * @param {number} timeoutMs  Default 10 seconds.
 * @returns {Promise<{ ok: boolean, status: number, text: string }>}
 */
async function fetchWithTimeout(url, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    // AbortError (timeout) or network failure
    return { ok: false, status: 0, text: String(err?.message ?? err) };
  } finally {
    clearTimeout(timer);
  }
}

// ── Per-route comparison ───────────────────────────────────────────────────────

/**
 * Build the signals-hashes-only object for the summary JSON.
 * We store hashes from BOTH sides so the caller can tell which side changed.
 *
 * @param {object} sigA
 * @param {object} sigB
 */
function buildSignalHashes(sigA, sigB) {
  return {
    domShapeHashA: sigA.domShapeHash,
    domShapeHashB: sigB.domShapeHash,
    textHashA: sigA.textHash,
    textHashB: sigB.textHash,
  };
}

/**
 * Build a compact diff summary (for diffSummaryHash computation and detailed JSON).
 * Omits visibleText bodies (can be large) but includes all hashes and arrays.
 */
function buildDiffSummary(sigA, sigB) {
  return {
    domShapeHash: { a: sigA.domShapeHash, b: sigB.domShapeHash },
    textHash: { a: sigA.textHash, b: sigB.textHash },
    headings: { a: sigA.headings, b: sigB.headings },
    metaTags: { a: sigA.metaTags, b: sigB.metaTags },
    canonicalUrl: { a: sigA.canonicalUrl, b: sigB.canonicalUrl },
    jsonLd: { a: sigA.jsonLd, b: sigB.jsonLd },
    rssLinks: { a: sigA.rssLinks, b: sigB.rssLinks },
    linkTargets: { a: sigA.linkTargets, b: sigB.linkTargets },
    assetRefs: { a: sigA.assetRefs, b: sigB.assetRefs },
    scriptInventory: { a: sigA.scriptInventory, b: sigB.scriptInventory },
    landmarks: { a: sigA.landmarks, b: sigB.landmarks },
  };
}

/**
 * Compare a single route against two base URLs.
 * Fetches both sides concurrently.
 *
 * @param {object} opts
 * @param {string}  opts.route
 * @param {string}  opts.baseA
 * @param {string}  opts.baseB
 * @param {string}  opts.sitePrefix
 * @returns {Promise<object>}  Route finding entry for the summary JSON.
 */
async function compareRoute({ route, baseA, baseB, sitePrefix }) {
  const urlA = `${baseA}${route}`;
  const urlB = `${baseB}${route}`;

  // Fetch both sides concurrently (per-route; sequential across routes for memory)
  const [fetchA, fetchB] = await Promise.all([
    fetchWithTimeout(urlA),
    fetchWithTimeout(urlB),
  ]);

  // Non-2xx → error
  if (!fetchA.ok) {
    return {
      route,
      category: "error",
      subCategory: null,
      signals: {},
      diffSummaryHash: null,
      error: `site-a HTTP ${fetchA.status}: ${fetchA.text.slice(0, 200)}`,
    };
  }
  if (!fetchB.ok) {
    return {
      route,
      category: "error",
      subCategory: null,
      signals: {},
      diffSummaryHash: null,
      error: `site-b HTTP ${fetchB.status}: ${fetchB.text.slice(0, 200)}`,
    };
  }

  // Normalize and extract signals.
  // Strip passes run after normalizeHtml so class attributes are sorted/normalised
  // before detection fires. Stripping is symmetric (both A and B) so the
  // stripped content falls out of the diff entirely.
  //   1. maybeStripHiddenSidebar — removes sr-only / mobile-drawer sidebar asides
  //      (see lib/strip-hidden-sidebar.mjs for rationale).
  //   2. maybeStripVersionSwitcher — removes the inline version-switcher div
  //      (see lib/strip-version-switcher.mjs for rationale).
  let sigA, sigB;
  try {
    const normA = maybeStripVersionSwitcher(
      maybeStripHiddenSidebar(
        normalizeHtml(fetchA.text, { sitePrefix }),
        config.stripHiddenSidebarDom,
      ),
      config.stripVersionSwitcherDom,
    );
    const normB = maybeStripVersionSwitcher(
      maybeStripHiddenSidebar(
        normalizeHtml(fetchB.text, { sitePrefix }),
        config.stripHiddenSidebarDom,
      ),
      config.stripVersionSwitcherDom,
    );
    sigA = extractSignals(normA);
    sigB = extractSignals(normB);
  } catch (err) {
    return {
      route,
      category: "error",
      subCategory: null,
      signals: {},
      diffSummaryHash: null,
      error: `parse failure: ${err?.message ?? err}`,
    };
  }

  // Categorize
  const { category, subCategory } = categorizeSignals(sigA, sigB);

  // Identical routes: no signal hashes or diff summary needed
  if (category === "identical") {
    return {
      route,
      category,
      subCategory,
      signals: {},
      diffSummaryHash: null,
    };
  }

  // Build signal hashes and diff summary for non-identical routes
  const signalHashes = buildSignalHashes(sigA, sigB);
  const diffSummary = buildDiffSummary(sigA, sigB);
  const diffSummaryHash = sha256(
    JSON.stringify({ category, subCategory, ...signalHashes }),
  );

  return {
    route,
    category,
    subCategory,
    signals: signalHashes,
    diffSummaryHash,
    // _diffSummary is used internally to build the detailed JSON; stripped before writing summary
    _diffSummary: diffSummary,
  };
}

// ── CLI arg parsing ────────────────────────────────────────────────────────────

/**
 * Parse CLI arguments of the form --key=value.
 */
function parseArgs(argv) {
  const opts = {
    routesFile: null,
    baseA: null,
    baseB: null,
    batchId: null,
    outDir: config.findingsDir,
    sitePrefix: process.env.MIGRATION_SITE_PREFIX ?? config.sitePrefix,
  };

  for (const arg of argv) {
    if (arg.startsWith("--routes-file=")) {
      opts.routesFile = resolve(arg.slice("--routes-file=".length));
    } else if (arg.startsWith("--base-a=")) {
      opts.baseA = arg.slice("--base-a=".length).replace(/\/$/, "");
    } else if (arg.startsWith("--base-b=")) {
      opts.baseB = arg.slice("--base-b=".length).replace(/\/$/, "");
    } else if (arg.startsWith("--batch-id=")) {
      opts.batchId = arg.slice("--batch-id=".length);
    } else if (arg.startsWith("--out-dir=")) {
      opts.outDir = resolve(arg.slice("--out-dir=".length));
    } else if (arg.startsWith("--site-prefix=")) {
      opts.sitePrefix = arg.slice("--site-prefix=".length);
    }
  }

  return opts;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  // Validate required args
  if (!opts.routesFile) throw new Error("--routes-file is required");
  if (!opts.baseA) throw new Error("--base-a is required");
  if (!opts.baseB) throw new Error("--base-b is required");
  if (!opts.batchId) throw new Error("--batch-id is required");

  console.log("[S5b] compare-routes.mjs starting");
  console.log(`[S5b]   routes-file : ${opts.routesFile}`);
  console.log(`[S5b]   base-a      : ${opts.baseA}`);
  console.log(`[S5b]   base-b      : ${opts.baseB}`);
  console.log(`[S5b]   batch-id    : ${opts.batchId}`);
  console.log(`[S5b]   out-dir     : ${opts.outDir}`);
  console.log(`[S5b]   site-prefix : ${opts.sitePrefix}`);

  // Read routes file
  const routesJson = JSON.parse(await readFile(opts.routesFile, "utf8"));

  // Build per-route tasks: inBoth (compare), onlyInA (skip B), onlyInB (skip A)
  const routeEntries = [
    ...(routesJson.inBoth ?? []).map((r) => ({ route: r, side: "both" })),
    ...(routesJson.onlyInA ?? []).map((r) => ({ route: r, side: "only-a" })),
    ...(routesJson.onlyInB ?? []).map((r) => ({ route: r, side: "only-b" })),
  ];

  console.log(`[S5b] ${routeEntries.length} routes to process`);

  const summaryRoutes = [];
  const detailedRoutes = [];

  // Process routes sequentially (memory-bounded); fetches within a route are concurrent
  for (const { route, side } of routeEntries) {
    if (side === "only-a") {
      summaryRoutes.push({
        route,
        category: "route-only-in-a",
        subCategory: null,
        signals: {},
        diffSummaryHash: null,
      });
      continue;
    }

    if (side === "only-b") {
      summaryRoutes.push({
        route,
        category: "route-only-in-b",
        subCategory: null,
        signals: {},
        diffSummaryHash: null,
      });
      continue;
    }

    let finding;
    try {
      finding = await compareRoute({
        route,
        baseA: opts.baseA,
        baseB: opts.baseB,
        sitePrefix: opts.sitePrefix,
      });
    } catch (err) {
      // Unexpected error — record as error, do not fail the process
      console.error(`[S5b] unexpected error for ${route}:`, err?.message ?? err);
      finding = {
        route,
        category: "error",
        subCategory: null,
        signals: {},
        diffSummaryHash: null,
        error: `unexpected: ${err?.message ?? err}`,
      };
    }

    const { _diffSummary, ...summaryEntry } = finding;
    summaryRoutes.push(summaryEntry);

    // Collect detailed diff for non-identical routes
    if (finding.category !== "identical" && _diffSummary) {
      detailedRoutes.push({
        route,
        category: finding.category,
        subCategory: finding.subCategory,
        diffSummaryHash: finding.diffSummaryHash,
        diff: _diffSummary,
      });
    }

    console.log(
      `[S5b] ${route} → ${finding.category}${finding.subCategory ? `/${finding.subCategory}` : ""}`,
    );
  }

  // Write summary JSON
  const summaryJson = {
    batchId: opts.batchId,
    routes: summaryRoutes,
  };

  // Write detailed JSON, capped at 50 KB per non-identical route.
  // Each route entry is independently capped so large pages don't crowd out others.
  const MAX_ROUTE_DETAILED_BYTES = 50 * 1024;
  const cappedDetailedRoutes = detailedRoutes.map((entry) => {
    const serialized = JSON.stringify(entry, null, 2);
    if (serialized.length <= MAX_ROUTE_DETAILED_BYTES) return entry;
    // Entry exceeds limit — keep metadata but truncate the diff payload
    return {
      route: entry.route,
      category: entry.category,
      subCategory: entry.subCategory,
      diffSummaryHash: entry.diffSummaryHash,
      truncated: true,
      bytesExceeded: serialized.length,
      diff: null,
    };
  });
  const detailedJson = JSON.stringify(
    { batchId: opts.batchId, routes: cappedDetailedRoutes },
    null,
    2,
  );

  await mkdir(opts.outDir, { recursive: true });

  const summaryPath = `${opts.outDir}/batch-${opts.batchId}.json`;
  const detailedPath = `${opts.outDir}/batch-${opts.batchId}-detailed.json`;

  await writeFile(summaryPath, JSON.stringify(summaryJson, null, 2) + "\n");
  await writeFile(detailedPath, detailedJson + "\n");

  console.log(`[S5b] summary   → ${summaryPath}`);
  console.log(`[S5b] detailed  → ${detailedPath}`);
  console.log(
    `[S5b] done — ${summaryRoutes.length} routes processed (batchId: ${opts.batchId})`,
  );
}

// Run only when invoked directly — not when imported as a module by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("[S5b] fatal:", err?.message ?? err);
    process.exit(1);
  });
}
