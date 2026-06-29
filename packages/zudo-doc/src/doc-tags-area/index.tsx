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
import type { TagVocabularyEntry, TagGovernanceMode, Settings } from "../settings.js";
import { resolvePageTags } from "../tag-helpers/index.js";
import type { ChromeContext } from "../factory-context/index.js";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";

/** Settings subset read by the DocTagsArea factory. */
export interface DocTagsAreaSettings {
  docTags: boolean;
  tagVocabulary: boolean | readonly TagVocabularyEntry[];
  tagGovernance: TagGovernanceMode;
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
 * Create a `DocTagsArea` component from the unified {@link ChromeContext}
 * (epic Collapse Wiring Shells #2420, FACTORIES #2424 — breaking signature).
 *
 * Reads `settings`/`t`/`withBase`/`defaultLocale` off the context; the tag
 * vocabulary is a HOST-bound slot (`ctx.hostBindings.tagVocabulary`, default
 * `[]`); `tagHref` is reconstructed inline (identical to the pre-collapse wiring).
 */
export function createDocTagsArea<S extends Settings = Settings>(
  ctx: ChromeContext<S>,
): (props: DocTagsAreaProps) => VNode | null {
  assertChromeContext(ctx, "createDocTagsArea");
  const settings = ctx.settings as unknown as DocTagsAreaSettings;
  const defaultLocale = ctx.defaultLocale;
  const withBase = ctx.withBase;
  const tagVocabularyEntries = (ctx.hostBindings.tagVocabulary ??
    []) as readonly TagVocabularyEntry[];
  const tagHref = (tag: string, locale: string): string => {
    const encoded = encodeURIComponent(tag);
    return withBase(
      locale === defaultLocale
        ? `/docs/tags/${encoded}`
        : `/${locale}/docs/tags/${encoded}`,
    );
  };
  const t = ctx.t;

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
