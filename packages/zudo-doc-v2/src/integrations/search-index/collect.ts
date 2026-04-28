// Pure entry-collection logic for the search index.
//
// `collectSearchEntries` is the single source of truth shared by the
// build emitter and the dev middleware — keeping the walk in one place
// guarantees `pnpm dev` and `pnpm build` produce the same JSON shape.

import { resolve } from "node:path";
import {
  collectMdFiles,
  isExcluded,
  parseMarkdownFile,
  slugToUrl,
  stripMarkdown,
} from "./content-files";
import {
  MAX_BODY_LENGTH,
  type SearchIndexConfig,
  type SearchIndexEntry,
} from "./types";

function truncateBody(text: string): string {
  return text.length > MAX_BODY_LENGTH
    ? text.substring(0, MAX_BODY_LENGTH)
    : text;
}

/** Build search index entries for a single content directory. */
function buildEntries(
  contentDir: string,
  locale: string | null,
  base: string,
): SearchIndexEntry[] {
  const absDir = resolve(contentDir);
  const files = collectMdFiles(absDir);
  const entries: SearchIndexEntry[] = [];

  for (const { filePath, slug } of files) {
    const parsed = parseMarkdownFile(filePath);
    if (!parsed) continue;
    const { data, content } = parsed;

    if (isExcluded(data)) continue;

    const id = locale ? `${locale}/${slug}` : slug;
    entries.push({
      id,
      title: data.title ?? slug,
      body: truncateBody(stripMarkdown(content)),
      url: slugToUrl(slug, locale, base),
      description: data.description ?? "",
    });
  }

  return entries;
}

/**
 * Collect every search-index entry across the default locale plus all
 * configured non-default locales. The traversal order matches today's
 * Astro integration: default locale first, then locales in the iteration
 * order of the `locales` map. Downstream consumers should not rely on
 * order beyond that, but keep it stable for diff-friendly builds.
 */
export function collectSearchEntries(
  config: SearchIndexConfig,
): SearchIndexEntry[] {
  const base = config.base ?? "";
  const entries: SearchIndexEntry[] = [];

  entries.push(...buildEntries(config.docsDir, null, base));

  if (config.locales) {
    for (const [code, locale] of Object.entries(config.locales)) {
      entries.push(...buildEntries(locale.dir, code, base));
    }
  }

  return entries;
}
