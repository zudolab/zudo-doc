/**
 * Synchronous reader for `_category_.json` files. Walks a directory tree
 * and returns a map of `<relative-dir-path>` → {@link CategoryMeta}.
 *
 * Lives in this folder rather than reusing the project's existing
 * `loadCategoryMeta` because the framework-layer must not import anything
 * from the consumer project (`@/utils/...`). Behaviour is intentionally
 * identical to the original so call sites can swap implementations 1:1.
 */
import type { CategoryMeta } from "./types.js";

const cache = new Map<string, Map<string, CategoryMeta>>();

/** Structural stand-in for `fs.Dirent` — only the members this module reads. */
interface DirEntry {
  isDirectory(): boolean;
  name: string;
}

interface FsBuiltin {
  readdirSync(dir: string, options: { withFileTypes: true }): DirEntry[];
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: "utf-8"): string;
}

interface PathBuiltin {
  resolve(...segments: string[]): string;
  join(...segments: string[]): string;
  relative(from: string, to: string): string;
}

interface Builtins {
  fs: FsBuiltin;
  path: PathBuiltin;
}

/**
 * Resolve `node:fs`/`node:path` at call time via `process.getBuiltinModule`
 * (Node >= 22.3; CI's setup-node 22 and local dev Node 24 both satisfy this)
 * instead of top-level `import fs from "node:fs"`. This was this module's
 * only static `node:*` import in the chrome render graph (#3394 companion 2).
 *
 * IMPORTANT — mechanism change vs. the old degrade path (#2030): the legacy
 * static-import version relied on zfb's SSG runtime *stubbing the `node:fs`/
 * `node:path` import specifiers themselves* — any property access on the
 * stub threw, so `loadCategoryMeta` silently fell back to an empty map.
 * `process.getBuiltinModule` does not go through specifier resolution at
 * all — it asks the running Node process directly for the real builtin — so
 * it most likely BYPASSES that stub and returns the genuine `fs`/`path`
 * modules even under the SSG runtime, meaning this code may now actually
 * read `_category_.json` from disk at build time where it previously
 * degraded to empty. This is a call-site-level analysis only; it has not
 * been confirmed against a real `pnpm build` output diff (deferred — see
 * PR discussion / issue #3397). The try/catch below is kept as a defensive
 * fallback (older Node without `getBuiltinModule`, or a future stub that
 * targets `process.getBuiltinModule` itself) so the #2030 empty-map
 * degradation still fires if builtins genuinely cannot be resolved.
 */
function resolveBuiltins(): Builtins | undefined {
  const getBuiltinModule = (
    globalThis as {
      process?: { getBuiltinModule?: (id: string) => unknown };
    }
  ).process?.getBuiltinModule;
  if (typeof getBuiltinModule !== "function") return undefined;
  try {
    const fs = getBuiltinModule("node:fs") as FsBuiltin | undefined;
    const path = getBuiltinModule("node:path") as PathBuiltin | undefined;
    if (!fs || !path) return undefined;
    return { fs, path };
  } catch {
    return undefined;
  }
}

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
  const builtins = resolveBuiltins();
  // Builtins unavailable: preserve the #2030 degrade-to-empty-map behaviour
  // verbatim — cache the raw (unresolved) contentDir key, skip the scan, and
  // return an empty map. Routes still enumerate; sidecar meta just doesn't apply.
  let absolute: string;
  try {
    absolute = builtins ? builtins.path.resolve(contentDir) : contentDir;
  } catch {
    absolute = contentDir;
  }
  const cached = cache.get(absolute);
  if (cached) return cached;
  const result = new Map<string, CategoryMeta>();
  if (builtins) {
    scanDir(builtins, absolute, absolute, result);
  }
  cache.set(absolute, result);
  return result;
}

/** Test/HMR escape hatch — clears the per-directory cache. */
export function clearCategoryMetaCache(): void {
  cache.clear();
}

function scanDir(
  builtins: Builtins,
  baseDir: string,
  currentDir: string,
  result: Map<string, CategoryMeta>,
): void {
  const { fs, path } = builtins;
  let entries: DirEntry[];
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
      const meta = readCategoryFile(builtins, categoryFile);
      if (meta) {
        const relativePath = path.relative(baseDir, fullPath);
        result.set(relativePath, meta);
      }
    }
    scanDir(builtins, baseDir, fullPath, result);
  }
}

/**
 * Parse a `_category_.json` file into a {@link CategoryMeta}. Returns
 * `undefined` on any error (missing file, malformed JSON, wrong shape) —
 * the builder treats absence as "no metadata for this directory" rather
 * than crashing the whole build over a stray comma.
 */
function readCategoryFile(builtins: Builtins, filePath: string): CategoryMeta | undefined {
  let raw: string;
  try {
    raw = builtins.fs.readFileSync(filePath, "utf-8");
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
