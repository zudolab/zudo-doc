import type { Root, Link, Definition, Node } from "mdast";
import { visit } from "unist-util-visit";
import { resolve, dirname } from "node:path";
import { buildDocsSourceMap, type DocsSourceMapOptions } from "./docs-source-map";

export interface ResolveMarkdownLinksOptions extends DocsSourceMapOptions {
  /** Behavior on broken links: 'warn' (default), 'error', 'ignore' */
  onBrokenLinks?: "warn" | "error" | "ignore";
}

/** Check if a URL is external */
function isExternal(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url);
}

/** Check if URL has a markdown extension */
function hasMarkdownExtension(url: string): boolean {
  // Extract pathname (before ? or #)
  const pathname = url.split(/[?#]/)[0];
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

export function remarkResolveMarkdownLinks(
  options: ResolveMarkdownLinksOptions,
) {
  let sourceMap: Map<string, string> | null = null;
  const onBrokenLinks = options.onBrokenLinks ?? "warn";

  return (tree: Root, file: { path?: string }) => {
    // Build source map lazily on first call
    if (!sourceMap) {
      sourceMap = buildDocsSourceMap(options);
    }

    const currentFilePath = file.path;
    if (!currentFilePath) return;

    const currentDir = dirname(currentFilePath);

    visit(tree, (node: Node) => {
      if (node.type !== "link" && node.type !== "definition") return;
      const linkNode = node as Link | Definition;
      const url = linkNode.url;

      // Skip: no URL, external URLs, pure anchors, non-markdown links
      if (
        !url ||
        isExternal(url) ||
        url.startsWith("#") ||
        !hasMarkdownExtension(url)
      )
        return;

      const { pathname, search, hash } = parseUrl(url);

      // Resolve the file path relative to current file
      const resolvedPath = resolve(currentDir, pathname);

      // Look up in source map
      const resolvedUrl = sourceMap!.get(resolvedPath);

      if (resolvedUrl) {
        linkNode.url = resolvedUrl + search + hash;
      } else {
        // Broken link handling
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
