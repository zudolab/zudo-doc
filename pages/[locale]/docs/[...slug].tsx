/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Port of src/pages/[locale]/docs/[...slug].astro → zfb page module.
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
import type { CollectionEntry } from "zfb/content";
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
  type BreadcrumbItem,
} from "@/utils/docs";
import { getNavSectionForSlug, getNavSubtree } from "@/utils/nav-scope";
import { toRouteSlug } from "@/utils/slug";
import { DocLayoutWithDefaults } from "@zudo-doc/zudo-doc-v2/doclayout";
import { Breadcrumb } from "@zudo-doc/zudo-doc-v2/breadcrumb";
import { NavCardGrid } from "@zudo-doc/zudo-doc-v2/nav-indexing";
// Shared MDX components bag — see `pages/_mdx-components.ts`.
import { mdxComponents } from "../../_mdx-components";
import type { JSX } from "preact";
import { bridgeEntries } from "../../_data";
import { FooterWithDefaults } from "../../lib/_footer-with-defaults";
import { DocHistoryArea } from "../../lib/_doc-history-area";

export const frontmatter = { title: "Docs" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocPageEntry extends DocsEntry {
  Content: CollectionEntry<unknown>["Content"];
  module_specifier: string;
}

interface AutoIndexNode extends NavNode {
  children: NavNode[];
}

interface DocPageProps {
  entry: DocPageEntry | null;
  autoIndex?: AutoIndexNode;
  /** Content directory for the active locale (or base EN for fallbacks). */
  contentDir: string;
  /** True when this page falls back to the base EN collection. */
  isFallback: boolean;
  breadcrumbs: BreadcrumbItem[];
  prev: NavNode | null;
  next: NavNode | null;
}

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
    const localeConfig = (settings.locales as Record<string, { dir: string }>)[locale];
    const contentDir = localeConfig?.dir ?? settings.docsDir;

    // Load locale + base docs, filter drafts
    const localeDocs = ((bridgeEntries(getCollection(`docs-${locale}`), `docs-${locale}`) as unknown as DocPageEntry[])).filter(
      (d) => !d.data.draft,
    );
    const baseDocs = ((bridgeEntries(getCollection("docs"), "docs") as unknown as DocPageEntry[])).filter(
      (d) => !d.data.draft,
    );

    const localeSlugSet = new Set(localeDocs.map((d) => d.data.slug ?? toRouteSlug(d.slug)));
    const fallbackDocs = baseDocs.filter(
      (d) => !localeSlugSet.has(d.data.slug ?? toRouteSlug(d.slug)),
    );
    const fallbackSlugs = new Set(fallbackDocs.map((d) => d.data.slug ?? toRouteSlug(d.slug)));
    const allDocs = [...localeDocs, ...fallbackDocs];

    // Merge category metadata: base first, locale overrides
    const baseCategoryMeta = loadCategoryMeta(settings.docsDir);
    const localeCategoryMeta = loadCategoryMeta(contentDir);
    const categoryMeta = new Map([...baseCategoryMeta, ...localeCategoryMeta]);

    const navDocs = allDocs.filter(isNavVisible);
    const tree = buildNavTree(navDocs as unknown as DocsEntry[], locale, categoryMeta);
    const fullTree = buildNavTree(allDocs as unknown as DocsEntry[], locale, categoryMeta);

    // Regular doc pages
    for (const entry of allDocs) {
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
        params: { locale, slug: slug.split("/") },
        props: {
          entry,
          contentDir: entryContentDir,
          isFallback,
          breadcrumbs: buildBreadcrumbs(fullTree, slug, locale),
          prev: prevNode,
          next: nextNode,
        },
      });
    }

    // Auto-generated index pages for categories without index.mdx
    for (const node of collectAutoIndexNodes(tree)) {
      result.push({
        params: { locale, slug: node.slug.split("/") },
        props: {
          entry: null,
          autoIndex: node as AutoIndexNode,
          contentDir,
          isFallback: false,
          breadcrumbs: buildBreadcrumbs(fullTree, node.slug, locale),
          prev: null,
          next: null,
        },
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

interface PageArgs {
  params: { locale: string; slug: string[] };
  props: DocPageProps;
}

export default function LocaleDocsPage({ params, props }: PageArgs): JSX.Element {
  const locale = params.locale;
  const { entry, autoIndex, isFallback, breadcrumbs, prev, next } = props;

  const slug = autoIndex
    ? autoIndex.slug
    : (entry!.data.slug ?? toRouteSlug(entry!.slug));

  const title = autoIndex ? autoIndex.label : entry!.data.title;
  const description = autoIndex ? autoIndex.description : entry!.data.description;

  const components = mdxComponents;

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
      lang={locale}
      hideSidebar={entry?.data?.hide_sidebar}
      hideToc={entry?.data?.hide_toc}
      breadcrumbOverride={
        breadcrumbs.length > 0 ? <Breadcrumb items={breadcrumbs} /> : undefined
      }
      footerOverride={<FooterWithDefaults lang={locale} />}
    >
      {autoIndex ? (
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
        <div>
          <h1 class="text-heading font-bold mb-vsp-xs">{entry!.data.title}</h1>

          {/* Fallback notice for non-translated pages */}
          {isFallback && !entry!.data.generated && (
            <div
              class="mb-vsp-md border border-info/30 bg-info/5 px-hsp-lg py-vsp-sm text-small text-muted rounded"
              role="note"
            >
              {t("doc.fallbackNotice", locale)}
            </div>
          )}

          {entry!.data.description && (
            <p class="mt-0 mb-vsp-lg text-subheading text-muted">
              {entry!.data.description}
            </p>
          )}

          {entry && <entry.Content components={components} />}

          {/* Document utilities (revision history) — skipped for unlisted pages */}
          {!entry!.data.unlisted && (
            <DocHistoryArea slug={slug} locale={locale} />
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
        </div>
      )}
    </DocLayoutWithDefaults>
  );
}
