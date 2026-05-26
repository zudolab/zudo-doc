/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Port of src/pages/[locale]/docs/tags/index.astro → zfb page module.
//
// Non-default-locale "All Tags" index page. paths() emits one route per
// locale defined in settings.locales (English has no /en prefix — it is
// handled by pages/docs/tags/index.tsx). The component recomputes the tag
// map at render time using a locale-doc + base-doc fallback strategy that
// mirrors src/components/tag-nav.astro's non-default-locale branch.
//
// Fallback strategy (locale first, base as fill): see pages/lib/locale-merge.ts
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { locale: string }
//   props:  (none — tag map computed at render time)

import { mergeLocaleDocs } from "../../../lib/locale-merge";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import { t } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { settings } from "@/config/settings";
import { DocLayoutWithDefaults } from "@zudo-doc/zudo-doc-v2/doclayout";
import { Breadcrumb } from "@zudo-doc/zudo-doc-v2/breadcrumb";
import type { BreadcrumbItem } from "@zudo-doc/zudo-doc-v2/breadcrumb";
import { TagNav } from "@zudo-doc/zudo-doc-v2/nav-indexing";
import type { TagItem, TagNavLabels } from "@zudo-doc/zudo-doc-v2/nav-indexing";
import type { JSX } from "preact";
import { FooterWithDefaults } from "../../../lib/_footer-with-defaults";
import { HeaderWithDefaults } from "../../../lib/_header-with-defaults";
import { HeadWithDefaults } from "../../../lib/_head-with-defaults";
import { composeMetaTitle } from "../../../lib/_compose-meta-title";
import { DocHistoryArea } from "../../../lib/_doc-history-area";
import { BodyEndIslands } from "../../../lib/_body-end-islands";

export const frontmatter = { title: "All Tags" };

/** One route per non-default locale (prefixDefaultLocale: false). */
export function paths(): Array<{ params: { locale: string } }> {
  return Object.keys(settings.locales).map((locale) => ({
    params: { locale },
  }));
}

interface PageProps {
  params: { locale: string };
}

export default function LocaleTagsIndexPage({
  params,
}: PageProps): JSX.Element {
  const { locale } = params;
  const pageTitle = t("doc.allTags", locale);

  const docs = mergeLocaleDocs(locale);
  const tagMap = collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));

  const labels: TagNavLabels = {
    tags: t("doc.tags", locale),
    taggedWith: t("doc.taggedWith", locale),
  };

  // Sort alphabetically using the page locale — mirrors tag-nav.astro sort.
  const tags: TagItem[] = [...tagMap.values()]
    .sort((a, b) => a.tag.localeCompare(b.tag, locale))
    .map((info) => ({
      tag: info.tag,
      count: info.count,
      href: withBase(`/${locale}/docs/tags/${info.tag}`),
    }));

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Docs" },
    { label: pageTitle },
  ];

  return (
    <DocLayoutWithDefaults
      title={composeMetaTitle(pageTitle)}
      head={<HeadWithDefaults title={pageTitle} />}
      lang={locale}
      noindex={settings.noindex}
      hideSidebar={true}
      hideToc={true}
      headerOverride={<HeaderWithDefaults lang={locale} currentPath={withBase(`/${locale}/docs/tags`)} />}
      breadcrumbOverride={<Breadcrumb items={breadcrumbItems} />}
      footerOverride={<FooterWithDefaults lang={locale} />}
      bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} />}
    >
      <h1 class="text-heading font-bold mb-vsp-lg">{pageTitle}</h1>
      {!settings.docTags || tags.length === 0 ? (
        <p class="text-muted">{t("doc.noTags", locale)}</p>
      ) : (
        <TagNav variant="all" tags={tags} labels={labels} />
      )}
      <DocHistoryArea slug="tags" locale={locale} />
    </DocLayoutWithDefaults>
  );
}
