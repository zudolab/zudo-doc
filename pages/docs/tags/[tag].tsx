/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Port of src/pages/docs/tags/[tag].astro → zfb page module.
//
// Default-locale (en) per-tag detail page. paths() enumerates one route per
// unique tag in the "docs" collection and passes the resolved TagInfo as a
// prop so the component has zero extra collection reads at render time.
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { tag: string }
//   props:  { tagInfo: TagInfo }
//
// Data flow:
//   getCollection("docs") [sync] → collectTags() → one route per tag
//   render: DocCardGrid with pre-resolved TagInfo.docs items

import { getCollection } from "zfb/content";
import { collectTags } from "@/utils/tags";
import type { TagInfo } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import { t, defaultLocale } from "@/config/i18n";
import { settings } from "@/config/settings";
import { withBase, docsUrl } from "@/utils/base";
import type { DocsEntry } from "@/types/docs-entry";
import { DocLayoutWithDefaults } from "@zudo-doc/zudo-doc-v2/doclayout";
import { Breadcrumb } from "@zudo-doc/zudo-doc-v2/breadcrumb";
import type { BreadcrumbItem } from "@zudo-doc/zudo-doc-v2/breadcrumb";
import { DocCardGrid } from "@zudo-doc/zudo-doc-v2/nav-indexing";
import type { JSX } from "preact";
import { bridgeEntries } from "../../_data";
import { FooterWithDefaults } from "../../lib/_footer-with-defaults";
import { HeaderWithDefaults } from "../../lib/_header-with-defaults";
import { HeadWithDefaults } from "../../lib/_head-with-defaults";
import { composeMetaTitle } from "../../lib/_compose-meta-title";
import { DocHistoryArea } from "../../lib/_doc-history-area";
import { BodyEndIslands } from "../../lib/_body-end-islands";

export const frontmatter = { title: "Tag" };

/** One entry per unique tag in the default-locale collection. */
export function paths(): Array<{
  params: { tag: string };
  props: { tagInfo: TagInfo };
}> {
  const allDocs = (bridgeEntries(getCollection("docs"), "docs") as unknown as DocsEntry[]);
  const docs = allDocs.filter((doc) => !doc.data.unlisted && !doc.data.draft);
  const tagMap = collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));

  return [...tagMap.entries()].map(([tag, tagInfo]) => ({
    params: { tag },
    props: { tagInfo },
  }));
}

interface PageProps {
  params: { tag: string };
  tagInfo: TagInfo;
}

export default function DocTagPage({ params, tagInfo }: PageProps): JSX.Element {
  const { tag } = params;
  const locale = defaultLocale;

  const countText =
    tagInfo.count === 1
      ? t("doc.pageCountSingle", locale).replace("{count}", String(tagInfo.count))
      : t("doc.pageCount", locale).replace("{count}", String(tagInfo.count));

  const pageTitle = `${t("doc.taggedWith", locale)}: ${tag}`;

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Docs" },
    { label: t("doc.allTags", locale), href: withBase("/docs/tags") },
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
      noindex={settings.noindex}
      hideSidebar={true}
      hideToc={true}
      headerOverride={<HeaderWithDefaults lang={locale} currentPath={withBase(`/docs/tags/${tag}`)} />}
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
