/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Port of src/pages/v/[version]/docs/[...slug].astro → zfb page module.
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
import type { CollectionEntry } from "zfb/content";
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
  type BreadcrumbItem,
} from "@/utils/docs";
import { getNavSectionForSlug, getNavSubtree } from "@/utils/nav-scope";
import { toRouteSlug } from "@/utils/slug";
import { DocLayoutWithDefaults } from "@zudo-doc/zudo-doc-v2/doclayout";
import { Breadcrumb } from "@zudo-doc/zudo-doc-v2/breadcrumb";
import { NavCardGrid } from "@zudo-doc/zudo-doc-v2/nav-indexing";
import { FrontmatterPreview } from "@zudo-doc/zudo-doc-v2/metainfo";
// Locale-aware MDX components factory — see `pages/_mdx-components.ts`.
import { createMdxComponents } from "../../../_mdx-components";
import type { JSX } from "preact";
import { bridgeEntries } from "../../../_data";
import { extractHeadings } from "../../../lib/_extract-headings";
import { FooterWithDefaults } from "../../../lib/_footer-with-defaults";
import { SidebarWithDefaults } from "../../../lib/_sidebar-with-defaults";
import { HeaderWithDefaults } from "../../../lib/_header-with-defaults";
import { HeadWithDefaults } from "../../../lib/_head-with-defaults";
import { DocHistoryArea } from "../../../lib/_doc-history-area";
import { DocMetainfoArea } from "../../../lib/_doc-metainfo-area";
import { BodyEndIslands } from "../../../lib/_body-end-islands";
import { buildFrontmatterPreviewEntries } from "../../../lib/_frontmatter-preview-data";
import { composeMetaTitle } from "../../../lib/_compose-meta-title";

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
  breadcrumbs: BreadcrumbItem[];
  prev: NavNode | null;
  next: NavNode | null;
  /** Depth-2/3/4 headings extracted from the MDX body, for SSG TOC links. */
  headings: ReturnType<typeof extractHeadings>;
}

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
          entry: null,
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

interface PageArgs {
  params: { version: string; slug: string[] };
  props: DocPageProps;
}

export default function VersionedDocsPage({ props }: PageArgs): JSX.Element {
  const { entry, autoIndex, version, breadcrumbs, prev, next, headings } = props;
  const locale = "en";

  const slug = autoIndex
    ? autoIndex.slug
    : (entry!.data.slug ?? toRouteSlug(entry!.slug));

  const title = autoIndex ? autoIndex.label : entry!.data.title;
  const description = autoIndex ? autoIndex.description : entry!.data.description;

  // Locale-aware components bag — creates nav wrappers bound to the active
  // locale so CategoryNav/CategoryTreeNav/SiteTreeNav query the right collection.
  const components = createMdxComponents(locale);

  const autoIndexChildren = autoIndex
    ? autoIndex.children.filter((c: NavNode) => c.hasPage || c.children.length > 0)
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

  return (
    <DocLayoutWithDefaults
      title={composeMetaTitle(title)}
      description={description}
      head={<HeadWithDefaults title={title} description={description} />}
      lang={locale}
      noindex={settings.noindex}
      hideSidebar={entry?.data?.hide_sidebar}
      hideToc={entry?.data?.hide_toc}
      headings={headings}
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
      bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} />}
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
              custom frontmatter emit nothing. */}
          <FrontmatterPreview
            entries={buildFrontmatterPreviewEntries(entry!.data)}
            title={t("frontmatter.preview.title", locale)}
            keyColLabel={t("frontmatter.preview.keyCol", locale)}
            valueColLabel={t("frontmatter.preview.valueCol", locale)}
          />

          {entry && <entry.Content components={components} />}

          {/* Document utilities (revision history) — gated on entry, matching regular slug page pattern */}
          {entry && (
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
