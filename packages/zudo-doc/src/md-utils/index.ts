// Shared markdown content-file utilities for the build-time integrations.
//
// Single source of truth (zudo-doc#2024) for the helpers that previously
// lived as near-verbatim copies in `integrations/search-index/content-files.ts`
// and `integrations/llms-txt/load.ts` / `strip.ts`, each carrying a
// "keep in sync" comment. Internal module — not exposed on the package's
// exports map; consumers go through the integration entry points.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";

/**
 * Frontmatter fields the integrations read off each MDX/MD file. Extra
 * keys pass through via the index signature. Mirrors the host project's
 * docs schema (`src/config/docs-schema.ts`) for the fields listed here.
 */
export interface MdDocFrontmatter {
  title?: string;
  description?: string;
  /**
   * Route-slug override (docs-schema `slug:`). The route layer resolves
   * `data.slug ?? toRouteSlug(id)`, so every consumer that derives a URL
   * must apply the same `data.slug ?? filesystemSlug` fallback at its
   * call site — otherwise links to overridden pages 404. Deliberately NOT
   * folded into {@link slugToUrl}: the effective slug is computed where
   * the frontmatter is in scope and passed through.
   */
  slug?: string;
  sidebar_position?: number;
  draft?: boolean;
  unlisted?: boolean;
  /** `true` when the page is excluded from search and llms.txt indexing. */
  search_exclude?: boolean;
  /**
   * A `category_no_page` index.mdx carries category metadata only and builds
   * no route — so it must NOT be indexed or linked (the link would 404).
   * Mirrors the route/sitemap exclusion in the host project.
   */
  category_no_page?: boolean;
  [key: string]: unknown;
}

/**
 * Strip markdown formatting to plain text. Conservative-by-design — the
 * regex pipeline matches the legacy Astro integrations byte-for-byte so
 * search excerpts and llms-txt descriptions stay byte-equal across the
 * cutover, with one deliberate divergence: it also strips JSX/MDX block
 * comments (the `{/*`-delimited MDX comment form), which the legacy
 * pipeline leaked into descriptions (zudo-doc#2175). Do not add other new
 * rules without also updating the byte-equality fixtures (topic-plugin-audit).
 */
export function stripMarkdown(md: string): string {
  return (
    md
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]+`/g, "")
      // Remove JSX/MDX block comments ({/* ... */}) — they never render to
      // users in MDX, so a leading comment must not become a page's fallback
      // description (zudo-doc#2175). Runs before the HTML-tag rule so the
      // braces aren't left behind.
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
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

/**
 * Walk `dir` recursively and return every `*.md` / `*.mdx` file's
 * absolute path together with its filesystem-derived slug. Files (or
 * whole directories) whose name starts with `_` are skipped, matching
 * the Content Collections convention (and zfb's routing): docs under
 * them are not built as pages, so emitting them would yield entries
 * whose links 404.
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
        if (entry.name.startsWith("_")) continue;
        walk(fullPath, baseDir);
      } else if (/\.mdx?$/.test(entry.name) && !entry.name.startsWith("_")) {
        // Canonical route slug (zudo-doc#1891): nested `x/index` → `x` AND
        // bare root `index` → "" so the entry links to `/docs/` (the built
        // page) instead of `/docs/index/` (which is never built). The host
        // route, sitemap, search-index and llms-txt all canonicalize the
        // same way; see src/utils/slug.ts `toRouteSlug` in the consuming
        // repo (the one rule).
        const rel = relative(baseDir, fullPath)
          .replace(/\.mdx?$/, "")
          .replace(/\/index$/, "")
          .replace(/^index$/, "");
        results.push({ filePath: fullPath, slug: rel });
      }
    }
  }

  walk(dir, dir);
  return results;
}

/**
 * Compute a docs URL for a given slug + locale, honouring `base`. When
 * `siteUrl` is empty/omitted the URL is path-only; when set, a fully
 * qualified URL is produced (matching the legacy llms-txt emitter's
 * `slugToUrl(slug, locale, true)` call site exactly).
 *
 * Callers must pass the EFFECTIVE slug (`data.slug ?? filesystem slug`) —
 * the frontmatter override is resolved at the call site, not here.
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

/**
 * Parse a markdown file into frontmatter + body. Returns `null` when
 * the file is unreadable so callers can simply skip it.
 */
export function parseMarkdownFile(
  filePath: string,
): { data: MdDocFrontmatter; content: string } | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = matter(raw);
    return { data: parsed.data as MdDocFrontmatter, content: parsed.content };
  } catch {
    return null;
  }
}

/**
 * A page is excluded from indexing when explicitly opted out, drafted,
 * unlisted, or a `category_no_page` metadata-only category index (no
 * built route to link to).
 */
export function isExcluded(data: MdDocFrontmatter): boolean {
  return Boolean(
    data.search_exclude ||
      data.draft ||
      data.unlisted ||
      data.category_no_page,
  );
}
