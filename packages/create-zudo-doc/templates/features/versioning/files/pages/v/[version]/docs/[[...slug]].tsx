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
//
// Enumeration + per-entry derived data are built by the shared, memoized
// buildDocRouteEntries (#2010); rendering by the shared renderDocPage. This
// file owns only the route's nav source, its versioned URL closure, and the
// param/prop shapes.

import { settings } from "@/config/settings";
import type { VersionConfig } from "@/config/settings";
import { versionedDocsUrl } from "@/utils/base";
import type { JSX } from "preact";
import { resolveNavSource } from "../../../lib/_nav-source-docs";
import type { DocPageEntryProps, DocPageAutoIndexProps } from "../../../lib/doc-page-props";
import { buildDocRouteEntries } from "../../../lib/_doc-route-entries";
import { renderDocPage } from "../../../lib/_doc-page-renderer";

export const frontmatter = { title: "Docs" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
    // invocations so buildNavTree's identity fast-path and the
    // buildDocRouteEntries memo apply — see pages/lib/_nav-source-docs.ts
    // (#1902). Versioned docs always use EN locale for the nav tree.
    const source = resolveNavSource("en", version.slug);

    // URL closure for THIS version — every versioned href (prev/next,
    // breadcrumb crumbs, auto-index cards) is produced by this single
    // function bound to the version slug. Because it is built per-version
    // inside this loop, a latest-page pagination override is rewritten
    // through the VERSIONED closure for this route only — it can never bleed
    // into the latest route, which has no such closure (#1916).
    const urlFor = (s: string): string => versionedDocsUrl(s, version.slug);

    for (const item of buildDocRouteEntries({
      source,
      locale: "en",
      routeSig: `v-docs;${version.slug}`,
      urlFor,
    })) {
      result.push({
        params: { version: version.slug, slug: item.slugParams },
        props:
          item.props.kind === "entry"
            ? { ...item.props, version }
            : { ...item.props, version },
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
  return renderDocPage(props, {
    locale: "en",
    version: props.version,
  });
}
