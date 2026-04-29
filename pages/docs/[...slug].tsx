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
// Shared MDX-tag → Preact-component bag. Includes htmlOverrides
// (native typography), HtmlPreviewWrapper (Island), and stub bindings
// for every other custom tag the MDX corpus references — see
// `pages/_mdx-components.ts` for the full list and rationale.
import { mdxComponents } from "../_mdx-components";
import { FooterWithDefaults } from "../lib/_footer-with-defaults";
import { DocHistoryArea } from "../lib/_doc-history-area";
import { SidebarWithDefaults } from "../lib/_sidebar-with-defaults";
import { HeaderWithDefaults } from "../lib/_header-with-defaults";
import { HeadWithDefaults } from "../lib/_head-with-defaults";
import type { JSX } from "preact";
import { bridgeEntries } from "../_data";

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
  props: DocPageProps;
}

export default function DocsPage({ props }: PageArgs): JSX.Element {
  const { entry, autoIndex, breadcrumbs, prev, next } = props;
  const locale = defaultLocale;

  const slug = autoIndex
    ? autoIndex.slug
    : (entry!.data.slug ?? toRouteSlug(entry!.slug));

  const title = autoIndex ? autoIndex.label : entry!.data.title;
  const description = autoIndex ? autoIndex.description : entry!.data.description;

  // Shared components bag — see `pages/_mdx-components.ts`.
  const components = mdxComponents;

  // Resolve child hrefs for auto-index pages
  const autoIndexChildren = autoIndex
    ? autoIndex.children
        .filter((c: NavNode) => c.hasPage || c.children.length > 0)
        .map((c: NavNode) => ({
          ...c,
          href: c.href ?? docsUrl(c.slug, locale),
        }))
    : [];

  return (
    <DocLayoutWithDefaults
      title={title}
      description={description}
      head={<HeadWithDefaults title={title} description={description} />}
      lang={locale}
      hideSidebar={entry?.data?.hide_sidebar}
      hideToc={entry?.data?.hide_toc}
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
      footerOverride={<FooterWithDefaults lang={locale} />}
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

          {entry!.data.description && (
            <p class="mt-0 mb-vsp-lg text-subheading text-muted">
              {entry!.data.description}
            </p>
          )}

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
