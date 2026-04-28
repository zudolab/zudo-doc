/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Port of src/pages/docs/tags/index.astro → zfb page module.
//
// Default-locale (en) "All Tags" index page. Collects every tag across the
// "docs" collection, sorts them alphabetically, and renders a full tag cloud
// via the v2 TagNav component. No dynamic params — single static route.
//
// Data flow:
//   getCollection("docs")   [sync, zfb/content]
//   → collectTags()         builds { tag → { count, docs[] } }
//   → sort by tag           preserves sort parity with Astro original
//   → TagNav variant="all"  renders the chip cloud

import { getCollection } from "zfb/content";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import { t, defaultLocale } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { settings } from "@/config/settings";
import type { DocsEntry } from "@/types/docs-entry";
import { DocLayoutWithDefaults } from "@zudo-doc/zudo-doc-v2/doclayout";
import { Breadcrumb } from "@zudo-doc/zudo-doc-v2/breadcrumb";
import type { BreadcrumbItem } from "@zudo-doc/zudo-doc-v2/breadcrumb";
import { TagNav } from "@zudo-doc/zudo-doc-v2/nav-indexing";
import type { TagItem, TagNavLabels } from "@zudo-doc/zudo-doc-v2/nav-indexing";
import type { JSX } from "preact";

export const frontmatter = { title: "All Tags" };

export default function DocsTagsIndexPage(): JSX.Element {
  const locale = defaultLocale;
  const pageTitle = t("doc.allTags", locale);

  const allDocs = getCollection("docs") as unknown as DocsEntry[];
  const docs = allDocs.filter((doc) => !doc.data.unlisted && !doc.data.draft);
  const tagMap = collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));

  const labels: TagNavLabels = {
    tags: t("doc.tags", locale),
    taggedWith: t("doc.taggedWith", locale),
  };

  // Sort alphabetically — mirrors the Astro tag-nav.astro sort order.
  const tags: TagItem[] = [...tagMap.values()]
    .sort((a, b) => a.tag.localeCompare(b.tag, locale))
    .map((info) => ({
      tag: info.tag,
      count: info.count,
      href: withBase(`/docs/tags/${info.tag}`),
    }));

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Docs" },
    { label: pageTitle },
  ];

  return (
    <DocLayoutWithDefaults
      title={pageTitle}
      hideSidebar={true}
      hideToc={true}
      breadcrumbOverride={<Breadcrumb items={breadcrumbItems} />}
    >
      <h1 class="text-heading font-bold mb-vsp-lg">{pageTitle}</h1>
      {!settings.docTags || tags.length === 0 ? (
        <p class="text-muted">{t("doc.noTags", locale)}</p>
      ) : (
        <TagNav variant="all" tags={tags} labels={labels} />
      )}
    </DocLayoutWithDefaults>
  );
}
