// Self-contained content-file utilities for the search-index integration.
//
// These mirror the equivalents in `src/utils/content-files.ts` from the
// Astro tree, but the v2 port deliberately keeps them local: zudo-doc-v2
// must not reach into the host Astro project's `src/utils` once the
// repository flips to zfb. When the broader content-pipeline port lands
// (topic-plugin-audit / topic-schema), these helpers can be promoted to a
// shared subpath without disturbing the integration's public surface.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";

/**
 * Strip markdown formatting to plain text. Conservative-by-design — the
 * regex pipeline is identical to today's Astro integration so search
 * excerpts stay byte-equal across the cutover. Do not add new rules
 * without also updating the byte-equality fixtures (topic-plugin-audit).
 */
export function stripMarkdown(md: string): string {
  return (
    md
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]+`/g, "")
      // Remove HTML tags
      .replace(/<[^>]+>/g, "")
      // Remove headings markers
      .replace(/^#{1,6}\s+/gm, "")
      // Remove emphasis/bold markers
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
      .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
      // Remove images (must run before link removal)
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove blockquote markers
      .replace(/^>\s+/gm, "")
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // Remove list markers
      .replace(/^[\s]*[-*+]\s+/gm, "")
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // Remove import statements
      .replace(/^import\s+.*$/gm, "")
      // Remove export statements
      .replace(/^export\s+.*$/gm, "")
      // Collapse whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Walk a directory recursively and collect all `.md`/`.mdx` files. */
export function collectMdFiles(
  dir: string,
): Array<{ filePath: string; slug: string }> {
  const results: Array<{ filePath: string; slug: string }> = [];

  function walk(currentDir: string, baseDir: string): void {
    let entries;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, baseDir);
      } else if (/\.mdx?$/.test(entry.name) && !entry.name.startsWith("_")) {
        const rel = relative(baseDir, fullPath)
          .replace(/\.mdx?$/, "")
          .replace(/\/index$/, "");
        results.push({ filePath: fullPath, slug: rel });
      }
    }
  }

  walk(dir, dir);
  return results;
}

/** Compute the site-relative URL for a slug + locale, honouring `base`. */
export function slugToUrl(slug: string, locale: string | null, base: string): string {
  const normalizedBase = base.replace(/\/$/, "");
  return locale
    ? `${normalizedBase}/${locale}/docs/${slug}`
    : `${normalizedBase}/docs/${slug}`;
}

/** Frontmatter fields the integration cares about. Extra keys pass through. */
export interface DocFrontmatter {
  title?: string;
  description?: string;
  draft?: boolean;
  unlisted?: boolean;
  search_exclude?: boolean;
  [key: string]: unknown;
}

/** Parse a markdown file. Returns null when the file cannot be read. */
export function parseMarkdownFile(
  filePath: string,
): { data: DocFrontmatter; content: string } | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    return matter(raw);
  } catch {
    return null;
  }
}

/** A page is excluded from indexing when explicitly opted out, drafted, or unlisted. */
export function isExcluded(data: DocFrontmatter): boolean {
  return !!(data.search_exclude || data.draft || data.unlisted);
}
