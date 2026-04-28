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
// Fallback strategy: see pages/lib/locale-merge.ts for full details.
//   Locale docs take priority; base docs fill in missing slugs.
//   Build tag map; emit one route per (locale, tag) pair.

import { mergeLocaleDocs } from "../../../lib/locale-merge";
import { collectTags } from "@/utils/tags";
import type { TagInfo } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import { t } from "@/config/i18n";
import { withBase, docsUrl } from "@/utils/base";
import { settings } from "@/config/settings";
import { DocLayoutWithDefaults } from "@zudo-doc/zudo-doc-v2/doclayout";
import { Breadcrumb } from "@zudo-doc/zudo-doc-v2/breadcrumb";
import type { BreadcrumbItem } from "@zudo-doc/zudo-doc-v2/breadcrumb";
import { DocCardGrid } from "@zudo-doc/zudo-doc-v2/nav-indexing";
import type { JSX } from "preact";

export const frontmatter = { title: "Tag" };

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
