/**
 * Filesystem loader for llms-txt content. Walks a markdown content root,
 * parses frontmatter via `gray-matter`, and emits sorted
 * {@link LlmsDocEntry} records ready for the generator stage.
 *
 * Lives in the framework layer (no `@/...` imports) so any consumer
 * project — Astro today, zfb tomorrow, fixture-driven unit tests in
 * between — can drive the emitter without dragging in the legacy
 * `src/utils/content-files.ts` module.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import matter from "gray-matter";

import { stripImportsAndJsx, stripMarkdown } from "./strip.ts";
import type {
  LlmsDocEntry,
  LlmsTxtFrontmatter,
  LlmsTxtLoadOptions,
} from "./types.ts";

/**
 * Walk `dir` recursively and return every `*.md` / `*.mdx` file's
 * absolute path together with its docs-relative slug. Files (or whole
 * directories) whose name starts with `_` are skipped, matching the
 * Content Collections convention.
 */
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

/**
 * Compute a docs URL for a given slug + locale. Mirrors the legacy
 * `slugToUrl(slug, locale, true)` call site exactly: when `siteUrl` is
 * empty, the URL is path-only; when `siteUrl` is set, a fully qualified
 * URL is produced.
 */
export function slugToUrl(
  slug: string,
  locale: string | null,
  base: string,
  siteUrl?: string,
): string {
  const trimmedBase = base.replace(/\/$/, "");
  const path = locale
    ? `${trimmedBase}/${locale}/docs/${slug}`
    : `${trimmedBase}/docs/${slug}`;
  if (siteUrl) {
    return `${siteUrl.replace(/\/$/, "")}${path}`;
  }
  return path;
}

/** Whether a given doc should be excluded from the llms.txt index. */
export function isExcluded(data: LlmsTxtFrontmatter): boolean {
  return Boolean(data.search_exclude || data.draft || data.unlisted);
}

/**
 * Parse a markdown file into frontmatter + body. Returns `null` when
 * the file is unreadable so callers can simply skip it.
 */
export function parseMarkdownFile(
  filePath: string,
): { data: LlmsTxtFrontmatter; content: string } | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = matter(raw);
    return { data: parsed.data as LlmsTxtFrontmatter, content: parsed.content };
  } catch {
    return null;
  }
}

/**
 * Build the sorted {@link LlmsDocEntry} list for a single content root.
 * Excluded pages (draft / unlisted / search_exclude) are dropped.
 * Entries are sorted ascending by `sidebar_position`; entries without a
 * position go last (they share `Number.MAX_SAFE_INTEGER`, and
 * `Array.prototype.sort` is stable in V8 so ties keep filesystem
 * traversal order — same as the legacy emitter).
 */
export function loadDocEntries(options: LlmsTxtLoadOptions): LlmsDocEntry[] {
  const { contentDir, locale, base, siteUrl } = options;
  const absDir = resolve(contentDir);
  const files = collectMdFiles(absDir);
  const entries: LlmsDocEntry[] = [];

  for (const { filePath, slug } of files) {
    const parsed = parseMarkdownFile(filePath);
    if (!parsed) continue;
    const { data, content } = parsed;

    if (isExcluded(data)) continue;

    let description = data.description ?? "";
    if (!description) {
      const stripped = stripMarkdown(content);
      description = stripped.split("\n").find((l) => l.trim().length > 0) ?? "";
    }

    entries.push({
      title: data.title ?? slug,
      description,
      url: slugToUrl(slug, locale, base, siteUrl),
      content: stripImportsAndJsx(content),
      sidebarPosition: data.sidebar_position,
    });
  }

  entries.sort((a, b) => {
    const posA = a.sidebarPosition ?? Number.MAX_SAFE_INTEGER;
    const posB = b.sidebarPosition ?? Number.MAX_SAFE_INTEGER;
    return posA - posB;
  });

  return entries;
}
