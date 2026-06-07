/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the locale-prefixed per-tag detail route.
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
import { loadDocs } from "../../../_data";
import { collectTags } from "@/utils/tags";
import type { TagInfo } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import { t } from "@/config/i18n";
import { withBase, docsUrl } from "@/utils/base";
import { settings } from "@/config/settings";
import { DocLayoutWithDefaults } from "@takazudo/zudo-doc/doclayout";
import { Breadcrumb } from "@takazudo/zudo-doc/breadcrumb";
import type { BreadcrumbItem } from "@takazudo/zudo-doc/breadcrumb";
import { DocCardGrid } from "@takazudo/zudo-doc/nav-indexing";
import type { JSX } from "preact";
import { FooterWithDefaults } from "../../../lib/_footer-with-defaults";
import { HeaderWithDefaults } from "../../../lib/_header-with-defaults";
import { HeadWithDefaults } from "../../../lib/_head-with-defaults";
import { composeMetaTitle } from "../../../lib/_compose-meta-title";
import { DocHistoryArea } from "../../../lib/_doc-history-area";
import { BodyEndIslands } from "../../../lib/_body-end-islands";

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
    const { docs: mergedDocs } = mergeLocaleDocs({
      baseDocs: loadDocs("docs").filter((d) => !d.data.draft),
      localeDocs: loadDocs(`docs-${locale}`).filter((d) => !d.data.draft),
      applyDefaultLocaleOnlyFilter: true,
    });
    // category_no_page index files build no route — drop them AFTER the merge
    // so a locale override carrying the flag first wins the merge (suppressing
    // the base doc); pre-merge filtering would drop it from localeSlugSet and
    // the unflagged base doc would resurface as a card linking to a locale
    // route the docs route never builds.
    const docs = mergedDocs.filter((d) => !d.data.category_no_page);
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
  tagInfo: TagInfo;
}

export default function LocaleDocTagPage({
  params,
  tagInfo,
}: PageProps): JSX.Element {
  const { locale, tag } = params;

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
      title={composeMetaTitle(pageTitle)}
      head={<HeadWithDefaults title={pageTitle} />}
      lang={locale}
      noindex={settings.noindex}
      hideSidebar={true}
      hideToc={true}
      headerOverride={<HeaderWithDefaults lang={locale} currentPath={withBase(`/${locale}/docs/tags/${tag}`)} />}
      breadcrumbOverride={<Breadcrumb items={breadcrumbItems} />}
      footerOverride={<FooterWithDefaults lang={locale} />}
      bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} />}
    >
      <h1 class="text-heading font-bold mb-vsp-xs">{pageTitle}</h1>
      <p class="text-muted mb-vsp-lg">{countText}</p>
      <DocCardGrid ariaLabel={pageTitle} items={cardItems} />
      <DocHistoryArea slug={`tags/${tag}`} locale={locale} />
    </DocLayoutWithDefaults>
  );
}
