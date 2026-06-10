/**
 * Filesystem loader for llms-txt content. Walks a markdown content root,
 * parses frontmatter via `gray-matter`, and emits sorted
 * {@link LlmsDocEntry} records ready for the generator stage.
 *
 * The directory walk / frontmatter / URL helpers live in the shared
 * `md-utils` module (one implementation for search-index and llms-txt,
 * zudo-doc#2024); they are re-exported here so the integration's public
 * surface is unchanged.
 */

import { resolve } from "node:path";

import {
  collectMdFiles,
  isExcluded,
  parseMarkdownFile,
  slugToUrl,
  stripMarkdown,
} from "../../md-utils/index.js";
import { stripImportsAndJsx } from "./strip.js";
import type { LlmsDocEntry, LlmsTxtLoadOptions } from "./types.js";

export {
  collectMdFiles,
  isExcluded,
  parseMarkdownFile,
  slugToUrl,
} from "../../md-utils/index.js";

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

  for (const { filePath, slug: fileSlug } of files) {
    const parsed = parseMarkdownFile(filePath);
    if (!parsed) continue;
    const { data, content } = parsed;

    if (isExcluded(data)) continue;

    // Honor the frontmatter `slug:` override the same way the route layer
    // does (`data.slug ?? toRouteSlug(id)`) — otherwise the llms.txt entry
    // links at the filesystem path, which 404s for overridden pages.
    const slug = data.slug ?? fileSlug;

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
