/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the locale-prefixed docs route.
//
// Non-default-locale catch-all docs route. paths() emits one route per
// (locale, slug) combination — one locale from settings.locales per each
// doc in that locale's merged collection (locale-first + base fallback).
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { locale: string; slug: string[] }
//   props:  { entry, autoIndex, contentDir, isFallback, breadcrumbs, prev, next }
//
// Route is the OPTIONAL catchall `[[...slug]]` so a locale root index.mdx can
// build at `/{locale}/docs/` (canonical root URL — #1891). The root entry
// emits `params.slug = []` via `toSlugParams`; a required `[...slug]` catchall
// rejects an empty array and would drop the ENTIRE locale route (the EN-root
// index leaks in via the locale-first EN fallback, so this fires even before a
// locale-specific root index exists — probe-observed page-count collapse).
//
// i18n / locale routing:
//   - Default locale (EN) is handled by pages/docs/[[...slug]].tsx
//     (prefixDefaultLocale: false).
//   - Non-default locales emit /{locale}/docs/{slug}.
//   - Locale-first merge: locale docs take priority; base EN docs fill in
//     pages not translated yet (shown with a fallback notice).

import type { DocsEntry } from "@/types/docs-entry";
import { settings } from "@/config/settings";
import { docsUrl } from "@/utils/base";
import {
  buildNavTree,
  buildBreadcrumbs,
  flattenTree,
  findNode,
  collectAutoIndexNodes,
  type NavNode,
} from "@/utils/docs";
import { getNavSectionForSlug, getNavSubtree } from "@/utils/nav-scope";
import { toRouteSlug, toSlugParams } from "@/utils/slug";
import { DocLayoutWithDefaults } from "@takazudo/zudo-doc/doclayout";
import { Breadcrumb } from "@takazudo/zudo-doc/breadcrumb";
import { NavCardGrid } from "@takazudo/zudo-doc/nav-indexing";
// Shared MDX components bag — see `pages/_mdx-components.ts`.
import { createMdxComponents } from "../../_mdx-components";
import type { JSX } from "preact";
import { resolveNavSource } from "../../lib/_nav-source-docs";
import { extractHeadings } from "../../lib/_extract-headings";
import type { DocPageEntry, AutoIndexNode, DocPageEntryProps, DocPageAutoIndexProps } from "../../lib/doc-page-props";
import { FooterWithDefaults } from "../../lib/_footer-with-defaults";
import { DocHistoryArea } from "../../lib/_doc-history-area";
import { DocMetainfoArea } from "../../lib/_doc-metainfo-area";
import { SidebarWithDefaults } from "../../lib/_sidebar-with-defaults";
import { HeaderWithDefaults } from "../../lib/_header-with-defaults";
import { HeadWithDefaults } from "../../lib/_head-with-defaults";
import { composeMetaTitle } from "../../lib/_compose-meta-title";
import { buildInlineVersionSwitcher } from "../../lib/_inline-version-switcher";
import { DocPager } from "../../lib/_doc-pager";
import { DocContentHeader } from "../../lib/_doc-content-header";
import { SidebarPrepaint } from "../../lib/_sidebar-prepaint";
import { DocBodyEnd } from "../../lib/_doc-body-end";

export const frontmatter = { title: "Docs" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// DocPageEntry, AutoIndexNode imported from pages/lib/doc-page-props.ts

/** Route-specific extra fields — present on both branches of the union. */
interface LocaleDocPageExtra {
  /** Content directory for the active locale (or base EN for fallbacks). */
  contentDir: string;
  /** True when this page falls back to the base EN collection. */
  isFallback: boolean;
}

type DocPageProps =
  | (DocPageEntryProps & LocaleDocPageExtra)
  | (DocPageAutoIndexProps & LocaleDocPageExtra);

// ---------------------------------------------------------------------------
// paths() — synchronous (ADR-004)
// ---------------------------------------------------------------------------

/**
 * Emit one route per (non-default locale, slug) combination.
 *
 * Merge strategy:
 *   1. Load locale docs (e.g. "docs-ja").
 *   2. Load base EN docs ("docs").
 *   3. Locale docs take priority; base EN fills in slugs not translated.
 *   4. Track fallback slugs for the fallback-notice banner.
 *   5. Build nav tree, compute breadcrumbs and prev/next for each entry.
 *
 * Fallback slug set drives `isFallback` which the component uses to show
 * the "not yet translated" notice (matching the Astro original).
 */
export function paths(): Array<{
  params: { locale: string; slug: string[] };
  props: DocPageProps;
}> {
  const result: Array<{
    params: { locale: string; slug: string[] };
    props: DocPageProps;
  }> = [];

  for (const locale of Object.keys(settings.locales) as string[]) {
    const localeConfig = settings.locales[locale];
    const contentDir = localeConfig?.dir ?? settings.docsDir;

    // Identity-stable, locale-first merge with EN fallback. The same `docs` /
    // `navDocs` / `categoryMeta` instances are reused across this route's many
    // per-page paths() invocations so buildNavTree's identity fast-path skips
    // the key recomputation — see pages/lib/_nav-source-docs.ts (#1902).
    const { docs: allDocs, navDocs, categoryMeta, localeSlugSet } = resolveNavSource(
      locale,
      undefined,
      { applyDefaultLocaleOnlyFilter: true, keepUnlisted: true },
    );
    // isFallback: page came from base docs, not the locale collection.
    const fallbackSlugs = new Set(
      allDocs
        .filter((d) => !localeSlugSet.has(d.data.slug ?? d.id))
        .map((d) => d.data.slug ?? d.id),
    );

    const tree = buildNavTree(navDocs as unknown as DocsEntry[], locale, categoryMeta);
    const fullTree = buildNavTree(allDocs as unknown as DocsEntry[], locale, categoryMeta);

    // Regular doc pages
    for (const entry of allDocs) {
      // Canonical route slug via the one shared rule (@/utils/slug). `entry.id`
      // is already `toRouteSlug(entry.slug)` (bridgeEntries → stripIndexSuffix →
      // toRouteSlug), so this is identical to the previous `entry.id` form for
      // every entry — but stating it explicitly removes the historical id-vs-
      // toRouteSlug asymmetry with the EN route and the component below, all of
      // which now yield "" for a root index (URL /{locale}/docs/ — #1891).
      const slug = entry.data.slug ?? toRouteSlug(entry.slug);
      const isFallback = fallbackSlugs.has(slug);
      const entryContentDir = isFallback ? settings.docsDir : contentDir;

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
        params: { locale, slug: toSlugParams(slug) },
        props: {
          kind: "entry",
          entry: entry as unknown as DocPageEntry,
          contentDir: entryContentDir,
          isFallback,
          breadcrumbs: buildBreadcrumbs(fullTree, slug, locale),
          prev: prevNode,
          next: nextNode,
          headings: extractHeadings(entry.body ?? ""),
        },
      });
    }

    // Auto-generated index pages for categories without index.mdx
    for (const node of collectAutoIndexNodes(tree)) {
      result.push({
        params: { locale, slug: toSlugParams(node.slug) },
        props: {
          kind: "autoIndex",
          autoIndex: node as AutoIndexNode,
          contentDir,
          isFallback: false,
          breadcrumbs: buildBreadcrumbs(fullTree, node.slug, locale),
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

type PageArgs = DocPageProps & { params: { locale: string; slug: string[] } };

export default function LocaleDocsPage(props: PageArgs): JSX.Element {
  const { breadcrumbs, prev, next, headings, contentDir, isFallback } = props;
  const locale = props.params.locale;

  const slug = props.kind === "autoIndex"
    ? props.autoIndex.slug
    : (props.entry.data.slug ?? toRouteSlug(props.entry.slug));

  const title = props.kind === "autoIndex" ? props.autoIndex.label : props.entry.data.title;
  const description = props.kind === "autoIndex" ? props.autoIndex.description : props.entry.data.description;

  // Locale-aware components bag — creates nav wrappers bound to the active
  // locale so CategoryNav/CategoryTreeNav/SiteTreeNav query the right collection.
  const components = createMdxComponents(locale);

  const autoIndexChildren = props.kind === "autoIndex"
    ? props.autoIndex.children
        .filter((c: NavNode) => c.hasPage || c.children.length > 0)
        .map((c: NavNode) => ({
          ...c,
          href: c.href ?? docsUrl(c.slug, locale),
        }))
    : [];

  // Canonical URL — only when siteUrl is configured.
  const pageUrl = docsUrl(slug, locale);
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
      headerOverride={
        <HeaderWithDefaults
          lang={locale}
          currentSlug={slug}
          navSection={getNavSectionForSlug(slug)}
          currentPath={docsUrl(slug, locale)}
        />
      }
      breadcrumbOverride={
        breadcrumbs.length > 0 ? (
          <Breadcrumb
            items={breadcrumbs}
            rightSlot={buildInlineVersionSwitcher(slug, locale)}
          />
        ) : undefined
      }
      sidebarOverride={
        <SidebarWithDefaults
          currentSlug={slug}
          lang={locale}
          navSection={getNavSectionForSlug(slug)}
          currentPath={docsUrl(slug, locale)}
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
          <DocContentHeader entry={props.entry} slug={slug} locale={locale} isFallback={isFallback} />

          <props.entry.Content components={components} />

          {/* Prev / Next pagination — placed before the document utilities
              section to match the Astro reference order: content → pager →
              view-source / history. In the Astro layout, BodyFootUtilArea was
              rendered by the doc-layout wrapper after the <slot /> content,
              so the pager (inside the slot) came first. Fixes #1535. */}
          <DocPager prev={prev} next={next} locale={locale} />

          {/* Document utilities (revision history + view-source link) — skipped for unlisted pages */}
          {!props.entry.data.unlisted && (
            <DocHistoryArea
              slug={slug}
              locale={locale}
              entrySlug={props.entry.slug}
              contentDir={contentDir}
            />
          )}
        </>
      )}
    </DocLayoutWithDefaults>
  );
}
