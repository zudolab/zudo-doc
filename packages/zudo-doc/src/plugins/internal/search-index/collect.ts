// Pure entry-collection logic for the search index.
//
// `collectSearchEntries` is the single source of truth shared by the
// build emitter and the dev middleware — keeping the walk in one place
// guarantees `pnpm dev` and `pnpm build` produce the same JSON shape.

import { closeSync, openSync, readSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
  collectMdFiles,
  isExcluded,
  parseMarkdownFile,
  slugToUrl,
  stripMarkdown,
} from "../../../md-utils/index.js";
import { collectAssetPageDescriptors } from "../asset-viewer/asset-pages.js";
import {
  MAX_BODY_LENGTH,
  type SearchIndexConfig,
  type SearchIndexEntry,
} from "./types.js";

function truncateBody(text: string): string {
  return text.length > MAX_BODY_LENGTH
    ? text.substring(0, MAX_BODY_LENGTH)
    : text;
}

/** Read enough UTF-8 bytes to produce the frozen 300-code-unit excerpt. */
function readAssetExcerpt(filePath: string): string {
  // A Unicode scalar needs at most four UTF-8 bytes. Reading four bytes per
  // output code unit keeps this bounded even for very large public text files,
  // while leaving enough complete input before any partial trailing sequence.
  const sample = Buffer.allocUnsafe(MAX_BODY_LENGTH * 4);
  const fd = openSync(filePath, "r");
  try {
    let offset = 0;
    while (offset < sample.length) {
      const bytesRead = readSync(
        fd,
        sample,
        offset,
        sample.length - offset,
        offset,
      );
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    return truncateBody(sample.subarray(0, offset).toString("utf8"));
  } finally {
    closeSync(fd);
  }
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

  for (const { filePath, slug: fileSlug } of files) {
    const parsed = parseMarkdownFile(filePath);
    if (!parsed) continue;
    const { data, content } = parsed;

    if (isExcluded(data)) continue;

    // Honor the frontmatter `slug:` override the same way the route layer
    // does (`data.slug ?? toRouteSlug(id)`) — otherwise the search result
    // links at the filesystem path, which 404s for overridden pages.
    const slug = data.slug ?? fileSlug;
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

/** Build search entries for the asset-viewer pages that actually exist. */
function buildAssetEntries(config: SearchIndexConfig): SearchIndexEntry[] {
  const { assetScan, projectRoot } = config;
  if (assetScan === undefined || projectRoot === undefined) return [];

  const descriptors = collectAssetPageDescriptors({
    projectRoot,
    assetScan,
    consumer: "search",
  });
  const assetRoot = resolve(projectRoot, "public", assetScan.assetViewerDir);

  return descriptors.map((descriptor) => {
    const localePrefix = descriptor.locale === undefined ? "" : `${descriptor.locale}/`;
    const body = descriptor.isText
      ? readAssetExcerpt(resolve(assetRoot, descriptor.path))
      : "";

    return {
      id: `asset:${localePrefix}${assetScan.assetViewerRoutePrefix}/${descriptor.path}`,
      title: basename(descriptor.path),
      body,
      url: descriptor.url,
      description: descriptor.path,
    };
  });
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

  entries.push(...buildAssetEntries(config));

  return entries;
}
