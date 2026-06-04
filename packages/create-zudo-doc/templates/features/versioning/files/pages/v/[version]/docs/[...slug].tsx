/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the versioned EN docs route.
//
// Versioned EN docs route. paths() enumerates one route per (version, slug)
// combination using the `docs-v-${version.slug}` collection for each version
// configured in settings.versions.
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { version: string; slug: string[] }
//   props:  { entry, autoIndex, version, breadcrumbs, prev, next }
//
// Each version renders with its own nav tree (from the version's docsDir
// category metadata). Prev/next hrefs are pre-resolved to the versioned URL
// form (e.g. /v/1.0/docs/…) so the component needs no URL computation.
//
// Version banner: if version.banner is set ("unmaintained" | "unreleased"),
// the DocLayoutWithDefaults version-banner prop drives the banner display.

import { getCollection } from "zfb/content";
import type { DocsEntry } from "@/types/docs-entry";
import { settings } from "@/config/settings";
import type { VersionConfig } from "@/config/settings";
import { t } from "@/config/i18n";
import { docsUrl, versionedDocsUrl } from "@/utils/base";
import {
  buildNavTree,
  buildBreadcrumbs,
  flattenTree,
  findNode,
  loadCategoryMeta,
  collectAutoIndexNodes,
  isNavVisible,
  type NavNode,
} from "@/utils/docs";
import { getNavSectionForSlug, getNavSubtree } from "@/utils/nav-scope";
import { toRouteSlug } from "@/utils/slug";
import { DocLayoutWithDefaults } from "@takazudo/zudo-doc/doclayout";
import { Breadcrumb } from "@takazudo/zudo-doc/breadcrumb";
import { NavCardGrid } from "@takazudo/zudo-doc/nav-indexing";
// Locale-aware MDX components factory — see `pages/_mdx-components.ts`.
import { createMdxComponents } from "../../../_mdx-components";
import type { JSX } from "preact";
import { bridgeEntries } from "../../../_data";
import { extractHeadings } from "../../../lib/_extract-headings";
import type { DocPageEntry, AutoIndexNode, DocPageEntryProps, DocPageAutoIndexProps } from "../../../lib/doc-page-props";
import { FooterWithDefaults } from "../../../lib/_footer-with-defaults";
import { SidebarWithDefaults } from "../../../lib/_sidebar-with-defaults";
import { HeaderWithDefaults } from "../../../lib/_header-with-defaults";
import { HeadWithDefaults } from "../../../lib/_head-with-defaults";
import { DocHistoryArea } from "../../../lib/_doc-history-area";
import { DocMetainfoArea } from "../../../lib/_doc-metainfo-area";
import { composeMetaTitle } from "../../../lib/_compose-meta-title";
import { buildInlineVersionSwitcher } from "../../../lib/_inline-version-switcher";
import { DocPager } from "../../../lib/_doc-pager";
import { DocContentHeader } from "../../../lib/_doc-content-header";
import { SidebarPrepaint } from "../../../lib/_sidebar-prepaint";
import { DocBodyEnd } from "../../../lib/_doc-body-end";

export const frontmatter = { title: "Docs" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// DocPageEntry, AutoIndexNode imported from pages/lib/doc-page-props.ts

/** Route-specific extra fields — present on both branches of the union. */
interface VersionedDocPageExtra {
  /** The version config for the active version. */
  version: VersionConfig;
}

type DocPageProps =
  | (DocPageEntryProps & VersionedDocPageExtra)
  | (DocPageAutoIndexProps & VersionedDocPageExtra);

// ---------------------------------------------------------------------------
// paths() — synchronous (ADR-004)
// ---------------------------------------------------------------------------

/**
 * Emit one route per (version, slug) combination.
 *
 * For each version in settings.versions, loads docs from
 * `docs-v-${version.slug}` and enumerates all pages plus
 * auto-generated category index pages.
 *
 * Prev/next hrefs are pre-resolved to the versioned form.
 */
export function paths(): Array<{
  params: { version: string; slug: string[] };
  props: DocPageProps;
}> {
  if (!settings.versions) return [];

  const result: Array<{
    params: { version: string; slug: string[] };
    props: DocPageProps;
  }> = [];

  for (const version of settings.versions) {
    const collectionName = `docs-v-${version.slug}`;
    const allDocs = ((bridgeEntries(getCollection(collectionName), collectionName) as unknown as DocPageEntry[])).filter(
      (doc) => !doc.data.draft,
    );

    const categoryMeta = loadCategoryMeta(version.docsDir);
    const navDocs = allDocs.filter(isNavVisible);
    // Versioned docs always use EN locale for nav tree
    const tree = buildNavTree(navDocs as unknown as DocsEntry[], "en", categoryMeta);

    // Regular doc pages
    for (const entry of allDocs) {
      const slug = entry.data.slug ?? toRouteSlug(entry.slug);
      const navSection = getNavSectionForSlug(slug);
      const subtree = getNavSubtree(tree, navSection);
      const flat = flattenTree(subtree);
      const idx = flat.findIndex((n) => n.slug === slug);

      let prevNode = idx > 0 ? flat[idx - 1] ?? null : null;
      let nextNode = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] ?? null : null;

      if (entry.data.pagination_prev !== undefined) {
        if (entry.data.pagination_prev === null) {
          prevNode = null;
        } else {
          const found = findNode(tree, entry.data.pagination_prev);
          prevNode = found ?? prevNode;
        }
      }
      if (entry.data.pagination_next !== undefined) {
        if (entry.data.pagination_next === null) {
          nextNode = null;
        } else {
          const found = findNode(tree, entry.data.pagination_next);
          nextNode = found ?? nextNode;
        }
      }

      result.push({
        params: { version: version.slug, slug: slug.split("/") },
        props: {
          kind: "entry",
          entry,
          version,
          breadcrumbs: buildBreadcrumbs(tree, slug, "en"),
          // Pre-resolve prev/next hrefs to versioned URLs
          prev: prevNode
            ? { ...prevNode, href: versionedDocsUrl(prevNode.slug, version.slug) }
            : null,
          next: nextNode
            ? { ...nextNode, href: versionedDocsUrl(nextNode.slug, version.slug) }
            : null,
          headings: extractHeadings(entry.body ?? ""),
        },
      });
    }

    // Auto-generated index pages for categories without index.mdx
    for (const node of collectAutoIndexNodes(tree)) {
      result.push({
        params: { version: version.slug, slug: node.slug.split("/") },
        props: {
          kind: "autoIndex",
          autoIndex: {
            ...node,
            children: node.children.map((c: NavNode) => ({
              ...c,
              href: c.href ?? versionedDocsUrl(c.slug, version.slug),
            })) as NavNode[],
          } as AutoIndexNode,
          version,
          breadcrumbs: buildBreadcrumbs(tree, node.slug, "en"),
          prev: null,
          next: null,
          headings: [],
        },
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

type PageArgs = DocPageProps & { params: { version: string; slug: string[] } };

export default function VersionedDocsPage(props: PageArgs): JSX.Element {
  const { breadcrumbs, prev, next, headings, version } = props;
  const locale = "en";

  const slug = props.kind === "autoIndex"
    ? props.autoIndex.slug
    : (props.entry.data.slug ?? toRouteSlug(props.entry.slug));

  const title = props.kind === "autoIndex" ? props.autoIndex.label : props.entry.data.title;
  const description = props.kind === "autoIndex" ? props.autoIndex.description : props.entry.data.description;

  // Locale-aware components bag — creates nav wrappers bound to the active
  // locale so CategoryNav/CategoryTreeNav/SiteTreeNav query the right collection.
  const components = createMdxComponents(locale);

  const autoIndexChildren = props.kind === "autoIndex"
    ? props.autoIndex.children.filter((c: NavNode) => c.hasPage || c.children.length > 0)
    : [];

  // Version banner: drives the `<VersionBanner>` element inside
  // DocLayoutWithDefaults when `version.banner` is "unmaintained" or
  // "unreleased". The banner links out to the latest version of the
  // current page (slug-preserving — strips the /v/{version}/ prefix).
  const versionBannerType = version.banner ? version.banner : undefined;
  const versionBannerLatestUrl = versionBannerType
    ? docsUrl(slug, locale)
    : undefined;
  const versionBannerLabels = versionBannerType
    ? {
        message:
          versionBannerType === "unmaintained"
            ? t("version.banner.unmaintained", locale)
            : t("version.banner.unreleased", locale),
        latestLink: t("version.banner.latestLink", locale),
      }
    : undefined;

  // Canonical URL — versioned pages use the versioned URL as canonical.
  const pageUrl = versionedDocsUrl(slug, version.slug, locale);
  const canonical = settings.siteUrl
    ? settings.siteUrl.replace(/\/$/, "") + pageUrl
    : undefined;

  // Persist key: locale + nav-section so the sidebar DOM node is reused
  // across same-locale + same-section navigations only. No sanitizer needed —
  // both lang (BCP-47 locale string) and navSection (filesystem-derived
  // kebab-case slug) come from controlled, trusted sources.
  const navSection = getNavSectionForSlug(slug);
  const hideSidebar = props.kind === "entry" ? props.entry.data.hide_sidebar : undefined;
  const sidebarPersistKey = hideSidebar
    ? undefined
    : `sidebar-${locale}-${navSection ?? "default"}`;

  return (
    <DocLayoutWithDefaults
      title={composeMetaTitle(title)}
      description={description}
      head={<HeadWithDefaults title={title} description={description} canonical={canonical} />}
      lang={locale}
      noindex={settings.noindex}
      hideSidebar={hideSidebar}
      hideToc={props.kind === "entry" ? props.entry.data.hide_toc : undefined}
      headings={headings}
      canonical={canonical}
      sidebarPersistKey={sidebarPersistKey}
      versionBanner={versionBannerType ?? false}
      versionBannerLatestUrl={versionBannerLatestUrl}
      versionBannerLabels={versionBannerLabels}
      headerOverride={
        <HeaderWithDefaults
          lang={locale}
          currentSlug={slug}
          navSection={getNavSectionForSlug(slug)}
          currentVersion={version.slug}
          currentPath={versionedDocsUrl(slug, version.slug, locale)}
        />
      }
      breadcrumbOverride={
        breadcrumbs.length > 0 ? (
          <Breadcrumb
            items={breadcrumbs}
            rightSlot={buildInlineVersionSwitcher(slug, locale, version.slug)}
          />
        ) : undefined
      }
      sidebarOverride={
        <SidebarWithDefaults
          currentSlug={slug}
          lang={locale}
          navSection={getNavSectionForSlug(slug)}
          currentVersion={version.slug}
          currentPath={versionedDocsUrl(slug, version.slug, locale)}
        />
      }
      afterSidebar={<SidebarPrepaint />}
      footerOverride={<FooterWithDefaults lang={locale} />}
      bodyEndComponents={<DocBodyEnd />}
    >
      {props.kind === "autoIndex" ? (
        /* Auto-index page: category without an index.mdx.
           Fragment (not <div>) so children become direct children of
           <article class="zd-content">, picking up the flow-space rule
           (.zd-content > :where(* + *) { margin-top: var(--flow-space) }).
           Wrapping in <div> would make h1/description p children-of-children
           and the flow gap (~24px) would never apply — see #1460. */
        <>
          <h1 class="text-heading font-bold mb-vsp-xs">{props.autoIndex.label}</h1>

          {/* Build-time date block — chrome parity (#1461). Auto-index pages
              previously rendered without doc-meta; reference site shows it on
              every docs page. The component returns null when no manifest
              entry exists for this slug. */}
          <DocMetainfoArea slug={slug} locale={locale} />

          {props.autoIndex.description && (
            <p class="mb-vsp-lg text-title text-muted">
              {props.autoIndex.description}
            </p>
          )}
          <NavCardGrid children={autoIndexChildren} />
        </>
      ) : (
        /* Regular doc page. Fragment (not <div>) for the same reason as
           the auto-index branch above — see #1460. */
        <>
          <DocContentHeader entry={props.entry} slug={slug} locale={locale} />

          <props.entry.Content components={components} />

          {/* Prev / Next pagination — placed before the document utilities
              section to match the Astro reference order: content → pager →
              view-source / history. Fixes #1535. */}
          <DocPager prev={prev} next={next} locale={locale} />

          {/* Document utilities (revision history) — entry branch only */}
          <DocHistoryArea slug={slug} locale={locale} />
        </>
      )}
    </DocLayoutWithDefaults>
  );
}
