/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Port of src/pages/docs/[...slug].astro → zfb page module.
//
// Default-locale (EN) catch-all docs route. paths() enumerates every page in
// the "docs" collection plus auto-generated category index pages (for
// categories without an index.mdx). Per-page props carry all pre-computed
// data so the component is a pure renderer with no collection reads.
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { slug: string[] }   — e.g. ["getting-started", "intro"]
//   props:  { entry, autoIndex, breadcrumbs, prev, next }
//
// The catchall slug is an array per zfb spec — the component joins it when
// deriving the string form (e.g. for Content lookups, breadcrumbs, etc.).
//
// Locale: defaultLocale (EN). Non-default locales are handled by
// pages/[locale]/docs/[...slug].tsx.

import { getCollection } from "zfb/content";
import type { CollectionEntry } from "zfb/content";
import type { DocsEntry } from "@/types/docs-entry";
import { settings } from "@/config/settings";
import { defaultLocale, t } from "@/config/i18n";
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
  type BreadcrumbItem,
} from "@/utils/docs";
import { getNavSectionForSlug, getNavSubtree } from "@/utils/nav-scope";
import { toRouteSlug } from "@/utils/slug";
import { DocLayoutWithDefaults } from "@zudo-doc/zudo-doc-v2/doclayout";
import { Breadcrumb } from "@zudo-doc/zudo-doc-v2/breadcrumb";
import { NavCardGrid } from "@zudo-doc/zudo-doc-v2/nav-indexing";
import { FrontmatterPreview } from "@zudo-doc/zudo-doc-v2/metainfo";
import { frontmatterRenderers } from "@/config/frontmatter-preview-renderers";
// Shared MDX-tag → Preact-component bag. Includes htmlOverrides
// (native typography), HtmlPreviewWrapper (Island), and stub bindings
// for every other custom tag the MDX corpus references — see
// `pages/_mdx-components.ts` for the full list and rationale.
import { createMdxComponents } from "../_mdx-components";
import { FooterWithDefaults } from "../lib/_footer-with-defaults";
import { DocHistoryArea } from "../lib/_doc-history-area";
import { DocMetainfoArea } from "../lib/_doc-metainfo-area";
import { BodyEndIslands } from "../lib/_body-end-islands";
import { SidebarWithDefaults } from "../lib/_sidebar-with-defaults";
import { HeaderWithDefaults } from "../lib/_header-with-defaults";
import { HeadWithDefaults } from "../lib/_head-with-defaults";
import { buildFrontmatterPreviewEntries } from "../lib/_frontmatter-preview-data";
import { composeMetaTitle } from "../lib/_compose-meta-title";
import type { JSX } from "preact";
import { bridgeEntries } from "../_data";
import { extractHeadings } from "../lib/_extract-headings";
import DesktopSidebarToggle from "@/components/desktop-sidebar-toggle";
import { SidebarResizerInit } from "@zudo-doc/zudo-doc-v2/sidebar-resizer";
import type { VNode } from "preact";
import { Island } from "@takazudo/zfb";

export const frontmatter = { title: "Docs" };

// ---------------------------------------------------------------------------
// Props contract
// ---------------------------------------------------------------------------

interface DocPageEntry extends DocsEntry {
  /** zfb content renderer. */
  Content: CollectionEntry<unknown>["Content"];
  /** zfb module specifier (for Content bridge). */
  module_specifier: string;
}

interface AutoIndexNode extends NavNode {
  children: NavNode[];
}

interface DocPageProps {
  /** The docs entry to render, or null for auto-index pages. */
  entry: DocPageEntry | null;
  /** Pre-built auto-index node (categories without index.mdx). */
  autoIndex?: AutoIndexNode;
  /** Breadcrumb trail, first item is home. */
  breadcrumbs: BreadcrumbItem[];
  /** Preceding page in the nav tree. */
  prev: NavNode | null;
  /** Following page in the nav tree. */
  next: NavNode | null;
  /** Depth-2/3/4 headings extracted from the MDX body, for SSG TOC links. */
  headings: ReturnType<typeof extractHeadings>;
}

// ---------------------------------------------------------------------------
// paths() — synchronous route enumeration (ADR-004)
// ---------------------------------------------------------------------------

/**
 * Enumerate all doc routes for the default locale (EN).
 *
 * Synchronous per ADR-004: getCollection() resolves from the pre-loaded
 * ContentSnapshot. All nav-tree and breadcrumb computation is done here
 * so the component is a pure renderer.
 */
export function paths(): Array<{
  params: { slug: string[] };
  props: DocPageProps;
}> {
  const locale = defaultLocale;
  const allDocs = (bridgeEntries(getCollection("docs"), "docs") as unknown as DocPageEntry[]);
  // In static builds, always exclude drafts.
  const docs = allDocs.filter((doc) => !doc.data.draft);
  const categoryMeta = loadCategoryMeta(settings.docsDir);

  // Nav docs: exclude unlisted (for sidebar/prev-next) but keep for breadcrumbs
  const navDocs = docs.filter(isNavVisible);
  const tree = buildNavTree(navDocs as unknown as DocsEntry[], locale, categoryMeta);
  // Full tree (including unlisted) for accurate breadcrumbs
  const fullTree = buildNavTree(docs as unknown as DocsEntry[], locale, categoryMeta);

  const result: Array<{ params: { slug: string[] }; props: DocPageProps }> = [];

  // Regular doc pages
  for (const entry of docs) {
    const slug = entry.data.slug ?? toRouteSlug(entry.slug);
    const navSection = getNavSectionForSlug(slug);
    const subtree = getNavSubtree(tree, navSection);
    const flat = flattenTree(subtree);
    const idx = flat.findIndex((n) => n.slug === slug);

    let prevNode = idx > 0 ? flat[idx - 1] ?? null : null;
    let nextNode = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] ?? null : null;

    // Frontmatter pagination overrides
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
      params: { slug: slug.split("/") },
      props: {
        entry,
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
      params: { slug: node.slug.split("/") },
      props: {
        entry: null,
        autoIndex: node as AutoIndexNode,
        breadcrumbs: buildBreadcrumbs(fullTree, node.slug, locale),
        prev: null,
        next: null,
        headings: [],
      },
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

interface PageArgs {
  params: { slug: string[] };
  entry: DocPageProps["entry"];
  autoIndex?: DocPageProps["autoIndex"];
  breadcrumbs: DocPageProps["breadcrumbs"];
  prev: DocPageProps["prev"];
  next: DocPageProps["next"];
  headings: DocPageProps["headings"];
}

export default function DocsPage({ entry, autoIndex, breadcrumbs, prev, next, headings }: PageArgs): JSX.Element {
  const locale = defaultLocale;

  const slug = autoIndex
    ? autoIndex.slug
    : (entry!.data.slug ?? toRouteSlug(entry!.slug));

  const title = autoIndex ? autoIndex.label : entry!.data.title;
  const description = autoIndex ? autoIndex.description : entry!.data.description;

  // Locale-aware components bag — creates nav wrappers bound to the active
  // locale so CategoryNav/CategoryTreeNav/SiteTreeNav query the right collection.
  const components = createMdxComponents(locale);

  // Resolve child hrefs for auto-index pages
  const autoIndexChildren = autoIndex
    ? autoIndex.children
        .filter((c: NavNode) => c.hasPage || c.children.length > 0)
        .map((c: NavNode) => ({
          ...c,
          href: c.href ?? docsUrl(c.slug, locale),
        }))
    : [];

  // Canonical URL — only when siteUrl is configured. pageUrl is the
  // base-prefixed path for this page without the siteUrl origin.
  const pageUrl = docsUrl(slug, locale);
  const canonical = settings.siteUrl
    ? settings.siteUrl.replace(/\/$/, "") + pageUrl
    : undefined;

  return (
    <DocLayoutWithDefaults
      title={composeMetaTitle(title)}
      description={description}
      head={<HeadWithDefaults title={title} description={description} canonical={canonical} />}
      lang={locale}
      noindex={settings.noindex}
      hideSidebar={entry?.data?.hide_sidebar}
      hideToc={entry?.data?.hide_toc}
      headings={headings}
      canonical={canonical}
      headerOverride={
        <HeaderWithDefaults
          lang={locale}
          currentSlug={slug}
          navSection={getNavSectionForSlug(slug)}
          currentPath={docsUrl(slug, locale)}
        />
      }
      breadcrumbOverride={
        breadcrumbs.length > 0 ? <Breadcrumb items={breadcrumbs} /> : undefined
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
        // Pre-paint inline script: restore persisted sidebar visibility to
        // <html data-sidebar-hidden> before first paint to avoid flash.
        // Runs unconditionally when sidebarToggle is enabled; the attribute
        // is only set when localStorage says "false" so the default (visible)
        // needs no attribute and causes no layout shift.
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
          {/* SidebarResizerInit: attach drag handle to #desktop-sidebar on load
              and on AFTER_NAVIGATE_EVENT (DOMContentLoaded under zfb's full-
              reload navigation model). Idempotent — safe on every page. */}
          {settings.sidebarResizer && <SidebarResizerInit />}
        </>
      }
    >
      {autoIndex ? (
        /* Auto-index page: category without an index.mdx */
        <div>
          <h1 class="text-heading font-bold mb-vsp-xs">{autoIndex.label}</h1>
          {autoIndex.description && (
            <p class="mt-0 mb-vsp-lg text-subheading text-muted">
              {autoIndex.description}
            </p>
          )}
          <NavCardGrid children={autoIndexChildren} />
        </div>
      ) : (
        /* Regular doc page */
        <div>
          <h1 class="text-heading font-bold mb-vsp-xs">{entry!.data.title}</h1>

          {/* Build-time date block (Created / Updated / Author). Mirrors the
              Astro `doc-metainfo.astro` placement — between <h1> and description.
              Data from `.zfb/doc-history-meta.json` (esbuild-inlined, no fs). */}
          <DocMetainfoArea slug={slug} locale={locale} />

          {entry!.data.description && (
            <p class="mt-0 mb-vsp-lg text-subheading text-muted">
              {entry!.data.description}
            </p>
          )}

          {/* Frontmatter preview — non-system, custom keys only. Returns
              null when the entries array is empty, so pages without
              custom frontmatter emit nothing. Custom per-key renderers
              from frontmatter-preview-renderers.tsx produce styled cells
              (pills, badges, etc.) instead of plain text. */}
          <FrontmatterPreview
            entries={buildFrontmatterPreviewEntries(entry!.data)}
            title={t("frontmatter.preview.title", locale)}
            keyColLabel={t("frontmatter.preview.keyCol", locale)}
            valueColLabel={t("frontmatter.preview.valueCol", locale)}
            renderers={frontmatterRenderers}
            data={entry!.data as Record<string, unknown>}
            locale={locale}
          />

          {/* MDX content rendered via zfb's Content bridge */}
          {entry && <entry.Content components={components} />}

          {/* Document utilities (revision history + view-source link) — skipped for unlisted pages */}
          {!entry!.data.unlisted && (
            <DocHistoryArea
              slug={slug}
              locale={locale}
              entrySlug={entry!.slug}
              contentDir={settings.docsDir}
            />
          )}

          {/* Prev / Next pagination */}
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
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15 19l-7-7 7-7"
                    />
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
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M9 5l7 7-7 7"
                    />
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
        </div>
      )}
    </DocLayoutWithDefaults>
  );
}
