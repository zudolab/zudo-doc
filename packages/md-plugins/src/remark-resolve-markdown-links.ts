import type { Root, Link, Definition, Node } from "mdast";
import { visit } from "unist-util-visit";
import { resolve, dirname } from "node:path";
import { buildDocsSourceMap, type DocsSourceMapOptions } from "./docs-source-map";
import { isExternal } from "./url-utils";

export interface ResolveMarkdownLinksOptions extends DocsSourceMapOptions {
  /** Behavior on broken links: 'warn' (default), 'error', 'ignore' */
  onBrokenLinks?: "warn" | "error" | "ignore";
  /**
   * Pre-built source map to use instead of building one at plugin-call time.
   *
   * Pass a shared `Map<string, string>` (built once via `buildDocsSourceMap`)
   * to avoid repeated fs walks when the same options are used across many
   * transformed files (e.g. a full build). When provided, `buildDocsSourceMap`
   * is never called inside the plugin's per-file transform function.
   *
   * If omitted, the plugin falls back to a module-level cache keyed on the
   * options signature (rootDir + docsDir + locales + versions + base +
   * trailingSlash) so repeated calls with identical options still only trigger
   * one fs walk — no explicit sharing is required for typical build usage.
   */
  sourceMap?: Map<string, string>;
}

// ---------------------------------------------------------------------------
// Module-level source-map cache (one fs walk per unique options signature)
// ---------------------------------------------------------------------------

// Keyed on a JSON-serialized canonical options signature so the same config
// always hits the same cache entry. The cache intentionally lives for the
// lifetime of the process (no TTL) — a new process starts for each build, and
// during dev the user explicitly re-runs the file watcher or build command.
const sourceMapCache = new Map<string, Map<string, string>>();

function optionsCacheKey(opts: DocsSourceMapOptions): string {
  return JSON.stringify({
    rootDir: opts.rootDir,
    docsDir: opts.docsDir,
    locales: opts.locales,
    versions: opts.versions,
    base: opts.base,
    trailingSlash: opts.trailingSlash,
  });
}

function cachedSourceMap(opts: DocsSourceMapOptions): Map<string, string> {
  const key = optionsCacheKey(opts);
  const cached = sourceMapCache.get(key);
  if (cached) return cached;
  const built = buildDocsSourceMap(opts);
  sourceMapCache.set(key, built);
  return built;
}

/** Check if pathname has a markdown (.md / .mdx) extension. */
function hasMarkdownExtension(pathname: string): boolean {
  return /\.mdx?$/.test(pathname);
}

/** Parse a URL into pathname, search, and hash parts */
function parseUrl(url: string): {
  pathname: string;
  search: string;
  hash: string;
} {
  const hashIdx = url.indexOf("#");
  const searchIdx = url.indexOf("?");

  let pathname = url;
  let search = "";
  let hash = "";

  if (hashIdx >= 0) {
    hash = url.slice(hashIdx);
    pathname = url.slice(0, hashIdx);
  }
  if (searchIdx >= 0 && (hashIdx < 0 || searchIdx < hashIdx)) {
    search = hash ? url.slice(searchIdx, hashIdx) : url.slice(searchIdx);
    pathname = url.slice(0, searchIdx);
  }

  return { pathname, search, hash };
}

/**
 * Build candidate source-file paths for an extensionless URL.
 * Tries ".mdx" / ".md" suffixes first, then index pages for
 * directory-style links such as "./guide/".
 */
function extensionlessCandidates(basePath: string): string[] {
  return [
    `${basePath}.mdx`,
    `${basePath}.md`,
    `${basePath}/index.mdx`,
    `${basePath}/index.md`,
  ];
}

export function remarkResolveMarkdownLinks(
  options: ResolveMarkdownLinksOptions,
) {
  const onBrokenLinks = options.onBrokenLinks ?? "warn";

  return (tree: Root, file: { path?: string }) => {
    // Use caller-supplied map → module-level cache → fresh build (in that order).
    // The cache means one fs walk per unique option signature per process; the
    // caller-supplied path lets integrations share a pre-built map across plugins.
    const sourceMap = options.sourceMap ?? cachedSourceMap(options);

    const currentFilePath = file.path;
    if (!currentFilePath) return;

    const currentDir = dirname(currentFilePath);

    visit(tree, (node: Node) => {
      if (node.type !== "link" && node.type !== "definition") return;
      const linkNode = node as Link | Definition;
      const url = linkNode.url;

      // Skip: no URL, external URLs, pure anchors
      if (!url || isExternal(url) || url.startsWith("#")) return;

      const { pathname, search, hash } = parseUrl(url);

      // Need a non-empty pathname to attempt resolution
      if (!pathname) return;

      let resolvedPath: string | null = null;
      let extensionlessLookup = false;

      if (hasMarkdownExtension(pathname)) {
        // Explicit .md / .mdx link — existing behavior, may warn on miss.
        resolvedPath = resolve(currentDir, pathname);
      } else {
        // Extensionless URL — probe likely source paths. This handles:
        //   - "./dark-mode-strategies"   → dark-mode-strategies.mdx / .md
        //   - "./0.1.0" (dotted slug)    → 0.1.0.mdx / .md
        //   - "./guide/" (dir style)     → guide/index.mdx / .md
        // If nothing matches we leave the link alone — it may legitimately
        // point at a public asset, an absolute route, or a non-doc target.
        extensionlessLookup = true;
        const basePath = resolve(currentDir, pathname);
        for (const candidate of extensionlessCandidates(basePath)) {
          if (sourceMap.has(candidate)) {
            resolvedPath = candidate;
            break;
          }
        }
        if (!resolvedPath) return;
      }

      const resolvedUrl = sourceMap.get(resolvedPath);

      if (resolvedUrl) {
        linkNode.url = resolvedUrl + search + hash;
      } else if (!extensionlessLookup) {
        // Broken link handling — only reached for explicit .md/.mdx links
        // that did not match anything in the source map.
        const fileRelative = file.path ?? "unknown";
        const message = `Broken markdown link: "${url}" in ${fileRelative} (resolved to ${resolvedPath})`;

        if (onBrokenLinks === "error") {
          throw new Error(message);
        } else if (onBrokenLinks === "warn") {
          console.warn(`[md-plugins] WARNING: ${message}`);
        }
        // 'ignore' — do nothing
      }
    });
  };
}
