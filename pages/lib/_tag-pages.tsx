/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Shared data + renderers for the doc-tags pages (#2010).
//
// Collapses the per-locale page pairs:
//   pages/docs/tags/[tag].tsx   + pages/[locale]/docs/tags/[tag].tsx
//   pages/docs/tags/index.tsx   + pages/[locale]/docs/tags/index.tsx
// into locale-parameterized helpers. The page files stay thin shells that own
// only their paths() param shapes; URL prefixes and the default-vs-locale
// data path branch live here.
//
// Data-path branch (kept exactly as the original pages had it):
//   - Default locale: the "docs" collection directly, filtered
//     unlisted/draft/category_no_page before tag collection.
//   - Non-default locale: locale-first merge with base fallback
//     (see locale-merge.ts) — draft-filtered inputs, unlisted dropped by the
//     merge default, category_no_page filtered AFTER the merge so a locale
//     override carrying the flag first wins the merge (suppressing the base
//     doc); pre-merge filtering would drop it from localeSlugSet and the
//     unflagged base doc would resurface as a card linking to a locale route
//     the docs route never builds.

import { collectTags } from "@/utils/tags";
import type { TagInfo } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import { t, defaultLocale } from "@/config/i18n";
import { settings } from "@/config/settings";
import { withBase, docsUrl } from "@/utils/base";
import { DocLayoutWithDefaults } from "@takazudo/zudo-doc/doclayout";
import { Breadcrumb } from "@takazudo/zudo-doc/breadcrumb";
import type { BreadcrumbItem } from "@takazudo/zudo-doc/breadcrumb";
import { DocCardGrid, TagNav } from "@takazudo/zudo-doc/nav-indexing";
import type { TagItem, TagNavLabels } from "@takazudo/zudo-doc/nav-indexing";
import type { JSX } from "preact";
import { FooterWithDefaults } from "./_footer-with-defaults";
import { HeaderWithDefaults } from "./_header-with-defaults";
import { HeadWithDefaults } from "./_head-with-defaults";
import { composeMetaTitle } from "./_compose-meta-title";
import { DocHistoryArea } from "./_doc-history-area";
import { BodyEndIslands } from "./_body-end-islands";
import { stableDocs, memoizeDerived } from "./_nav-source-cache";
import { mergeLocaleDocs } from "./locale-merge";

// ---------------------------------------------------------------------------
// Tag collection
// ---------------------------------------------------------------------------

/**
 * Build the { tag → TagInfo } map for one locale, preserving each original
 * page's exact data path (see the module-header branch notes).
 *
 * Memoized on the snapshot-anchored stableDocs identity (same pattern as
 * _nav-source-cache) so the collection bridging and tag aggregation run once
 * per locale per build rather than once per built tag page.
 */
export function collectTagMapForLocale(locale: string): Map<string, TagInfo> {
  if (locale === defaultLocale) {
    const baseDocs = stableDocs("docs");
    return memoizeDerived([baseDocs], "tagMap;default", () => {
      // category_no_page index.mdx builds no route — drop it so a tag it carries
      // doesn't render a DocCard linking to a non-existent /docs/<cat>/ page.
      const docs = baseDocs.filter(
        (doc) =>
          !doc.data.unlisted && !doc.data.draft && !doc.data.category_no_page,
      );
      return collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));
    });
  }

  const baseDocs = stableDocs("docs");
  const localeDocs = stableDocs(`docs-${locale}`);
  return memoizeDerived([baseDocs, localeDocs], `tagMap;${locale}`, () => {
    const { docs: mergedDocs } = mergeLocaleDocs({
      baseDocs: baseDocs.filter((d) => !d.data.draft),
      localeDocs: localeDocs.filter((d) => !d.data.draft),
      applyDefaultLocaleOnlyFilter: true,
    });
    const docs = mergedDocs.filter((d) => !d.data.category_no_page);
    return collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));
  });
}

// ---------------------------------------------------------------------------
// Shared renderers
// ---------------------------------------------------------------------------

/** URL prefix for a locale: "" for the default locale, "/{locale}" otherwise. */
function localePrefix(locale: string): string {
  return locale === defaultLocale ? "" : `/${locale}`;
}

/** Per-tag detail page (chip target). */
export function TagDetailPageView({
  locale,
  tag,
  tagInfo,
}: {
  locale: string;
  tag: string;
  tagInfo: TagInfo;
}): JSX.Element {
  const isDefault = locale === defaultLocale;
  const prefix = localePrefix(locale);

  const countText =
    tagInfo.count === 1
      ? t("doc.pageCountSingle", locale).replace("{count}", String(tagInfo.count))
      : t("doc.pageCount", locale).replace("{count}", String(tagInfo.count));

  const pageTitle = `${t("doc.taggedWith", locale)}: ${tag}`;

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Docs" },
    { label: t("doc.allTags", locale), href: withBase(`${prefix}/docs/tags`) },
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
      // The original default-locale page omitted `lang` entirely; passing
      // undefined relies on Preact treating an undefined prop as absent.
      lang={isDefault ? undefined : locale}
      noindex={settings.noindex}
      hideSidebar={true}
      hideToc={true}
      // Empty fragment suppresses DocLayoutWithDefaults' empty-data default
      // Sidebar island — its marker never hydrates for published-package
      // consumers (zfb#999) and zfb >= next.38 warns about it; the sidebar is
      // hidden on this page anyway (zudolab/zudo-doc#2057).
      sidebarOverride={<></>}
      // Tag segment URL-encoded — emitted href/path sites only; route params
      // stay raw (e.g. "type:guide" → "type%3Aguide").
      headerOverride={<HeaderWithDefaults lang={locale} currentPath={withBase(`${prefix}/docs/tags/${encodeURIComponent(tag)}`)} />}
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

/** "All Tags" index page — computes the tag map at render time (matching the
 *  original pages, which had no props from paths()). */
export function TagsIndexPageView({ locale }: { locale: string }): JSX.Element {
  const isDefault = locale === defaultLocale;
  const prefix = localePrefix(locale);
  const pageTitle = t("doc.allTags", locale);

  const tagMap = collectTagMapForLocale(locale);

  const labels: TagNavLabels = {
    tags: t("doc.tags", locale),
    taggedWith: t("doc.taggedWith", locale),
  };

  // Sort alphabetically using the page locale — matches documented tag-nav sort order.
  const tags: TagItem[] = [...tagMap.values()]
    .sort((a, b) => a.tag.localeCompare(b.tag, locale))
    .map((info) => ({
      tag: info.tag,
      count: info.count,
      // Tag segment URL-encoded — href sites only; route params stay raw.
      href: withBase(`${prefix}/docs/tags/${encodeURIComponent(info.tag)}`),
    }));

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Docs" },
    { label: pageTitle },
  ];

  return (
    <DocLayoutWithDefaults
      title={composeMetaTitle(pageTitle)}
      head={<HeadWithDefaults title={pageTitle} />}
      // Same undefined-≡-absent reliance as TagDetailPageView above.
      lang={isDefault ? undefined : locale}
      noindex={settings.noindex}
      hideSidebar={true}
      hideToc={true}
      // Empty fragment suppresses DocLayoutWithDefaults' empty-data default
      // Sidebar island — its marker never hydrates for published-package
      // consumers (zfb#999) and zfb >= next.38 warns about it; the sidebar is
      // hidden on this page anyway (zudolab/zudo-doc#2057).
      sidebarOverride={<></>}
      headerOverride={<HeaderWithDefaults lang={locale} currentPath={withBase(`${prefix}/docs/tags`)} />}
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
