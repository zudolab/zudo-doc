/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the versioned non-default-locale docs route.
//
// Optional-catchall [[...slug]] so slug=[] (empty) routes to /v/<ver>/<locale>/docs/
// when a versioned locale root index.mdx exists — toSlugParams("") returns [].
//
// Versioned locale docs route. paths() cross-products settings.versions ×
// configured per-version locales with a locale-first merge strategy:
// locale-specific collection (`docs-v-${version.slug}-${locale}`) takes
// priority; the base EN collection (`docs-v-${version.slug}`) fills in
// pages not translated yet (shown with a fallback notice).
//
// If version.locales?.[locale] is not configured, only the base EN collection is used.
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { version: string; locale: string; slug: string[] }
//   props:  { entry, autoIndex, version, contentDir, isFallback, breadcrumbs, prev, next }
//
// Prev/next hrefs are pre-resolved to the versioned locale URL form
// (e.g. /v/1.0/ja/docs/…) so the component needs no URL computation.

import type { DocsEntry } from "@/types/docs-entry";
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
import { createMdxComponents } from "../../../../_mdx-components";
import type { JSX } from "preact";
import { resolveVersionedLocaleSource } from "../../../../lib/_nav-source-docs";
import { extractHeadings } from "../../../../lib/_extract-headings";
import type { DocPageEntry, AutoIndexNode, DocPageEntryProps, DocPageAutoIndexProps } from "../../../../lib/doc-page-props";
import { DocMetainfoArea } from "../../../../lib/_doc-metainfo-area";
import { buildInlineVersionSwitcher } from "../../../../lib/_inline-version-switcher";
import { DocContentHeader } from "../../../../lib/_doc-content-header";
import { DocPageShell } from "../../../../lib/_doc-page-shell";
import { resolveDocPrevNext, flattenSubtree, rewriteNavHref, remapNavChildHrefs } from "../../../../lib/_doc-route-paths";

export const frontmatter = { title: "Docs" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// DocPageEntry, AutoIndexNode imported from pages/lib/doc-page-props.ts

/** Route-specific extra fields — present on both branches of the union. */
interface VersionedLocaleDocPageExtra {
  /** The version config for the active version. */
  version: VersionConfig;
  /** Content directory for this page (locale dir if translated, version docsDir if fallback). */
  contentDir: string;
  /** True when this page falls back to the base EN collection for this version. */
  isFallback: boolean;
}

type DocPageProps =
  | (DocPageEntryProps & VersionedLocaleDocPageExtra)
  | (DocPageAutoIndexProps & VersionedLocaleDocPageExtra);

// ---------------------------------------------------------------------------
// paths() — synchronous (ADR-004)
// ---------------------------------------------------------------------------

/**
 * Emit one route per (version, locale, slug) combination for all non-default locales.
 *
 * Cross-products settings.versions × Object.keys(settings.locales) (which are
 * the non-default locales — default EN is handled by v/[version]/docs/[...slug].tsx).
 *
 * Merge strategy per (version, locale):
 *   1. Load locale docs (e.g. "docs-v-1.0-ja") if version.locales[locale] is set.
 *   2. Load base EN docs ("docs-v-1.0").
 *   3. Locale docs take priority; base EN fills in slugs not translated.
 *   4. Track fallback slugs for the fallback-notice banner.
 *   5. Build nav tree with the active locale, compute breadcrumbs and prev/next.
 *
 * Prev/next hrefs are pre-resolved to the versioned locale URL form.
 */
export function paths(): Array<{
  params: { version: string; locale: string; slug: string[] };
  props: DocPageProps;
}> {
  if (!settings.versions) return [];

  const result: Array<{
    params: { version: string; locale: string; slug: string[] };
    props: DocPageProps;
  }> = [];

  for (const version of settings.versions) {
    for (const locale of Object.keys(settings.locales) as string[]) {
      const localeDir = version.locales?.[locale]?.dir;

      // Identity-stable, locale-first merge over the version's EN base. Reused
      // across the route's per-page paths() invocations so buildNavTree's
      // identity fast-path applies — see pages/lib/_nav-source-docs.ts (#1902).
      const { docs: allDocs, navDocs, categoryMeta, localeSlugSet } =
        resolveVersionedLocaleSource(version.slug, version.docsDir, locale, localeDir, {
          applyDefaultLocaleOnlyFilter: true,
          keepUnlisted: true,
        });
      // isFallback: page came from base docs, not the locale collection.
      // toRouteSlug keeps Set keys and lookup keys in lockstep — a versioned
      // root index has entry.slug="index" (storage form) but route slug="" so
      // d.id would diverge from the lookup key after the #1891 toRouteSlug flip.
      const fallbackSlugs = new Set(
        allDocs
          .filter((d) => !localeSlugSet.has(d.data.slug ?? toRouteSlug(d.slug)))
          .map((d) => d.data.slug ?? toRouteSlug(d.slug)),
      );

      const tree = buildNavTree(navDocs as unknown as DocsEntry[], locale, categoryMeta);

      // URL closure for THIS (version, locale) — every versioned-locale href
      // (prev/next, breadcrumb crumbs, auto-index cards) is produced by this
      // single function bound to the version slug + locale, resolved against
      // this route's own `tree` (#1916).
      const urlFor = (s: string): string => versionedDocsUrl(s, version.slug, locale);

      // Regular doc pages
      for (const entry of allDocs) {
        const slug = entry.data.slug ?? toRouteSlug(entry.slug);
        const isFallback = fallbackSlugs.has(slug);
        const entryContentDir = isFallback ? version.docsDir : (localeDir ?? version.docsDir);

        const navSection = getNavSectionForSlug(slug);
        const subtree = getNavSubtree(tree, navSection);

        const { prev: prevNode, next: nextNode } = resolveDocPrevNext(
          tree,
          flattenSubtree(subtree),
          slug,
          entry.data,
        );

        result.push({
          params: { version: version.slug, locale, slug: toSlugParams(slug) },
          props: {
            kind: "entry",
            entry: entry as unknown as DocPageEntry,
            version,
            contentDir: entryContentDir,
            isFallback,
            // #1916 #1: breadcrumb crumbs remapped to the versioned locale URL.
            breadcrumbs: buildBreadcrumbs(tree, slug, locale, urlFor),
            prev: rewriteNavHref(prevNode, urlFor),
            next: rewriteNavHref(nextNode, urlFor),
            headings: extractHeadings(entry.body ?? ""),
          },
        });
      }

      // Auto-generated index pages for categories without index.mdx
      for (const node of collectAutoIndexNodes(tree)) {
        result.push({
          params: { version: version.slug, locale, slug: toSlugParams(node.slug) },
          props: {
            kind: "autoIndex",
            autoIndex: {
              ...node,
              // #1916 #2: child-card hrefs ALWAYS resolve to the versioned URL.
              children: remapNavChildHrefs(node.children, urlFor) as NavNode[],
            } as AutoIndexNode,
            version,
            contentDir: localeDir ?? version.docsDir,
            isFallback: false,
            // #1916 #1: breadcrumb crumbs remapped to the versioned locale URL.
            breadcrumbs: buildBreadcrumbs(tree, node.slug, locale, urlFor),
            prev: null,
            next: null,
            headings: [],
          },
        });
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

type PageArgs = DocPageProps & { params: { version: string; locale: string; slug: string[] } };

export default function VersionedLocaleDocsPage(props: PageArgs): JSX.Element {
  const { breadcrumbs, prev, next, headings, version, isFallback } = props;
  const locale = props.params.locale;

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
  // current page (slug-preserving — strips the /v/{version}/ prefix,
  // keeps the /{locale}/ locale prefix).
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

  // Canonical URL — versioned locale pages use the versioned locale URL as canonical.
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
      // #1916 #6: add DocMetainfoArea for chrome parity with the other 3
      // doc routes (its absence here was accidental drift, not intentional).
      metainfoSlot={
        props.kind === "autoIndex" ? <DocMetainfoArea slug={slug} locale={locale} /> : null
      }
      contentHeaderSlot={
        props.kind === "entry" ? (
          <DocContentHeader entry={props.entry} slug={slug} locale={locale} isFallback={isFallback} />
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
