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
//
// Enumeration + per-entry derived data are built by the shared, memoized
// buildDocRouteEntries (#2010); rendering by the shared renderDocPage. This
// file owns only the route's nav source, its versioned-locale URL closure,
// and the param/prop shapes.

import { settings } from "@/config/settings";
import type { VersionConfig } from "@/config/settings";
import { versionedDocsUrl } from "@/utils/base";
import type { JSX } from "preact";
import { resolveVersionedLocaleSource } from "../../../../lib/_nav-source-docs";
import type { DocPageEntryProps, DocPageAutoIndexProps } from "../../../../lib/doc-page-props";
import { buildDocRouteEntries } from "../../../../lib/_doc-route-entries";
import { renderDocPage } from "../../../../lib/_doc-page-renderer";

export const frontmatter = { title: "Docs" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
      // identity fast-path and the buildDocRouteEntries memo apply — see
      // pages/lib/_nav-source-docs.ts (#1902).
      const source = resolveVersionedLocaleSource(
        version.slug,
        version.docsDir,
        locale,
        localeDir,
        { applyDefaultLocaleOnlyFilter: true, keepUnlisted: true },
      );

      // URL closure for THIS (version, locale) — every versioned-locale href
      // (prev/next, breadcrumb crumbs, auto-index cards) is produced by this
      // single function bound to the version slug + locale, resolved against
      // this route's own tree (#1916).
      const urlFor = (s: string): string => versionedDocsUrl(s, version.slug, locale);

      for (const item of buildDocRouteEntries({
        source,
        locale,
        routeSig: `v-locale-docs;${version.slug};${locale}`,
        urlFor,
      })) {
        // isFallback: page came from the version's base EN docs, not the
        // locale collection. Always false for autoIndex items.
        const extra: VersionedLocaleDocPageExtra = {
          version,
          contentDir: item.isFallback
            ? version.docsDir
            : (localeDir ?? version.docsDir),
          isFallback: item.isFallback,
        };
        result.push({
          params: { version: version.slug, locale, slug: item.slugParams },
          props:
            item.props.kind === "entry"
              ? { ...item.props, ...extra }
              : { ...item.props, ...extra },
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
  return renderDocPage(props, {
    locale: props.params.locale,
    version: props.version,
    isFallback: props.isFallback,
  });
}
