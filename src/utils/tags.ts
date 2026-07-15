// Host thin-stub — see @takazudo/zudo-doc/tag-helpers (epic #2344, S7).
//
// `resolveTag` and `resolvePageTags` are now parameterized pure functions in the
// package; this module remains backward-compatible by wrapping them with the
// host's `settings.tagVocabulary` / `settings.tagGovernance` + the
// `tagVocabulary` entries from `@/config/tag-vocabulary`.
//
// `collectTags` stays host-side for current zfb entry typing. It accepts current
// entries and delegates exact-id recognition to the package.

import type { DocPageEntry } from "@takazudo/zudo-doc/doc-page-props";
import { settings } from "@/config/settings";
import { tagVocabulary } from "@/config/tag-vocabulary";
import {
  resolveTag as _resolveTag,
  resolvePageTags as _resolvePageTags,
} from "@takazudo/zudo-doc/tag-helpers";

export type { ResolvedTag } from "@takazudo/zudo-doc/tag-helpers";

export interface TagInfo {
  tag: string;
  count: number;
  docs: { slug: string; title: string; description?: string }[];
}

// Helpers that pass the host's settings + vocabulary entries to the package fns.
function getVocab() {
  return settings.tagVocabulary ? tagVocabulary : false;
}

/**
 * Resolve a raw tag string to its canonical form.
 *
 * Thin wrapper around `@takazudo/zudo-doc/tag-helpers` `resolveTag` that
 * injects the host's tag vocabulary and governance settings.
 */
export function resolveTag(raw: string) {
  return _resolveTag(raw, getVocab(), settings.tagGovernance);
}

/**
 * Resolve a list of raw tag strings (e.g. from frontmatter), preserving order
 * and removing exact duplicates.
 */
export function resolvePageTags(rawTags: readonly string[]): string[] {
  return _resolvePageTags(rawTags, getVocab(), settings.tagGovernance);
}

export function collectTags(
  entries: DocPageEntry[],
  slugFn: (entrySlug: string, data: { slug?: string }) => string,
): Map<string, TagInfo> {
  const tagMap = new Map<string, TagInfo>();

  for (const entry of entries) {
    const rawTags = entry.data.tags ?? [];
    const slug = slugFn(entry.slug, entry.data);

    const seen = new Set<string>();
    for (const raw of rawTags) {
      const resolved = resolveTag(raw);
      if (seen.has(resolved.canonical)) continue;
      seen.add(resolved.canonical);

      if (!tagMap.has(resolved.canonical)) {
        tagMap.set(resolved.canonical, { tag: resolved.canonical, count: 0, docs: [] });
      }
      const info = tagMap.get(resolved.canonical)!;
      info.count++;
      info.docs.push({
        slug,
        title: entry.data.title,
        description: entry.data.description,
      });
    }
  }

  return tagMap;
}
