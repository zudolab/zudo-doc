/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Port of src/pages/[locale]/docs/tags/[tag].astro → zfb page module.
//
// Non-default-locale per-tag detail page. paths() enumerates every
// (locale, tag) combination across all non-default locales defined in
// settings.locales, using the same locale-first + base-fallback merge
// strategy as the Astro original.
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { locale: string; tag: string }
//   props:  { tagInfo: TagInfo }
//
// Fallback strategy (mirrors [locale]/docs/tags/index.tsx):
//   1. Collect docs from `docs-${locale}` collection.
//   2. Collect base "docs" collection.
//   3. Merge: locale docs take priority; base docs fill in missing slugs.
//   4. Build tag map; emit one route per (locale, tag) pair.

import { getCollection } from "zfb/content";
import { collectTags } from "@/utils/tags";
import type { TagInfo } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import { t } from "@/config/i18n";
import { withBase, docsUrl } from "@/utils/base";
import { settings } from "@/config/settings";
import type { DocsEntry } from "@/types/docs-entry";
import { DocLayoutWithDefaults } from "@zudo-doc/zudo-doc-v2/doclayout";
import { Breadcrumb } from "@zudo-doc/zudo-doc-v2/breadcrumb";
import type { BreadcrumbItem } from "@zudo-doc/zudo-doc-v2/breadcrumb";
import { DocCardGrid } from "@zudo-doc/zudo-doc-v2/nav-indexing";
import type { JSX } from "preact";

export const frontmatter = { title: "Tag" };

/**
 * Merge locale docs with base-locale fallbacks.
 * Locale docs take priority; base docs fill in slugs not covered by the
 * locale collection. Mirrors the non-default-locale branch of tag-nav.astro.
 */
function mergeLocaleDocs(locale: string): DocsEntry[] {
  const localeDocs = getCollection(`docs-${locale}`) as unknown as DocsEntry[];
  const baseDocs = getCollection("docs") as unknown as DocsEntry[];

  const filteredLocale = localeDocs.filter(
    (d) => !d.data.draft && !d.data.unlisted,
  );
  const filteredBase = baseDocs.filter(
    (d) => !d.data.draft && !d.data.unlisted,
  );

  const localeSlugSet = new Set(
    filteredLocale.map((d) => d.data.slug ?? toRouteSlug(d.id)),
  );

  return [
    ...filteredLocale,
    ...filteredBase.filter(
      (d) => !localeSlugSet.has(d.data.slug ?? toRouteSlug(d.id)),
    ),
  ];
}

/** One route per (non-default locale, tag) pair. */
export function paths(): Array<{
  params: { locale: string; tag: string };
  props: { tagInfo: TagInfo };
}> {
  const result: Array<{
    params: { locale: string; tag: string };
    props: { tagInfo: TagInfo };
  }> = [];

  for (const locale of Object.keys(settings.locales)) {
    const docs = mergeLocaleDocs(locale);
    const tagMap = collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));

    for (const [tag, tagInfo] of tagMap.entries()) {
      result.push({
        params: { locale, tag },
        props: { tagInfo },
      });
    }
  }

  return result;
}

interface PageProps {
  params: { locale: string; tag: string };
  props: { tagInfo: TagInfo };
}

export default function LocaleDocTagPage({
  params,
  props,
}: PageProps): JSX.Element {
  const { locale, tag } = params;
  const { tagInfo } = props;

  const countText =
    tagInfo.count === 1
      ? t("doc.pageCountSingle", locale).replace("{count}", String(tagInfo.count))
      : t("doc.pageCount", locale).replace("{count}", String(tagInfo.count));

  const pageTitle = `${t("doc.taggedWith", locale)}: ${tag}`;

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Docs" },
    {
      label: t("doc.allTags", locale),
      href: withBase(`/${locale}/docs/tags`),
    },
    { label: tag },
  ];

  const cardItems = tagInfo.docs.map((doc) => ({
    href: docsUrl(doc.slug, locale),
    title: doc.title,
    description: doc.description,
  }));

  return (
    <DocLayoutWithDefaults
      title={pageTitle}
      lang={locale}
      hideSidebar={true}
      hideToc={true}
      breadcrumbOverride={<Breadcrumb items={breadcrumbItems} />}
    >
      <h1 class="text-heading font-bold mb-vsp-xs">{pageTitle}</h1>
      <p class="text-muted mb-vsp-lg">{countText}</p>
      <DocCardGrid ariaLabel={pageTitle} items={cardItems} />
    </DocLayoutWithDefaults>
  );
}
