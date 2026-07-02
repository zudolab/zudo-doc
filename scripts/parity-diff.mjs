#!/usr/bin/env node
/**
 * Parity diff tool for the Collapse Wiring Shells epic (#2420).
 *
 * Usage:
 *   # Generate baseline snapshot from a fresh dist/:
 *   node scripts/parity-diff.mjs --generate [--baseline <dir>] [--dist <dir>]
 *
 *   # Diff current dist/ against committed baseline:
 *   node scripts/parity-diff.mjs [--baseline <dir>] [--dist <dir>]
 *
 * Defaults:
 *   --baseline  _temp-resource/2420-collapse-wiring-shells/baseline
 *   --dist      dist
 *
 * Exit codes:
 *   0  no diff (or generate completed)
 *   1  diff found (or fatal error)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readdir, readFile, stat } from "node:fs/promises";
import { normalizeHtml, sha256 } from "./parity-html-normalize.mjs";

const __dir = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(__dir, "..");

// ── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let isGenerate = false;
let baselineArg = null;
let distArg = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--generate") {
    isGenerate = true;
  } else if (args[i] === "--baseline" && i + 1 < args.length) {
    baselineArg = args[++i];
  } else if (args[i] === "--dist" && i + 1 < args.length) {
    distArg = args[++i];
  }
}

// resolve() handles both absolute args (e.g. an absolute --baseline from
// parity-build.sh) and relative ones (resolved against cwd). join(cwd, absPath)
// would wrongly nest the absolute path under cwd, writing to a stray ./home/... tree.
const BASELINE_DIR = baselineArg
  ? resolve(baselineArg)
  : join(REPO_ROOT, "_temp-resource/2420-collapse-wiring-shells/baseline");

const DIST_DIR = distArg
  ? resolve(distArg)
  : join(REPO_ROOT, "dist");

// ── Asset hash normalization ─────────────────────────────────────────────────
//
// Content-hashed filenames change whenever any source file changes.
// We normalize them to stable placeholders so the per-page HTML sha256s
// are stable across refactor builds.
//
// normalizeHtml/sha256 live in ./parity-html-normalize.mjs — shared with
// packages/zudo-doc/src/__tests__/route-injection-build.slow.test.ts so both
// call sites hash HTML identically (zudolab/zudo-doc#2530).

// ── File collection ──────────────────────────────────────────────────────────

async function collectHtmlFiles(dir) {
  const results = [];
  async function walk(d) {
    const entries = await readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile() && e.name.endsWith(".html")) {
        results.push(full);
      }
    }
  }
  await walk(dir);
  return results.sort();
}

async function collectAssets(distDir) {
  const assetsDir = join(distDir, "assets");
  if (!existsSync(assetsDir)) return [];
  const files = await readdir(assetsDir);
  return files.sort();
}

// ── Manifest builders ────────────────────────────────────────────────────────

async function buildHtmlManifests(distDir) {
  const htmlFiles = await collectHtmlFiles(distDir);
  const normalized = {};
  const raw = {};
  const islands = new Set();

  for (const f of htmlFiles) {
    const content = readFileSync(f, "utf8");
    const routeKey = "/" + relative(distDir, f).replace(/index\.html$/, "").replace(/\.html$/, "");

    // Collect island names
    for (const m of content.matchAll(/data-zfb-island="([^"]+)"/g)) {
      islands.add(m[1]);
    }

    const norm = normalizeHtml(content);
    normalized[routeKey] = sha256(norm);
    raw[routeKey] = sha256(content);
  }

  return { normalized, raw, islands: [...islands].sort() };
}

function buildAssetManifest(assets) {
  // Normalize asset filenames: strip content hash, keep pattern
  return assets.map((a) => {
    if (/^islands-[a-f0-9]+\.js$/.test(a)) return "islands-CONTENTHASH.js";
    if (/^islands-chunk-[A-Z0-9]+\.js$/.test(a)) return "islands-chunk-CHUNKHASH.js";
    if (/^styles-[a-f0-9]+\.css$/.test(a)) return "styles-CONTENTHASH.css";
    return a;
  });
}

function buildRouteList(distDir) {
  const routesFile = join(distDir, "__zfb/routes.json");
  if (!existsSync(routesFile)) return null;
  const data = JSON.parse(readFileSync(routesFile, "utf8"));
  return (data.routes ?? []).map((r) => r.url).sort();
}

// ── Generate mode ────────────────────────────────────────────────────────────

async function generate() {
  if (!existsSync(DIST_DIR)) {
    console.error(`[parity-diff] dist/ not found at: ${DIST_DIR}`);
    console.error("  Run: pnpm build  (or  scripts/parity-build.sh)");
    process.exit(1);
  }

  console.log(`[parity-diff] Generating baseline snapshot...`);
  console.log(`  dist:     ${DIST_DIR}`);
  console.log(`  baseline: ${BASELINE_DIR}`);

  mkdirSync(BASELINE_DIR, { recursive: true });

  const { normalized, raw, islands } = await buildHtmlManifests(DIST_DIR);
  const assets = await collectAssets(DIST_DIR);
  const normalizedAssets = [...new Set(buildAssetManifest(assets))].sort();
  const routeList = buildRouteList(DIST_DIR);

  const htmlManifestPath = join(BASELINE_DIR, "html-manifest.json");
  const rawManifestPath = join(BASELINE_DIR, "html-manifest-raw.json");
  const routeListPath = join(BASELINE_DIR, "route-list.json");
  const assetManifestPath = join(BASELINE_DIR, "asset-manifest.json");
  const islandManifestPath = join(BASELINE_DIR, "island-manifest.json");

  writeFileSync(htmlManifestPath, JSON.stringify(normalized, null, 2) + "\n");
  writeFileSync(rawManifestPath, JSON.stringify(raw, null, 2) + "\n");
  writeFileSync(routeListPath, JSON.stringify(routeList, null, 2) + "\n");
  writeFileSync(assetManifestPath, JSON.stringify(normalizedAssets, null, 2) + "\n");
  writeFileSync(islandManifestPath, JSON.stringify(islands, null, 2) + "\n");

  const routeCount = Object.keys(normalized).length;
  console.log(`[parity-diff] Snapshot written:`);
  console.log(`  ${routeCount} HTML routes in html-manifest.json`);
  console.log(`  ${routeList?.length ?? 0} routes in route-list.json`);
  console.log(`  ${normalizedAssets.length} distinct asset patterns in asset-manifest.json`);
  console.log(`  ${islands.length} island components in island-manifest.json`);
}

// ── Diff mode ────────────────────────────────────────────────────────────────

async function diff() {
  const htmlManifestPath = join(BASELINE_DIR, "html-manifest.json");
  const routeListPath = join(BASELINE_DIR, "route-list.json");
  const assetManifestPath = join(BASELINE_DIR, "asset-manifest.json");
  const islandManifestPath = join(BASELINE_DIR, "island-manifest.json");

  for (const p of [htmlManifestPath, routeListPath, assetManifestPath, islandManifestPath]) {
    if (!existsSync(p)) {
      console.error(`[parity-diff] Baseline file missing: ${p}`);
      console.error("  Run: node scripts/parity-diff.mjs --generate  to create it.");
      process.exit(1);
    }
  }

  if (!existsSync(DIST_DIR)) {
    console.error(`[parity-diff] dist/ not found at: ${DIST_DIR}`);
    console.error("  Run: pnpm build  (or  scripts/parity-build.sh)");
    process.exit(1);
  }

  console.log(`[parity-diff] Comparing against baseline...`);
  console.log(`  dist:     ${DIST_DIR}`);
  console.log(`  baseline: ${BASELINE_DIR}`);

  const baselineHtml = JSON.parse(readFileSync(htmlManifestPath, "utf8"));
  const baselineRoutes = JSON.parse(readFileSync(routeListPath, "utf8"));
  const baselineAssets = JSON.parse(readFileSync(assetManifestPath, "utf8"));
  const baselineIslands = JSON.parse(readFileSync(islandManifestPath, "utf8"));

  const { normalized, raw: _raw, islands } = await buildHtmlManifests(DIST_DIR);
  const assets = await collectAssets(DIST_DIR);
  const normalizedAssets = [...new Set(buildAssetManifest(assets))].sort();
  const routeList = buildRouteList(DIST_DIR) ?? [];

  let hasChanges = false;

  // ── 1. HTML manifest diff (HARD gate) ────────────────────────────────────
  const htmlDiffs = [];
  const allRoutes = new Set([...Object.keys(baselineHtml), ...Object.keys(normalized)]);
  for (const route of [...allRoutes].sort()) {
    const base = baselineHtml[route];
    const curr = normalized[route];
    if (base !== curr) {
      htmlDiffs.push({ route, base: base ?? "(missing)", curr: curr ?? "(missing)" });
    }
  }

  if (htmlDiffs.length > 0) {
    hasChanges = true;
    console.log(`\n[parity-diff] HTML DIFF (normalized sha256) — ${htmlDiffs.length} changed:`);
    for (const { route, base, curr } of htmlDiffs) {
      console.log(`  ${route}`);
      console.log(`    base: ${base}`);
      console.log(`    curr: ${curr}`);
    }
  } else {
    console.log(`[parity-diff] HTML: PASS — all ${Object.keys(baselineHtml).length} routes match`);
  }

  // ── 2. Route list diff ────────────────────────────────────────────────────
  const addedRoutes = routeList.filter((r) => !baselineRoutes.includes(r));
  const removedRoutes = baselineRoutes.filter((r) => !routeList.includes(r));
  if (addedRoutes.length > 0 || removedRoutes.length > 0) {
    hasChanges = true;
    console.log(`\n[parity-diff] ROUTE LIST DIFF:`);
    for (const r of addedRoutes) console.log(`  + ${r}`);
    for (const r of removedRoutes) console.log(`  - ${r}`);
  } else {
    console.log(`[parity-diff] Route list: PASS — ${routeList.length} routes unchanged`);
  }

  // ── 3. Asset manifest diff ────────────────────────────────────────────────
  const addedAssets = normalizedAssets.filter((a) => !baselineAssets.includes(a));
  const removedAssets = baselineAssets.filter((a) => !normalizedAssets.includes(a));
  if (addedAssets.length > 0 || removedAssets.length > 0) {
    hasChanges = true;
    console.log(`\n[parity-diff] ASSET MANIFEST DIFF:`);
    for (const a of addedAssets) console.log(`  + ${a}`);
    for (const a of removedAssets) console.log(`  - ${a}`);
  } else {
    console.log(`[parity-diff] Asset manifest: PASS — ${normalizedAssets.length} asset patterns unchanged`);
  }

  // ── 4. Island manifest diff ───────────────────────────────────────────────
  const addedIslands = islands.filter((i) => !baselineIslands.includes(i));
  const removedIslands = baselineIslands.filter((i) => !islands.includes(i));
  if (addedIslands.length > 0 || removedIslands.length > 0) {
    hasChanges = true;
    console.log(`\n[parity-diff] ISLAND MANIFEST DIFF:`);
    for (const i of addedIslands) console.log(`  + ${i}`);
    for (const i of removedIslands) console.log(`  - ${i}`);
  } else {
    console.log(`[parity-diff] Island manifest: PASS — ${islands.length} components unchanged`);
  }

  // ── Result ────────────────────────────────────────────────────────────────
  if (hasChanges) {
    console.log(`\n[parity-diff] FAIL — differences found`);
    process.exit(1);
  } else {
    console.log(`\n[parity-diff] PASS — no differences`);
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────

if (isGenerate) {
  await generate();
} else {
  await diff();
}
