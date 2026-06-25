/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Package route entrypoint: /v/[version]/docs/[[...slug]] — package-owned
// equivalent of pages/v/[version]/docs/[[...slug]].tsx (A1 #2361).
//
// Versioned EN docs route. The dynamic `[version]` pattern is injected ONCE;
// `paths()` enumerates one route per (version, slug) over the
// `docs-v-${version.slug}` collection, with versioned URL closures.

import type { JSX } from "preact";
import type { VersionConfig } from "../settings.js";
import type { DocPageEntryProps, DocPageAutoIndexProps } from "../doc-page-props/index.js";
import { settings, resolveNavSource, versionedDocsUrl, buildDocRouteEntries } from "./_context.js";
import { renderDocPage } from "./_chrome.js";

export const frontmatter = { title: "Docs" };

interface VersionedDocPageExtra {
  version: VersionConfig;
}

type DocPageProps =
  | (DocPageEntryProps & VersionedDocPageExtra)
  | (DocPageAutoIndexProps & VersionedDocPageExtra);

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
    const source = resolveNavSource(settings.defaultLocale, version.slug);
    const urlFor = (s: string): string => versionedDocsUrl(s, version.slug);

    for (const item of buildDocRouteEntries({
      source,
      locale: settings.defaultLocale,
      routeSig: `v-docs;${version.slug}`,
      urlFor,
    })) {
      result.push({
        params: { version: version.slug, slug: item.slugParams },
        props: { ...(item.props as DocPageProps), version },
      });
    }
  }

  return result;
}

type PageArgs = DocPageProps & { params: { version: string; slug: string[] } };

export default function VersionedDocsPage(props: PageArgs): JSX.Element {
  return renderDocPage(props, {
    locale: settings.defaultLocale,
    version: props.version,
  });
}
