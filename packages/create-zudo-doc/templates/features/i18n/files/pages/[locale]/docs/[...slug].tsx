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
// i18n / locale routing:
//   - Default locale (EN) is handled by pages/docs/[...slug].tsx
//     (prefixDefaultLocale: false).
//   - Non-default locales emit /{locale}/docs/{slug}.
//   - Locale-first merge: locale docs take priority; base EN docs fill in
//     pages not translated yet (shown with a fallback notice).

import { getCollection } from "zfb/content";
import type { DocsEntry } from "@/types/docs-entry";
import { settings } from "@/config/settings";
import { t, getContentDir } from "@/config/i18n";
import { docsUrl } from "@/utils/base";
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
import { FrontmatterPreview } from "@takazudo/zudo-doc/metainfo";
import { frontmatterRenderers } from "@/config/frontmatter-preview-renderers";
// Shared MDX components bag — see `pages/_mdx-components.ts`.
import { createMdxComponents } from "../../_mdx-components";
import type { JSX } from "preact";
import { bridgeEntries, loadDocs } from "../../_data";
import { mergeLocaleDocs, mergeCategoryMeta } from "../../lib/locale-merge";
import { extractHeadings } from "../../lib/_extract-headings";
import type { DocPageEntry, AutoIndexNode, DocPageEntryProps, DocPageAutoIndexProps } from "../../lib/doc-page-props";
import { FooterWithDefaults } from "../../lib/_footer-with-defaults";
import { DocHistoryArea } from "../../lib/_doc-history-area";
import { BodyEndIslands } from "../../lib/_body-end-islands";
import { DocMetainfoArea } from "../../lib/_doc-metainfo-area";
import { DocTagsArea } from "../../lib/_doc-tags-area";
import { SidebarWithDefaults } from "../../lib/_sidebar-with-defaults";
import { HeaderWithDefaults } from "../../lib/_header-with-defaults";
import { HeadWithDefaults } from "../../lib/_head-with-defaults";
import { buildFrontmatterPreviewEntries } from "../../lib/_frontmatter-preview-data";
import { composeMetaTitle } from "../../lib/_compose-meta-title";
import { buildInlineVersionSwitcher } from "../../lib/_inline-version-switcher";
import DesktopSidebarToggle from "@/components/desktop-sidebar-toggle";
import { SidebarResizerInit } from "@takazudo/zudo-doc/sidebar-resizer";
import type { VNode } from "preact";
import { Island } from "@takazudo/zfb";

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

    // Load locale + base docs, filter drafts (using bridgeEntries to keep
    // DocPageEntry shape with Content/module_specifier for the render props).
    const localeDocs = ((bridgeEntries(getCollection(`docs-${locale}`), `docs-${locale}`) as unknown as DocPageEntry[])).filter(
      (d) => !d.data.draft,
    );
    const baseDocs = ((bridgeEntries(getCollection("docs"), "docs") as unknown as DocPageEntry[])).filter(
      (d) => !d.data.draft,
    );

    // Merge: locale docs first, base fallback for untranslated pages.
    // localeSlugSet is returned so isFallback can be derived from it.
    const { docs: allDocs, localeSlugSet } = mergeLocaleDocs({
      baseDocs: baseDocs as unknown as DocsEntry[],
      localeDocs: localeDocs as unknown as DocsEntry[],
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });
    // isFallback: page came from base docs, not the locale collection.
    const fallbackSlugs = new Set(
      (allDocs as unknown as DocPageEntry[])
        .filter((d) => !localeSlugSet.has(d.data.slug ?? d.id))
        .map((d) => d.data.slug ?? d.id),
    );

    const categoryMeta = mergeCategoryMeta(settings.docsDir, contentDir);

    const navDocs = allDocs.filter(isNavVisible);
    const tree = buildNavTree(navDocs, locale, categoryMeta);
    const fullTree = buildNavTree(allDocs, locale, categoryMeta);

    // Regular doc pages
    for (const entry of allDocs) {
      const slug = entry.data.slug ?? entry.id;
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
        params: { locale, slug: slug.split("/") },
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
        params: { locale, slug: node.slug.split("/") },
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
      afterSidebar={
        settings.sidebarToggle ? (
          <>
            <script dangerouslySetInnerHTML={{
              __html: `(function(){try{if(localStorage.getItem('zudo-doc-sidebar-visible')==='false'){document.documentElement.setAttribute('data-sidebar-hidden','');}}catch(e){}})();`,
            }} />
            {Island({
              when: "load",
              children: <DesktopSidebarToggle />,
            }) as unknown as VNode}
          </>
        ) : undefined
      }
      footerOverride={<FooterWithDefaults lang={locale} />}
      bodyEndComponents={
        <>
          <BodyEndIslands basePath={settings.base ?? "/"} />
          {settings.sidebarResizer && <SidebarResizerInit />}
        </>
      }
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
          <h1 class="text-heading font-bold mb-vsp-xs">{props.entry.data.title}</h1>

          {/* Build-time date block (Created / Updated / Author).
              doc-metainfo placement — between <h1> and description.
              Data from `.zfb/doc-history-meta.json` (esbuild-inlined, no fs). */}
          <DocMetainfoArea slug={slug} locale={locale} />

          {/* Page-level tag chips — matching doc-tags placement (#1658). */}
          <DocTagsArea slug={slug} locale={locale} tags={props.entry.data.tags} />

          {/* Fallback notice for non-translated pages */}
          {isFallback && !props.entry.data.generated && (
            <div
              class="mb-vsp-md border border-info/30 bg-info/5 px-hsp-lg py-vsp-sm text-small text-muted rounded"
              role="note"
            >
              {t("doc.fallbackNotice", locale)}
            </div>
          )}

          {props.entry.data.description && (
            <p class="mb-vsp-lg text-title text-muted">
              {props.entry.data.description}
            </p>
          )}

          {/* Frontmatter preview — non-system, custom keys only. Returns
              null when the entries array is empty, so pages without
              custom frontmatter emit nothing. Custom per-key renderers
              from frontmatter-preview-renderers.tsx produce styled cells
              (pills, badges, etc.) instead of plain text. */}
          <FrontmatterPreview
            entries={buildFrontmatterPreviewEntries(props.entry.data)}
            title={t("frontmatter.preview.title", locale)}
            keyColLabel={t("frontmatter.preview.keyCol", locale)}
            valueColLabel={t("frontmatter.preview.valueCol", locale)}
            renderers={frontmatterRenderers}
            data={props.entry.data as Record<string, unknown>}
            locale={locale}
          />

          <props.entry.Content components={components} />

          {/* Prev / Next pagination — placed before the document utilities
              section to match the Astro reference order: content → pager →
              view-source / history. In the Astro layout, BodyFootUtilArea was
              rendered by the doc-layout wrapper after the <slot /> content,
              so the pager (inside the slot) came first. Fixes #1535. */}
          <nav class="mt-vsp-2xl grid grid-cols-2 gap-hsp-xl">
            {prev ? (
              <a
                href={prev.href}
                class="group border border-muted rounded-lg p-hsp-lg hover:border-accent"
              >
                <div class="flex items-center gap-hsp-xs text-caption text-muted mb-vsp-2xs">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-[1.125rem] w-[1.125rem]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span class="no-underline">{t("nav.previous", locale)}</span>
                </div>
                <p class="text-small font-semibold underline group-hover:text-accent">
                  {prev.label}
                </p>
              </a>
            ) : (
              <div />
            )}
            {next ? (
              <a
                href={next.href}
                class="group border border-muted rounded-lg p-hsp-lg hover:border-accent text-right"
              >
                <div class="flex items-center justify-end gap-hsp-xs text-caption text-muted mb-vsp-2xs">
                  <span class="no-underline">{t("nav.next", locale)}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-[1.125rem] w-[1.125rem]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p class="text-small font-semibold underline group-hover:text-accent">
                  {next.label}
                </p>
              </a>
            ) : (
              <div />
            )}
          </nav>

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
