/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// doc-tags-area — factory for the locale-aware DocTags area wrapper
// (epic #2344, S7).
//
// The host's `pages/lib/_doc-tags-area.tsx` previously read
// `settings.docTags`, `defaultLocale`, and called `resolvePageTags`
// (which itself read `settings.tagVocabulary/tagGovernance` at module scope).
// This factory receives all these as injected dependencies.

import type { VNode } from "preact";
import { DocTags } from "../metainfo/index.js";
import type { TagVocabularyEntry, TagGovernanceMode } from "../settings.js";
import { resolvePageTags } from "../tag-helpers/index.js";

/** Settings subset read by the DocTagsArea factory. */
export interface DocTagsAreaSettings {
  docTags: boolean;
  tagVocabulary: boolean | readonly TagVocabularyEntry[];
  tagGovernance: TagGovernanceMode;
}

/** Dependencies injected by the host stub. */
export interface DocTagsAreaDeps {
  settings: DocTagsAreaSettings;
  /** Default locale code (e.g. "en"). */
  defaultLocale: string;
  /** Tag vocabulary entries (from the host's `@/config/tag-vocabulary`). */
  tagVocabularyEntries: readonly TagVocabularyEntry[];
  /**
   * Build the base-prefixed tag detail page href for the given tag and locale.
   * Host passes a pre-bound function using `withBase` and `defaultLocale`.
   */
  tagHref: (tag: string, locale: string) => string;
  /** Translate a UI string key for a locale. */
  t: (key: string, locale: string) => string;
}

export interface DocTagsAreaProps {
  /** Page slug, e.g. "guides/sidebar". */
  slug: string;
  /** Active locale string, e.g. "en", "ja". */
  locale: string;
  /** Raw tag strings from the page frontmatter (entry.data.tags). */
  tags: readonly string[] | undefined;
}

/**
 * Create a `DocTagsArea` component bound to the host's settings and
 * injected dependencies.
 */
export function createDocTagsArea(
  deps: DocTagsAreaDeps,
): (props: DocTagsAreaProps) => VNode | null {
  const { settings, tagVocabularyEntries, tagHref, t } = deps;

  function DocTagsArea({ locale, tags }: DocTagsAreaProps): VNode | null {
    if (!settings.docTags) return null;

    const rawTags = tags ?? [];
    // Resolve using the parameterized helper — settings.tagVocabulary controls
    // whether the vocabulary is active; we pass the actual entries separately.
    const vocab = settings.tagVocabulary ? tagVocabularyEntries : false;
    const canonicalTags = resolvePageTags(rawTags, vocab, settings.tagGovernance);
    if (canonicalTags.length === 0) return null;

    const resolvedTags = canonicalTags.map((tag) => ({
      tag,
      href: tagHref(tag, locale),
    }));

    return (
      <DocTags
        placement="after-title"
        tags={resolvedTags}
        tagsLabel={t("doc.tags", locale)}
        taggedWithLabel={t("doc.taggedWith", locale)}
      />
    );
  }

  return DocTagsArea;
}
