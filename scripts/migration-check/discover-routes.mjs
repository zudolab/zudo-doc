#!/usr/bin/env node
/**
 * discover-routes.mjs — produce a unified deduplicated route list.
 *
 * Primary path: parse sitemap-index.xml (Astro default) or sitemap.xml from
 * each snapshot directory on disk. Falls back to walking the snapshot
 * directory tree for *.html files when sitemaps are missing or empty.
 *
 * Route derivation happens purely on disk — no HTTP server is required.
 * The actual HTTP fetch / page comparison happens in S5b.
 *
 * If filesystem walk is also empty (e.g., a future migration produces no
 * static dist), a fallback to crawling served URLs via the S3 servers is
 * possible but not implemented here (out of scope for S4).
 *
 * Outputs:
 *   .l-zfb-migration-check/routes.json
 */

import { existsSync } from "node:fs";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import * as config from "./config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the repo root (two levels up from scripts/migration-check/). */
const REPO_ROOT = resolve(__dirname, "../..");

const SNAPSHOTS_DIR = join(REPO_ROOT, config.workspaceDir, "snapshots");
const SNAPSHOT_A_DIR = join(SNAPSHOTS_DIR, "a");
const SNAPSHOT_B_DIR = join(SNAPSHOTS_DIR, "b");
const ROUTES_JSON_PATH = join(REPO_ROOT, config.workspaceDir, "routes.json");

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Extract all <loc>...</loc> values from a sitemap XML string.
 * Works for both urlset (sitemap.xml) and sitemapindex (sitemap-index.xml).
 */
export function parseSitemapXml(content) {
  const urls = [];
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gs;
  let match;
  while ((match = locRegex.exec(content)) !== null) {
    const url = match[1].trim();
    if (url) urls.push(url);
  }
  return urls;
}

/**
 * Normalize a raw URL or path to its canonical route form:
 *  1. Strip protocol + host (if absolute URL)
 *  2. Strip query strings and fragments
 *  3. Strip sitePrefix (e.g. "/pj/zudo-doc/")
 *  4. Collapse repeated slashes
 *  5. Remove trailing slash (except root "/")
 *  6. Ensure leading slash
 */
export function normalizeRoute(rawUrl, sitePrefix = "") {
  // Strip protocol + host for absolute URLs
  let path = rawUrl.replace(/^https?:\/\/[^/]+/, "");
  // Strip query strings and fragments
  path = path.replace(/[?#].*$/, "");
  // Strip sitePrefix — sitePrefix always has a trailing slash in config
  if (sitePrefix && path.startsWith(sitePrefix)) {
    // e.g. "/pj/zudo-doc/docs/foo/" → "/docs/foo/"
    path = "/" + path.slice(sitePrefix.length);
  }
  // Collapse double slashes that can appear after prefix stripping
  path = path.replace(/\/\/+/g, "/");
  // Remove trailing slash (except root "/")
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  // Ensure leading slash
  if (!path.startsWith("/")) {
    path = "/" + path;
  }
  return path || "/";
}

/**
 * Convert a relative HTML file path (from snapshotDir) to its canonical route.
 *  - "index.html"               → "/"
 *  - "docs/foo/index.html"      → "/docs/foo"
 *  - "docs/bar.html"            → "/docs/bar"
 */
export function htmlFileToRoute(relPath) {
  // Normalize path separators (Windows safety)
  let route = relPath.replace(/\\/g, "/");
  // Remove .html extension
  route = route.replace(/\.html$/, "");
  // "index" (root) → "/"
  if (route === "index") return "/";
  // "docs/foo/index" → "docs/foo"
  if (route.endsWith("/index")) {
    route = route.slice(0, -"/index".length);
  }
  // Ensure leading slash
  if (!route.startsWith("/")) route = "/" + route;
  // Remove trailing slash (except root)
  if (route.length > 1 && route.endsWith("/")) route = route.slice(0, -1);
  return route || "/";
}

/**
 * Check whether the sitemap route ordering changed between A and B.
 * Only evaluated when both snapshots produced sitemap-derived route lists.
 *
 * Sitemap order drift is recorded as cosmetic-by-default
 * ("sitemap-route-order" in config.cosmeticByDefaultMarkers) — only the
 * boolean flag is stored, not a blocking finding.
 *
 * @param {string[] | null} orderedA  Routes in sitemap A order (null = filesystem fallback)
 * @param {string[] | null} orderedB  Routes in sitemap B order (null = filesystem fallback)
 * @param {Set<string>} inBothSet     Set of routes present in both snapshots
 * @returns {boolean}
 */
export function checkSitemapOrderChanged(orderedA, orderedB, inBothSet) {
  if (!orderedA || !orderedB) return false;
  const seqA = orderedA.filter((r) => inBothSet.has(r));
  const seqB = orderedB.filter((r) => inBothSet.has(r));
  if (seqA.length !== seqB.length) return true;
  return seqA.some((r, i) => r !== seqB[i]);
}

// ── Filesystem helpers ────────────────────────────────────────────────────────

/**
 * Walk a snapshot directory recursively, returning relative paths of all
 * .html files found. Skips the _artifacts/ subdirectory (non-HTML artifacts
 * are handled by diff-artifacts.mjs, not route discovery).
 *
 * @param {string} snapshotDir  Absolute path to snapshot root
 * @returns {Promise<string[]>} Relative paths (forward-slash separated)
 */
export async function walkHtmlFiles(snapshotDir) {
  const results = [];

  async function walk(currentDir) {
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return; // directory does not exist or is unreadable
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === "_artifacts") continue; // skip artifact dir
        await walk(join(currentDir, entry.name));
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        const fullPath = join(currentDir, entry.name);
        // Relative path from snapshotDir, normalized to forward slashes
        const relPath = fullPath.slice(snapshotDir.length + 1).replace(/\\/g, "/");
        results.push(relPath);
      }
    }
  }

  await walk(snapshotDir);
  return results;
}

// ── Per-snapshot route extraction ─────────────────────────────────────────────

/**
 * Get canonical routes from a single snapshot directory.
 *
 * Resolution order:
 *   1. sitemap-index.xml (Astro emits this by default)
 *   2. sitemap.xml
 *   3. Filesystem walk (fallback)
 *
 * @typedef {{ routes: string[], orderedRoutes: string[] | null, source: string }} SnapshotRoutes
 * @param {string} snapshotDir
 * @param {string} sitePrefix
 * @returns {Promise<SnapshotRoutes>}
 */
export async function getRoutesFromSnapshot(snapshotDir, sitePrefix) {
  const sitemapIndexPath = join(snapshotDir, "sitemap-index.xml");
  const sitemapPath = join(snapshotDir, "sitemap.xml");

  // ── 1. sitemap-index.xml (Astro default) ─────────────────────────────────
  if (existsSync(sitemapIndexPath)) {
    const indexContent = await readFile(sitemapIndexPath, "utf8");
    const sitemapLocs = parseSitemapXml(indexContent);
    const rawUrls = [];

    for (const loc of sitemapLocs) {
      // Resolve referenced sitemap by filename in the same snapshot dir
      const filename = basename(loc);
      const localPath = join(snapshotDir, filename);
      if (existsSync(localPath)) {
        const subContent = await readFile(localPath, "utf8");
        rawUrls.push(...parseSitemapXml(subContent));
      }
    }

    if (rawUrls.length > 0) {
      const orderedRoutes = rawUrls.map((u) => normalizeRoute(u, sitePrefix));
      const routes = [...new Set(orderedRoutes)];
      return { routes, orderedRoutes, source: "sitemap-index" };
    }
  }

  // ── 2. sitemap.xml ────────────────────────────────────────────────────────
  if (existsSync(sitemapPath)) {
    const content = await readFile(sitemapPath, "utf8");
    const rawUrls = parseSitemapXml(content);
    if (rawUrls.length > 0) {
      const orderedRoutes = rawUrls.map((u) => normalizeRoute(u, sitePrefix));
      const routes = [...new Set(orderedRoutes)];
      return { routes, orderedRoutes, source: "sitemap" };
    }
  }

  // ── 3. Filesystem walk (fallback) ─────────────────────────────────────────
  const htmlFiles = await walkHtmlFiles(snapshotDir);
  const routes = [...new Set(htmlFiles.map(htmlFileToRoute))];
  return { routes, orderedRoutes: null, source: "filesystem" };
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Discover routes from both snapshots and write routes.json.
 *
 * @param {object} [opts]
 * @param {string} [opts.sitePrefix]
 * @param {string} [opts.snapshotADir]
 * @param {string} [opts.snapshotBDir]
 * @param {string} [opts.outputPath]
 * @returns {Promise<object>} The routes.json content
 */
export async function discoverRoutes(opts = {}) {
  const sitePrefix = opts.sitePrefix ?? config.sitePrefix;
  const snapshotADir = opts.snapshotADir ?? SNAPSHOT_A_DIR;
  const snapshotBDir = opts.snapshotBDir ?? SNAPSHOT_B_DIR;
  const outputPath = opts.outputPath ?? ROUTES_JSON_PATH;

  console.log("[S4] discover-routes.mjs starting");
  console.log(`[S4] snapshot A: ${snapshotADir}`);
  console.log(`[S4] snapshot B: ${snapshotBDir}`);

  const [resultA, resultB] = await Promise.all([
    getRoutesFromSnapshot(snapshotADir, sitePrefix),
    getRoutesFromSnapshot(snapshotBDir, sitePrefix),
  ]);

  console.log(`[S4] A: ${resultA.routes.length} routes (source: ${resultA.source})`);
  console.log(`[S4] B: ${resultB.routes.length} routes (source: ${resultB.source})`);

  const setA = new Set(resultA.routes);
  const setB = new Set(resultB.routes);

  const inBoth = resultA.routes.filter((r) => setB.has(r));
  const onlyInA = resultA.routes.filter((r) => !setB.has(r));
  const onlyInB = resultB.routes.filter((r) => !setA.has(r));
  const all = [...new Set([...resultA.routes, ...resultB.routes])].sort();

  const inBothSet = new Set(inBoth);
  const sitemapOrderChanged = checkSitemapOrderChanged(
    resultA.orderedRoutes,
    resultB.orderedRoutes,
    inBothSet,
  );

  const output = {
    all,
    onlyInA,
    onlyInB,
    inBoth,
    stats: {
      a: resultA.routes.length,
      b: resultB.routes.length,
      both: inBoth.length,
      onlyInA: onlyInA.length,
      onlyInB: onlyInB.length,
    },
    sitemapOrderChanged,
    sources: {
      a: resultA.source,
      b: resultB.source,
    },
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`[S4] routes.json written to ${outputPath}`);
  console.log(`[S4] stats: ${JSON.stringify(output.stats)}`);

  return output;
}

// Run if invoked directly (not imported as a module)
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  discoverRoutes().catch((err) => {
    console.error("[S4] fatal:", err.message ?? err);
    process.exit(1);
  });
}
