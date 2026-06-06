/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the versioned EN docs route.
//
// Optional-catchall [[...slug]] so slug=[] (empty) routes to /v/<ver>/docs/
// when a versioned root index.mdx exists — toSlugParams("") returns [].
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

import { settings } from "@/config/settings";
import type { VersionConfig } from "@/config/settings";
import { t } from "@/config/i18n";
import { docsUrl, versionedDocsUrl, absoluteUrl } from "@/utils/base";
import {
  buildNavTree,
  buildBreadcrumbs,
  collectAutoIndexNodes,
  type NavNode,
} from "@/utils/docs";
import { getNavSectionForSlug, getNavSubtree } from "@/utils/nav-scope";
import { toRouteSlug, toSlugParams } from "@/utils/slug";
// Locale-aware MDX components factory — see `pages/_mdx-components.ts`.
import { createMdxComponents } from "../../../_mdx-components";
import type { JSX } from "preact";
import { resolveNavSource } from "../../../lib/_nav-source-docs";
import { extractHeadings } from "../../../lib/_extract-headings";
import type { DocPageEntry, AutoIndexNode, DocPageEntryProps, DocPageAutoIndexProps } from "../../../lib/doc-page-props";
import { DocMetainfoArea } from "../../../lib/_doc-metainfo-area";
import { buildInlineVersionSwitcher } from "../../../lib/_inline-version-switcher";
import { DocContentHeader } from "../../../lib/_doc-content-header";
import { DocPageShell } from "../../../lib/_doc-page-shell";
import { resolveDocPrevNext, flattenSubtree, rewriteNavHref, remapNavChildHrefs } from "../../../lib/_doc-route-paths";

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
    // Identity-stable nav source for this version (EN base, draft-filtered,
    // unlisted retained). Reused across the route's per-page paths()
    // invocations so buildNavTree's identity fast-path applies — see
    // pages/lib/_nav-source-docs.ts (#1902).
    const { docs: allDocs, navDocs, categoryMeta } = resolveNavSource("en", version.slug);
    // Versioned docs always use EN locale for nav tree
    const tree = buildNavTree(navDocs, "en", categoryMeta);

    // URL closure for THIS version — every versioned href (prev/next,
    // breadcrumb crumbs, auto-index cards) is produced by this single
    // function bound to the version slug. Because it is built per-version
    // inside this loop, a latest-page pagination override (resolved against
    // `tree` below) is rewritten through the VERSIONED closure for this route
    // only — it can never bleed into the latest route, which has no such
    // closure (#1916).
    const urlFor = (s: string): string => versionedDocsUrl(s, version.slug);

    // Regular doc pages
    for (const entry of allDocs) {
      const slug = entry.data.slug ?? toRouteSlug(entry.slug);
      const navSection = getNavSectionForSlug(slug);
      const subtree = getNavSubtree(tree, navSection);

      // Prev/next + pagination overrides against THIS version's own `tree`,
      // then hrefs rewritten to the versioned URL form via urlFor.
      const { prev: prevNode, next: nextNode } = resolveDocPrevNext(
        tree,
        flattenSubtree(subtree),
        slug,
        entry.data,
      );

      result.push({
        params: { version: version.slug, slug: toSlugParams(slug) },
        props: {
          kind: "entry",
          entry,
          version,
          // #1916 #1: breadcrumb crumbs remapped to the versioned URL space.
          breadcrumbs: buildBreadcrumbs(tree, slug, "en", urlFor),
          prev: rewriteNavHref(prevNode, urlFor),
          next: rewriteNavHref(nextNode, urlFor),
          headings: extractHeadings(entry.body ?? ""),
        },
      });
    }

    // Auto-generated index pages for categories without index.mdx
    for (const node of collectAutoIndexNodes(tree)) {
      result.push({
        params: { version: version.slug, slug: toSlugParams(node.slug) },
        props: {
          kind: "autoIndex",
          autoIndex: {
            ...node,
            // #1916 #2: child-card hrefs ALWAYS resolve to the versioned URL.
            children: remapNavChildHrefs(node.children, urlFor) as NavNode[],
          } as AutoIndexNode,
          version,
          // #1916 #1: breadcrumb crumbs remapped to the versioned URL space.
          breadcrumbs: buildBreadcrumbs(tree, node.slug, "en", urlFor),
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

  // #1916 #2: child cards already carry versioned hrefs from paths(); just
  // filter to renderable nodes here.
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
  const currentPath = versionedDocsUrl(slug, version.slug, locale);
  const canonical = absoluteUrl(currentPath);

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
    <DocPageShell
      kind={props.kind}
      locale={locale}
      slug={slug}
      title={title}
      description={description}
      canonical={canonical}
      breadcrumbs={breadcrumbs}
      prev={prev}
      next={next}
      headings={headings}
      navSection={navSection}
      sidebarPersistKey={sidebarPersistKey}
      hideSidebar={hideSidebar}
      hideToc={props.kind === "entry" ? props.entry.data.hide_toc : undefined}
      currentPath={currentPath}
      currentVersion={version.slug}
      versionSwitcher={buildInlineVersionSwitcher(slug, locale, version.slug)}
      versionBanner={versionBannerType}
      versionBannerLatestUrl={versionBannerLatestUrl}
      versionBannerLabels={versionBannerLabels}
      autoIndexLabel={props.kind === "autoIndex" ? props.autoIndex.label : undefined}
      autoIndexChildren={autoIndexChildren}
      metainfoSlot={
        props.kind === "autoIndex" ? <DocMetainfoArea slug={slug} locale={locale} /> : null
      }
      contentHeaderSlot={
        props.kind === "entry" ? (
          <DocContentHeader entry={props.entry} slug={slug} locale={locale} />
        ) : undefined
      }
      contentSlot={
        props.kind === "entry" ? <props.entry.Content components={components} /> : undefined
      }
      // #1916 #5: doc-history hidden on versioned pages until versioned
      // history is supported.
      docHistorySlot={null}
    />
  );
}
