/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Port of src/pages/v/[version]/ja/docs/[...slug].astro → zfb page module.
//
// Versioned JA docs route. paths() cross-products settings.versions with a
// locale-first merge strategy: locale-specific collection (`docs-v-${version.slug}-ja`)
// takes priority; the base EN collection (`docs-v-${version.slug}`) fills in
// pages not translated yet (shown with a fallback notice).
//
// If version.locales?.ja is not configured, only the base EN collection is used.
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { version: string; slug: string[] }
//   props:  { entry, autoIndex, version, contentDir, isFallback, breadcrumbs, prev, next }
//
// Prev/next hrefs are pre-resolved to the versioned JA URL form
// (e.g. /v/1.0/ja/docs/…) so the component needs no URL computation.

import { getCollection } from "zfb/content";
import type { CollectionEntry } from "zfb/content";
import type { DocsEntry } from "@/types/docs-entry";
import { settings } from "@/config/settings";
import type { VersionConfig } from "@/config/settings";
import { t } from "@/config/i18n";
import { versionedDocsUrl } from "@/utils/base";
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
import { mdxComponents } from "../../../../_mdx-components";
import type { JSX } from "preact";
import { bridgeEntries } from "../../../../_data";
import { FooterWithDefaults } from "../../../../lib/_footer-with-defaults";
import { SidebarWithDefaults } from "../../../../lib/_sidebar-with-defaults";
import { HeaderWithDefaults } from "../../../../lib/_header-with-defaults";

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
  /** The version config for the active version. */
  version: VersionConfig;
  /** Content directory for this page (locale dir if translated, version docsDir if fallback). */
  contentDir: string;
  /** True when this page falls back to the base EN collection for this version. */
  isFallback: boolean;
  breadcrumbs: BreadcrumbItem[];
  prev: NavNode | null;
  next: NavNode | null;
}

// ---------------------------------------------------------------------------
// paths() — synchronous (ADR-004)
// ---------------------------------------------------------------------------

/**
 * Emit one route per (version, slug) combination for JA locale.
 *
 * Merge strategy per version:
 *   1. Load locale docs (e.g. "docs-v-1.0-ja") if version.locales.ja is set.
 *   2. Load base EN docs ("docs-v-1.0").
 *   3. Locale docs take priority; base EN fills in slugs not translated.
 *   4. Track fallback slugs for the fallback-notice banner.
 *   5. Build nav tree with "ja" locale, compute breadcrumbs and prev/next.
 *
 * Prev/next hrefs are pre-resolved to the versioned JA URL form.
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
    const baseCollectionName = `docs-v-${version.slug}`;
    const localeDir = (version.locales as Record<string, { dir: string }> | undefined)?.ja?.dir;
    const localeCollectionName = localeDir ? `docs-v-${version.slug}-ja` : null;

    const baseDocs = ((bridgeEntries(getCollection(baseCollectionName), baseCollectionName) as unknown as DocPageEntry[])).filter(
      (doc) => !doc.data.draft,
    );
    const localeDocs = localeCollectionName
      ? ((bridgeEntries(getCollection(localeCollectionName), localeCollectionName) as unknown as DocPageEntry[])).filter(
          (doc) => !doc.data.draft,
        )
      : [];

    // Build slug set from locale docs (locale takes priority)
    const localeSlugSet = new Set(localeDocs.map((d) => d.data.slug ?? toRouteSlug(d.slug)));

    // Merge: locale docs first, then base docs for missing pages
    const fallbackDocs = baseDocs.filter(
      (d) => !localeSlugSet.has(d.data.slug ?? toRouteSlug(d.slug)),
    );
    const fallbackSlugs = new Set(fallbackDocs.map((d) => d.data.slug ?? toRouteSlug(d.slug)));
    const allDocs = [...localeDocs, ...fallbackDocs];

    // Merge category metadata: base first, locale overrides
    const baseCategoryMeta = loadCategoryMeta(version.docsDir);
    const localeCategoryMeta = localeDir ? loadCategoryMeta(localeDir) : new Map();
    const categoryMeta = new Map([...baseCategoryMeta, ...localeCategoryMeta]);

    const navDocs = allDocs.filter(isNavVisible);
    const tree = buildNavTree(navDocs as unknown as DocsEntry[], "ja", categoryMeta);

    // Regular doc pages
    for (const entry of allDocs) {
      const slug = entry.data.slug ?? toRouteSlug(entry.slug);
      const isFallback = fallbackSlugs.has(slug);
      const entryContentDir = isFallback ? version.docsDir : (localeDir ?? version.docsDir);

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
          entry,
          version,
          contentDir: entryContentDir,
          isFallback,
          breadcrumbs: buildBreadcrumbs(tree, slug, "ja"),
          // Pre-resolve prev/next hrefs to versioned JA URLs
          prev: prevNode
            ? { ...prevNode, href: versionedDocsUrl(prevNode.slug, version.slug, "ja") }
            : null,
          next: nextNode
            ? { ...nextNode, href: versionedDocsUrl(nextNode.slug, version.slug, "ja") }
            : null,
        },
      });
    }

    // Auto-generated index pages for categories without index.mdx
    for (const node of collectAutoIndexNodes(tree)) {
      result.push({
        params: { version: version.slug, slug: node.slug.split("/") },
        props: {
          entry: null,
          autoIndex: {
            ...node,
            children: node.children.map((c: NavNode) => ({
              ...c,
              href: c.href ?? versionedDocsUrl(c.slug, version.slug, "ja"),
            })) as NavNode[],
          } as AutoIndexNode,
          version,
          contentDir: localeDir ?? version.docsDir,
          isFallback: false,
          breadcrumbs: buildBreadcrumbs(tree, node.slug, "ja"),
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
  params: { version: string; slug: string[] };
  props: DocPageProps;
}

export default function VersionedJaDocsPage({ props }: PageArgs): JSX.Element {
  const { entry, autoIndex, version, isFallback, breadcrumbs, prev, next } = props;
  const locale = "ja";

  const slug = autoIndex
    ? autoIndex.slug
    : (entry!.data.slug ?? toRouteSlug(entry!.slug));

  const title = autoIndex ? autoIndex.label : entry!.data.title;
  const description = autoIndex ? autoIndex.description : entry!.data.description;

  const components = mdxComponents;

  const autoIndexChildren = autoIndex
    ? autoIndex.children.filter((c: NavNode) => c.hasPage || c.children.length > 0)
    : [];

  return (
    <DocLayoutWithDefaults
      title={title}
      description={description}
      lang={locale}
      hideSidebar={entry?.data?.hide_sidebar}
      hideToc={entry?.data?.hide_toc}
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
        breadcrumbs.length > 0 ? <Breadcrumb items={breadcrumbs} /> : undefined
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
