#!/usr/bin/env node
/**
 * diff-artifacts.mjs — compare non-HTML artifacts between snapshot A and B.
 *
 * Primary path: walk .l-zfb-migration-check/snapshots/{a,b}/_artifacts/
 * directories populated by S2's build-snapshots. No HTTP server is required.
 * Route derivation via crawling served URLs (S3 fallback) is not implemented
 * here — filesystem-based artifact walking is reliable for all known use cases.
 *
 * Artifact comparison strategies by type:
 *   JSON   (*.json, *.webmanifest) — parse, sort keys recursively, deep-compare.
 *          Key-order drift is cosmetic. Entry-count delta and key-set delta are
 *          flagged as meaningful changes.
 *   Text   (robots.txt, llms.txt, llms-full.txt, _redirects, _headers, etc.)
 *          Line-set diff on a sorted union. Line-order drift is cosmetic.
 *          Added/removed lines are flagged.
 *   Binary (favicon.ico, *.png, etc.) — SHA-256 hash + byte size. Mismatch
 *          is flagged; no diff content is produced (binary diffs are not useful
 *          in a text-oriented report).
 *
 * Outputs:
 *   .l-zfb-migration-check/artifacts.json
 */

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join, resolve, dirname, extname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as config from "./config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the repo root (two levels up from scripts/migration-check/). */
const REPO_ROOT = resolve(__dirname, "../..");

const SNAPSHOTS_DIR = join(REPO_ROOT, config.workspaceDir, "snapshots");
const ARTIFACTS_A_DIR = join(SNAPSHOTS_DIR, "a", "_artifacts");
const ARTIFACTS_B_DIR = join(SNAPSHOTS_DIR, "b", "_artifacts");
const ARTIFACTS_JSON_PATH = join(REPO_ROOT, config.workspaceDir, "artifacts.json");

// ── Artifact type detection ───────────────────────────────────────────────────

// Extensions treated as JSON (deep-compare with key sorting)
const JSON_EXTENSIONS = new Set([".json", ".webmanifest"]);

// Extensions treated as binary (hash + size only)
const BINARY_EXTENSIONS = new Set([
  ".ico",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".webp",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
]);

/**
 * Detect the comparison strategy for an artifact by its file extension.
 * @param {string} relPath Relative artifact path
 * @returns {"json" | "text" | "binary"}
 */
export function getArtifactType(relPath) {
  const ext = extname(relPath).toLowerCase();
  if (JSON_EXTENSIONS.has(ext)) return "json";
  if (BINARY_EXTENSIONS.has(ext)) return "binary";
  return "text";
}

// ── JSON deep-compare ─────────────────────────────────────────────────────────

/**
 * Recursively sort object keys so that key-order drift is treated as cosmetic.
 * Arrays preserve element order (array ordering is typically semantic).
 *
 * @param {unknown} obj
 * @returns {unknown} New object / array with sorted keys at every level
 */
export function deepSortObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(deepSortObject);
  }
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, deepSortObject(obj[k])]),
    );
  }
  return obj;
}

/**
 * Deep-compare two JSON content strings, treating key-order drift as cosmetic.
 *
 * @param {string} aContent Raw JSON text from snapshot A
 * @param {string} bContent Raw JSON text from snapshot B
 * @returns {{ identical: boolean, entryCountDelta: number, keySetDelta: object | null } | { error: string }}
 */
export function diffJson(aContent, bContent) {
  let aObj, bObj;
  try {
    aObj = JSON.parse(aContent);
  } catch (err) {
    return { error: `A: invalid JSON: ${err.message}` };
  }
  try {
    bObj = JSON.parse(bContent);
  } catch (err) {
    return { error: `B: invalid JSON: ${err.message}` };
  }

  const aSorted = JSON.stringify(deepSortObject(aObj));
  const bSorted = JSON.stringify(deepSortObject(bObj));
  const identical = aSorted === bSorted;

  // Top-level entry count (array length or key count)
  const aCount = Array.isArray(aObj)
    ? aObj.length
    : aObj !== null && typeof aObj === "object"
      ? Object.keys(aObj).length
      : 0;
  const bCount = Array.isArray(bObj)
    ? bObj.length
    : bObj !== null && typeof bObj === "object"
      ? Object.keys(bObj).length
      : 0;

  // Key-set delta (meaningful only for top-level objects, not arrays)
  let keySetDelta = null;
  if (
    !Array.isArray(aObj) &&
    !Array.isArray(bObj) &&
    aObj !== null &&
    typeof aObj === "object" &&
    bObj !== null &&
    typeof bObj === "object"
  ) {
    const aKeys = new Set(Object.keys(aObj));
    const bKeys = new Set(Object.keys(bObj));
    const onlyInA = [...aKeys].filter((k) => !bKeys.has(k));
    const onlyInB = [...bKeys].filter((k) => !aKeys.has(k));
    if (onlyInA.length > 0 || onlyInB.length > 0) {
      keySetDelta = { onlyInA, onlyInB };
    }
  }

  return {
    identical,
    entryCountDelta: bCount - aCount,
    keySetDelta,
  };
}

// ── Text line-set diff ────────────────────────────────────────────────────────

/**
 * Compare two plain-text content strings using a line-set diff.
 * Line-order drift is treated as cosmetic — only added/removed unique lines
 * are flagged. Empty / whitespace-only lines are ignored.
 *
 * @param {string} aContent Raw text from snapshot A
 * @param {string} bContent Raw text from snapshot B
 * @returns {{ identical: boolean, addedLines: string[], removedLines: string[] }}
 */
export function diffText(aContent, bContent) {
  const toLineSet = (content) =>
    new Set(
      content
        .split("\n")
        .map((l) => l.trimEnd())
        .filter((l) => l.length > 0),
    );

  const aLines = toLineSet(aContent);
  const bLines = toLineSet(bContent);

  const addedLines = [...bLines].filter((l) => !aLines.has(l));
  const removedLines = [...aLines].filter((l) => !bLines.has(l));

  return {
    identical: addedLines.length === 0 && removedLines.length === 0,
    addedLines,
    removedLines,
  };
}

// ── Binary hash comparison ────────────────────────────────────────────────────

/**
 * Compare two binary files by SHA-256 hash and byte size.
 * Content diff is not produced (binary diff is not useful in a text report).
 *
 * @param {string} aPath Absolute path to artifact A
 * @param {string} bPath Absolute path to artifact B
 * @returns {Promise<{ identical: boolean, sizeA: number, sizeB: number, hashA: string, hashB: string }>}
 */
export async function diffBinary(aPath, bPath) {
  const [aBuf, bBuf] = await Promise.all([readFile(aPath), readFile(bPath)]);
  const aHash = createHash("sha256").update(aBuf).digest("hex");
  const bHash = createHash("sha256").update(bBuf).digest("hex");

  return {
    identical: aHash === bHash,
    sizeA: aBuf.length,
    sizeB: bBuf.length,
    hashA: aHash,
    hashB: bHash,
  };
}

// ── Astro asset path canonicalization ────────────────────────────────────────

/**
 * Astro's image pipeline emits content-hashed filenames under /_astro/:
 *   _astro/<name>.<HASH>.<ext>   e.g. _astro/image-wide.D1YdccyX_1EtJL4.webp
 *
 * When a migration moves those images to a stable public path
 * (e.g. /img/image-enlarge/image-wide.webp), the A and B artifact directories
 * reference the same content at different relative paths.
 *
 * This function strips the hash to produce a canonical basename so the two
 * sides can be matched.  It only activates for paths whose first segment is
 * exactly `_astro` and whose filename contains an 8+-char base64url hash
 * segment.
 *
 * @param {string} relPath Relative artifact path
 * @returns {string | null} Canonical basename (e.g. "image-wide.webp") or null
 */
export function extractAstroCanonicalBasename(relPath) {
  // Require path starts with `_astro/` with no subdirectory (flat filename only)
  const match = relPath.match(/^_astro\/([^/]+?)\.([A-Za-z0-9_-]{8,})\.([A-Za-z0-9]+)$/);
  if (!match) return null;
  return `${match[1]}.${match[3]}`;
}

/**
 * Build a Map from canonical basename → relative path for every _astro entry
 * in the given path list that matches the Astro hash pattern.
 *
 * Used to cross-match A-side Astro-hashed paths against B-side public paths
 * that carry the same image content under a different directory structure.
 *
 * @param {string[]} paths List of relative artifact paths
 * @returns {Map<string, string>} canonical basename → actual relPath
 */
export function buildAstroCanonicalMap(paths) {
  const map = new Map();
  for (const p of paths) {
    const canonical = extractAstroCanonicalBasename(p);
    if (canonical !== null) {
      map.set(canonical, p);
    }
  }
  return map;
}

// ── Artifact directory walking ────────────────────────────────────────────────

/**
 * Recursively walk an _artifacts directory and collect all relative file paths.
 * Returns an empty array if the directory does not exist.
 *
 * @param {string} artifactsDir Absolute path to _artifacts/ dir
 * @returns {Promise<string[]>} Relative paths, forward-slash separated
 */
export async function walkArtifactsDir(artifactsDir) {
  const results = [];

  async function walk(currentDir) {
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return; // directory does not exist or is unreadable
    }
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const relPath = fullPath.slice(artifactsDir.length + 1).replace(/\\/g, "/");
        results.push(relPath);
      }
    }
  }

  await walk(artifactsDir);
  return results;
}

// ── Main diff function ────────────────────────────────────────────────────────

/**
 * Diff all non-HTML artifacts between snapshot A and B, then write artifacts.json.
 *
 * @param {object} [opts]
 * @param {string} [opts.artifactsADir]
 * @param {string} [opts.artifactsBDir]
 * @param {string} [opts.outputPath]
 * @returns {Promise<object>} The artifacts.json content
 */
export async function diffArtifacts(opts = {}) {
  const artifactsADir = opts.artifactsADir ?? ARTIFACTS_A_DIR;
  const artifactsBDir = opts.artifactsBDir ?? ARTIFACTS_B_DIR;
  const outputPath = opts.outputPath ?? ARTIFACTS_JSON_PATH;

  console.log("[S4] diff-artifacts.mjs starting");
  console.log(`[S4] artifacts A: ${artifactsADir}`);
  console.log(`[S4] artifacts B: ${artifactsBDir}`);

  const [pathsA, pathsB] = await Promise.all([
    walkArtifactsDir(artifactsADir),
    walkArtifactsDir(artifactsBDir),
  ]);

  console.log(`[S4] A: ${pathsA.length} artifact(s)`);
  console.log(`[S4] B: ${pathsB.length} artifact(s)`);

  const setA = new Set(pathsA);
  const setB = new Set(pathsB);

  // ── Astro cross-matching ─────────────────────────────────────────────────────
  // A-side images under _astro/<name>.HASH.<ext> may correspond to B-side images
  // at a stable public path like img/image-enlarge/<name>.<ext>.
  // Pair them by canonical basename (hash stripped) when exactly one B candidate
  // shares that basename and neither path has an exact counterpart on the other side.

  const astroCanonicalMapA = buildAstroCanonicalMap(pathsA);

  // Build basename → B paths map (only consider B paths not already in A)
  const basenameMapB = new Map();
  for (const p of pathsB) {
    if (setA.has(p)) continue; // exact match; handled by normal path comparison
    const bn = p.split("/").at(-1);
    if (!basenameMapB.has(bn)) basenameMapB.set(bn, []);
    basenameMapB.get(bn).push(p);
  }

  // aRelPath → bRelPath for safely cross-matched pairs
  const astroCrossMatch = new Map();
  for (const [canonical, aRelPath] of astroCanonicalMapA) {
    if (setB.has(aRelPath)) continue; // exact path exists in B; no canonicalization needed
    const bCandidates = basenameMapB.get(canonical) ?? [];
    if (bCandidates.length === 1) {
      astroCrossMatch.set(aRelPath, bCandidates[0]);
    }
  }
  const crossMatchedBPaths = new Set(astroCrossMatch.values());

  if (astroCrossMatch.size > 0) {
    console.log(`[S4] Astro cross-matched ${astroCrossMatch.size} path(s) by canonical basename`);
  }

  // ── Helper to compare two artifact files ────────────────────────────────────
  async function compareFiles(type, aFilePath, bFilePath) {
    if (type === "json") {
      const [aContent, bContent] = await Promise.all([
        readFile(aFilePath, "utf8"),
        readFile(bFilePath, "utf8"),
      ]);
      return diffJson(aContent, bContent);
    } else if (type === "text") {
      const [aContent, bContent] = await Promise.all([
        readFile(aFilePath, "utf8"),
        readFile(bFilePath, "utf8"),
      ]);
      return diffText(aContent, bContent);
    } else if (type === "binary") {
      return diffBinary(aFilePath, bFilePath);
    }
    return null;
  }

  const artifacts = [];

  // ── Process Astro cross-matched pairs ───────────────────────────────────────
  for (const [aRelPath, bRelPath] of astroCrossMatch) {
    const canonical = extractAstroCanonicalBasename(aRelPath);
    const type = getArtifactType(aRelPath);
    const comparison = await compareFiles(
      type,
      join(artifactsADir, aRelPath),
      join(artifactsBDir, bRelPath),
    );
    artifacts.push({
      path: canonical,
      pathA: aRelPath,
      pathB: bRelPath,
      presence: "present-in-both",
      canonicalized: true,
      type,
      comparison,
    });
  }

  // ── Process remaining paths (exact-path comparison) ──────────────────────────
  const crossMatchedAPaths = new Set(astroCrossMatch.keys());
  const remainingPaths = [...new Set([...pathsA, ...pathsB])]
    .filter((p) => !crossMatchedAPaths.has(p) && !crossMatchedBPaths.has(p))
    .sort();

  for (const relPath of remainingPaths) {
    const inA = setA.has(relPath);
    const inB = setB.has(relPath);

    const presence = inA && inB ? "present-in-both" : inA ? "only-in-a" : "only-in-b";
    const type = getArtifactType(relPath);
    let comparison = null;

    if (presence === "present-in-both") {
      comparison = await compareFiles(
        type,
        join(artifactsADir, relPath),
        join(artifactsBDir, relPath),
      );
    }

    artifacts.push({ path: relPath, presence, type, comparison });
  }

  // Re-sort so cross-matched and exact-path entries are interleaved by path
  artifacts.sort((a, b) => a.path.localeCompare(b.path));

  const stats = {
    total: artifacts.length,
    presentInBoth: artifacts.filter((a) => a.presence === "present-in-both").length,
    onlyInA: artifacts.filter((a) => a.presence === "only-in-a").length,
    onlyInB: artifacts.filter((a) => a.presence === "only-in-b").length,
    identical: artifacts.filter((a) => a.comparison?.identical === true).length,
    changed: artifacts.filter((a) => a.comparison?.identical === false).length,
  };

  const output = {
    generatedAt: new Date().toISOString(),
    artifacts,
    stats,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`[S4] artifacts.json written to ${outputPath}`);
  console.log(`[S4] stats: ${JSON.stringify(stats)}`);

  return output;
}

// Run if invoked directly (not imported as a module)
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  diffArtifacts().catch((err) => {
    console.error("[S4] fatal:", err.message ?? err);
    process.exit(1);
  });
}
