/**
 * Synchronous reader for `_category_.json` files. Walks a directory tree
 * and returns a map of `<relative-dir-path>` → {@link CategoryMeta}.
 *
 * Lives in this folder rather than reusing the project's existing
 * `loadCategoryMeta` because the framework-layer must not import anything
 * from the consumer project (`@/utils/...`). Behaviour is intentionally
 * identical to the original so call sites can swap implementations 1:1.
 */
import fs from "node:fs";
import path from "node:path";
import type { CategoryMeta } from "./types.ts";

const cache = new Map<string, Map<string, CategoryMeta>>();

/**
 * Scan `contentDir` recursively for `_category_.json` files. Each file's
 * parent directory becomes a map key, expressed as a path relative to
 * `contentDir` and joined with the platform separator (`scanDir` uses
 * `path.relative`, which yields forward slashes on POSIX and backslashes
 * on Windows — that matches the keys produced by the legacy implementation
 * and is what the build-tree code re-uses verbatim).
 *
 * Results are memoised per `contentDir` because Astro builds resolve every
 * page route in the same process; re-reading thousands of `_category_.json`
 * files for each page is wasteful.
 */
export function loadCategoryMeta(contentDir: string): Map<string, CategoryMeta> {
  const absolute = path.resolve(contentDir);
  const cached = cache.get(absolute);
  if (cached) return cached;
  const result = new Map<string, CategoryMeta>();
  scanDir(absolute, absolute, result);
  cache.set(absolute, result);
  return result;
}

/** Test/HMR escape hatch — clears the per-directory cache. */
export function clearCategoryMetaCache(): void {
  cache.clear();
}

function scanDir(
  baseDir: string,
  currentDir: string,
  result: Map<string, CategoryMeta>,
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    // Missing or unreadable directory: silently skip. Matches legacy behaviour.
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(currentDir, entry.name);
    const categoryFile = path.join(fullPath, "_category_.json");
    if (fs.existsSync(categoryFile)) {
      const meta = readCategoryFile(categoryFile);
      if (meta) {
        const relativePath = path.relative(baseDir, fullPath);
        result.set(relativePath, meta);
      }
    }
    scanDir(baseDir, fullPath, result);
  }
}

/**
 * Parse a `_category_.json` file into a {@link CategoryMeta}. Returns
 * `undefined` on any error (missing file, malformed JSON, wrong shape) —
 * the builder treats absence as "no metadata for this directory" rather
 * than crashing the whole build over a stray comma.
 */
function readCategoryFile(filePath: string): CategoryMeta | undefined {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const obj = parsed as Record<string, unknown>;
  return {
    label: typeof obj["label"] === "string" ? (obj["label"] as string) : undefined,
    position:
      typeof obj["position"] === "number" ? (obj["position"] as number) : undefined,
    description:
      typeof obj["description"] === "string"
        ? (obj["description"] as string)
        : undefined,
    sortOrder:
      obj["sortOrder"] === "asc" || obj["sortOrder"] === "desc"
        ? (obj["sortOrder"] as "asc" | "desc")
        : undefined,
    noPage: obj["noPage"] === true ? true : undefined,
  };
}
